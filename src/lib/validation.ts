import { z } from "zod";

/**
 * URL of a GitHub repository: https://github.com/<owner>/<repo>
 * Redefined here so it stays testable without network access.
 * The schemas in this file are shared between the client and the API route.
 */
export const GITHUB_REPO_REGEX =
  /^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})\/?$/;

export type GithubRepoRef = { owner: string; repo: string };

export function parseGithubRepoUrl(url: string): GithubRepoRef | null {
  const match = GITHUB_REPO_REGEX.exec(url.trim());
  if (match === null) return null;

  const owner = match[1];
  const repoWithSuffix = match[2];
  if (owner === undefined || repoWithSuffix === undefined) return null;

  const repo =
    repoWithSuffix !== ".git" && repoWithSuffix.endsWith(".git")
      ? repoWithSuffix.slice(0, -".git".length)
      : repoWithSuffix;

  if (repo === "." || repo === ".." || repo.length === 0) return null;

  return { owner, repo };
}

export const repoUrlSchema = z
  .string()
  .min(1, "A GitHub repository URL is required.")
  .refine((value) => parseGithubRepoUrl(value) !== null, {
    message:
      "Invalid repository URL. Expected format: https://github.com/owner/repository",
  });

function parseIpv4(address: string): [number, number, number, number] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (match === null) return null;
  const octets = match.slice(1, 5).map(Number);
  if (octets.some((octet) => octet > 255)) return null;
  return [octets[0] ?? 0, octets[1] ?? 0, octets[2] ?? 0, octets[3] ?? 0];
}

/**
 * Non-routable / internal IPv4: loopback, private, CGNAT, link-local,
 * documentation, benchmarking, multicast and reserved addresses.
 */
function isPrivateIpv4(octets: readonly number[]): boolean {
  const [a = 0, b = 0] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && (b === 0 || b === 2)) return true; // 192.0.0.0/24, 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51) return true; // 198.51.100.0/24
  if (a === 203 && b === 0) return true; // 203.0.113.0/24
  if (a >= 224) return true; // multicast (224/4), reserved (240/4), broadcast
  return false;
}

/** Parses an IPv6 address (with "::", embedded IPv4 and zone) into 16 bytes. */
function parseIpv6(address: string): number[] | null {
  let value = address.trim().toLowerCase();
  const zone = value.indexOf("%");
  if (zone !== -1) value = value.slice(0, zone);
  if (!value.includes(":")) return null;

  const lastColon = value.lastIndexOf(":");
  const tail = value.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (v4 === null) return null;
    const high = ((v4[0] << 8) | v4[1]).toString(16);
    const low = ((v4[2] << 8) | v4[3]).toString(16);
    value = `${value.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] === "" ? [] : (halves[0] ?? "").split(":");
  const right =
    halves.length === 2 && halves[1] !== "" ? (halves[1] ?? "").split(":") : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;

  const groups = [...left, ...Array<string>(missing).fill("0"), ...right];
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    const word = Number.parseInt(group, 16);
    bytes.push((word >> 8) & 0xff, word & 0xff);
  }
  return bytes;
}

/** Non-routable IPv6: ULA, link-local, private IPv4-mapped/embedded, multicast. */
function isPrivateIpv6(bytes: readonly number[]): boolean {
  const at = (index: number): number => bytes[index] ?? 0;
  const isZeroSlice = (from: number, to: number): boolean =>
    bytes.slice(from, to).every((byte) => byte === 0);

  if (isZeroSlice(0, 16)) return true; // :: (unspecified)
  if (isZeroSlice(0, 15) && at(15) === 1) return true; // ::1 (loopback)
  if ((at(0) & 0xfe) === 0xfc) return true; // fc00::/7 (ULA)
  if (at(0) === 0xfe && (at(1) & 0xc0) === 0x80) return true; // fe80::/10 (link-local)
  if (at(0) === 0xff) return true; // ff00::/8 (multicast)

  // ::ffff:a.b.c.d (IPv4-mapped) and ::a.b.c.d (IPv4-compatible, deprecated)
  if (isZeroSlice(0, 10) && at(10) === 0xff && at(11) === 0xff) {
    return isPrivateIpv4([at(12), at(13), at(14), at(15)]);
  }
  if (isZeroSlice(0, 12)) return isPrivateIpv4([at(12), at(13), at(14), at(15)]);

  // 64:ff9b::/96 (NAT64) and 2002::/16 (6to4) encapsulate an IPv4
  if (at(0) === 0x00 && at(1) === 0x64 && at(2) === 0xff && at(3) === 0x9b) {
    return isPrivateIpv4([at(12), at(13), at(14), at(15)]);
  }
  if (at(0) === 0x20 && at(1) === 0x02) {
    return isPrivateIpv4([at(2), at(3), at(4), at(5)]);
  }

  if (at(0) === 0x20 && at(1) === 0x01 && at(2) === 0x0d && at(3) === 0xb8) return true; // 2001:db8::/32
  if (at(0) === 0x01 && at(1) === 0x00 && isZeroSlice(2, 8)) return true; // 100::/64 (discard)
  return false;
}

/** True if the IP address (v4 or v6) is not a publicly routable address. */
export function isPrivateAddress(address: string): boolean {
  const trimmed = address.trim();
  const ipv4 = parseIpv4(trimmed);
  if (ipv4 !== null) return isPrivateIpv4(ipv4);
  const ipv6 = parseIpv6(trimmed);
  if (ipv6 !== null) return isPrivateIpv6(ipv6);
  return true; // unknown form: refuse by default
}

/**
 * Refuse internal targets based on the hostname (before DNS resolution).
 * Also handles the IPv6 literals that `URL.hostname` returns in brackets.
 */
export function isPrivateOrLocalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  const bare =
    lower.startsWith("[") && lower.endsWith("]") ? lower.slice(1, -1) : lower;

  if (
    bare === "localhost" ||
    bare.endsWith(".localhost") ||
    bare.endsWith(".local") ||
    bare.endsWith(".internal")
  ) {
    return true;
  }

  // IP literal (v4, v6): full classification.
  if (parseIpv4(bare) !== null || parseIpv6(bare) !== null) {
    return isPrivateAddress(bare);
  }

  return false;
}

export const productionUrlSchema = z
  .string()
  .min(1, "A production URL is required.")
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") return false;
        if (isPrivateOrLocalHost(url.hostname)) return false;
        return true;
      } catch {
        return false;
      }
    },
    {
      message:
        "Invalid production URL: must be a public HTTP/HTTPS URL (internal and private IP addresses are blocked for security).",
    },
  );

export type ProductionUrlSchema = z.infer<typeof productionUrlSchema>;

export const scanRequestSchema = z
  .object({
    repoUrl: repoUrlSchema,
    /** Absent or empty: repository audit only, without the site probe. */
    productionUrl: z.string().optional(),
    /** Optional GitHub token provided by the user (not stored). */
    githubToken: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const trimmed = value.productionUrl?.trim() ?? "";
    if (trimmed === "") return;
    const parsed = productionUrlSchema.safeParse(trimmed);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["productionUrl"],
        message: parsed.error.issues[0]?.message ?? "Invalid production URL.",
      });
    }
  })
  .transform((value) => {
    const trimmed = value.productionUrl?.trim() ?? "";
    return {
      repoUrl: value.repoUrl,
      productionUrl: trimmed === "" ? undefined : trimmed,
      githubToken: value.githubToken,
    };
  });

export type ScanRequest = z.infer<typeof scanRequestSchema>;
