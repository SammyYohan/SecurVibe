/**
 * Résout les versions npm réellement installées.
 * Le `package.json` porte souvent des plages (`^`, `~`) : les avis OSV
 * ne sont fiables que sur la version exacte du lockfile.
 */

export type LockKind = "npm" | "pnpm" | "yarn";

export type ResolvedPackage = {
  name: string;
  version: string;
  direct: boolean;
};

export type ResolveResult = {
  packages: ResolvedPackage[];
  /** Dépendances directes restées sans version exacte. */
  unresolvedDirect: number;
  lockfileUsed: boolean;
  lockfileBroken: boolean;
};

const EXACT_SEMVER = /^\d+\.\d+\.\d+(?:[-+].*)?$/;
const MAX_PACKAGES = 100;

export function isExactSemver(version: string): boolean {
  return EXACT_SEMVER.test(version);
}

export function detectLockKind(path: string): LockKind | null {
  const base = path.split("/").pop() ?? path;
  if (base === "package-lock.json" || base === "npm-shrinkwrap.json") return "npm";
  if (base === "pnpm-lock.yaml") return "pnpm";
  if (base === "yarn.lock") return "yarn";
  return null;
}

export function resolvePackagesForAudit(
  direct: readonly { name: string; range: string }[],
  lockText: string | null,
  lockKind: LockKind | null,
): ResolveResult {
  const fromManifest = new Map<string, string>();
  for (const dep of direct) {
    if (isExactSemver(dep.range)) fromManifest.set(dep.name, dep.range);
  }

  if (lockText === null || lockKind === null) {
    return {
      packages: [...fromManifest].map(([name, version]) => ({ name, version, direct: true })),
      unresolvedDirect: direct.length - fromManifest.size,
      lockfileUsed: false,
      lockfileBroken: false,
    };
  }

  let parsed: ParsedLock;
  try {
    parsed = parseLock(lockText, lockKind);
  } catch {
    return {
      packages: [...fromManifest].map(([name, version]) => ({ name, version, direct: true })),
      unresolvedDirect: direct.length - fromManifest.size,
      lockfileUsed: false,
      lockfileBroken: true,
    };
  }

  const chosen: ResolvedPackage[] = [];
  const seen = new Set<string>();
  let unresolvedDirect = 0;

  for (const dep of direct) {
    const locked = parsed.direct.get(dep.name) ?? fromManifest.get(dep.name);
    if (locked === undefined || !isExactSemver(stripPeerSuffix(locked))) {
      unresolvedDirect += 1;
      continue;
    }
    const version = stripPeerSuffix(locked);
    const key = `${dep.name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push({ name: dep.name, version, direct: true });
  }

  for (const item of parsed.transitive) {
    if (chosen.length >= MAX_PACKAGES) break;
    const version = stripPeerSuffix(item.version);
    if (!isExactSemver(version)) continue;
    const key = `${item.name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push({ name: item.name, version, direct: false });
  }

  return {
    packages: chosen.slice(0, MAX_PACKAGES),
    unresolvedDirect,
    lockfileUsed: true,
    lockfileBroken: false,
  };
}

type ParsedLock = {
  direct: Map<string, string>;
  transitive: Array<{ name: string; version: string }>;
};

function parseLock(text: string, kind: LockKind): ParsedLock {
  if (kind === "npm") return parseNpmLock(text);
  if (kind === "pnpm") return parsePnpmLock(text);
  return parseYarnLock(text);
}

function stripPeerSuffix(version: string): string {
  const paren = version.indexOf("(");
  return (paren === -1 ? version : version.slice(0, paren)).trim();
}

function parseNpmLock(text: string): ParsedLock {
  const body: unknown = JSON.parse(text);
  if (typeof body !== "object" || body === null) {
    throw new Error("package-lock.json is not an object.");
  }
  const record = body as {
    packages?: unknown;
    dependencies?: unknown;
  };

  const direct = new Map<string, string>();
  const transitive: Array<{ name: string; version: string }> = [];

  if (typeof record.packages === "object" && record.packages !== null) {
    for (const [path, meta] of Object.entries(record.packages)) {
      if (typeof meta !== "object" || meta === null) continue;
      const version = (meta as { version?: unknown; dev?: unknown }).version;
      if (typeof version !== "string") continue;
      const named = npmPathToName(path);
      if (named === null) continue;
      if (named.nested) {
        if ((meta as { dev?: unknown }).dev === true) continue;
        transitive.push({ name: named.name, version });
      } else {
        direct.set(named.name, version);
      }
    }
  }

  if (direct.size === 0 && typeof record.dependencies === "object" && record.dependencies !== null) {
    for (const [name, meta] of Object.entries(record.dependencies)) {
      if (typeof meta !== "object" || meta === null) continue;
      const version = (meta as { version?: unknown }).version;
      if (typeof version === "string") direct.set(name, version);
    }
  }

  return { direct, transitive };
}

function npmPathToName(path: string): { name: string; nested: boolean } | null {
  if (!path.startsWith("node_modules/")) return null;
  const rest = path.slice("node_modules/".length);
  const nestedAt = rest.indexOf("/node_modules/");
  const nested = nestedAt !== -1;
  const top = nested ? rest.slice(nestedAt + "/node_modules/".length) : rest;
  if (top.startsWith("@")) {
    const parts = top.split("/");
    const scope = parts[0];
    const name = parts[1];
    if (scope === undefined || name === undefined || name === "") return null;
    return { name: `${scope}/${name}`, nested };
  }
  const name = top.split("/")[0];
  if (name === undefined || name === "") return null;
  return { name, nested };
}

function parsePnpmLock(text: string): ParsedLock {
  const direct = new Map<string, string>();
  const lines = text.split(/\r?\n/);
  let inImporters = false;
  let inRoot = false;
  let inDeps = false;
  let currentName: string | null = null;

  for (const line of lines) {
    if (!inImporters) {
      if (line === "importers:") inImporters = true;
      continue;
    }
    if (/^\S/.test(line)) break;
    if (line === "  .:") {
      inRoot = true;
      inDeps = false;
      currentName = null;
      continue;
    }
    if (!inRoot) continue;
    if (/^  \S/.test(line)) break;

    if (line === "    dependencies:" || line === "    devDependencies:") {
      inDeps = true;
      currentName = null;
      continue;
    }
    if (/^    \S/.test(line)) {
      inDeps = false;
      currentName = null;
      continue;
    }
    if (!inDeps) continue;

    const inline = /^ {6}(.+?):\s+([0-9][^\s#]*)\s*$/.exec(line);
    if (inline?.[1] !== undefined && inline[2] !== undefined) {
      direct.set(inline[1], inline[2]);
      currentName = null;
      continue;
    }
    const nameOnly = /^ {6}(.+?):\s*$/.exec(line);
    if (nameOnly?.[1] !== undefined) {
      currentName = nameOnly[1];
      continue;
    }
    const versionLine = /^ {8}version:\s+['"]?([0-9][^'"\s]*)/.exec(line);
    if (currentName !== null && versionLine?.[1] !== undefined) {
      direct.set(currentName, versionLine[1]);
      currentName = null;
    }
  }

  const transitive: Array<{ name: string; version: string }> = [];
  const v9 = /^ {2}((?:@[^/\s]+\/)?[^@\s]+)@(\d+\.\d+\.\d+[^:\s]*):?\s*$/;
  const v6 = /^ {2}\/((?:@[^/]+\/)?[^/@]+)\/(\d+\.\d+\.\d+[^:\s]*)/;
  let inPackages = false;
  for (const line of lines) {
    if (!inPackages) {
      if (line === "packages:") inPackages = true;
      continue;
    }
    if (/^\S/.test(line)) break;
    const match = v9.exec(line) ?? v6.exec(line);
    const name = match?.[1];
    const version = match?.[2];
    if (name === undefined || version === undefined) continue;
    if (direct.get(name) === version) continue;
    transitive.push({ name, version });
  }

  return { direct, transitive };
}

function parseYarnLock(text: string): ParsedLock {
  const versions = new Map<string, string[]>();
  const lines = text.split(/\r?\n/);
  let names: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") continue;
    if (!/^\s/.test(line)) {
      names = extractYarnNames(line);
      continue;
    }
    const classic = /^\s+version\s+"([^"]+)"/.exec(line);
    const berry = /^\s+version:\s+['"]?([0-9][^'"\s]*)/.exec(line);
    const version = classic?.[1] ?? berry?.[1];
    if (version === undefined) continue;
    for (const name of names) {
      const list = versions.get(name) ?? [];
      if (!list.includes(version)) list.push(version);
      versions.set(name, list);
    }
    names = [];
  }

  const direct = new Map<string, string>();
  for (const [name, list] of versions) {
    const first = list[0];
    if (first !== undefined) direct.set(name, first);
  }
  return { direct, transitive: [] };
}

function extractYarnNames(header: string): string[] {
  const cleaned = header.trim().replace(/:$/, "");
  const parts = cleaned.split(",").map((part) => part.trim().replace(/^"|"$/g, ""));
  const names: string[] = [];
  for (const part of parts) {
    const npm = /^(@?[^@]+)@npm:/.exec(part);
    if (npm?.[1] !== undefined) {
      names.push(npm[1]);
      continue;
    }
    const scoped = /^(@[^@/]+\/[^@]+)@/.exec(part);
    if (scoped?.[1] !== undefined) {
      names.push(scoped[1]);
      continue;
    }
    const plain = /^([^@\s]+)@/.exec(part);
    if (plain?.[1] !== undefined) names.push(plain[1]);
  }
  return names;
}
