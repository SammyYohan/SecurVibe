import { z } from "zod";

/**
 * URL d'un dépôt GitHub : https://github.com/<owner>/<repo>
 * Redéfinie ici pour rester testable sans accès réseau.
 * Les schémas de ce fichier sont partagés entre le client et la route API.
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

export function isPrivateOrLocalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "0.0.0.0" ||
    lower === "::1" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    return true;
  }

  // IPv4 private & link-local ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (ipv4Match) {
    const o1 = Number(ipv4Match[1]);
    const o2 = Number(ipv4Match[2]);
    if (o1 === 127 || o1 === 0) return true;
    if (o1 === 10) return true;
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    if (o1 === 192 && o2 === 168) return true;
    if (o1 === 169 && o2 === 254) return true;
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

export const scanRequestSchema = z.object({
  repoUrl: repoUrlSchema,
  productionUrl: productionUrlSchema,
  /** Token GitHub optionnel fourni par l'utilisateur (sans stockage). */
  githubToken: z.string().optional(),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;
