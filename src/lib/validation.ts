import { z } from "zod";

/**
 * URL d'un dépôt GitHub : https://github.com/<owner>/<repo>
 * Redefinie ici pour rester testable sans accès réseau.
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
  .min(1, "L'URL du dépôt GitHub est requise.")
  .refine((value) => parseGithubRepoUrl(value) !== null, {
    message:
      "URL de dépôt GitHub invalide. Format attendu : https://github.com/propriétaire/dépôt",
  });

export const productionUrlSchema = z
  .string()
  .min(1, "L'URL de production est requise si elle est fournie.")
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    {
      message:
        "URL de production invalide : elle doit commencer par http:// ou https://.",
    },
  );

export const scanRequestSchema = z.object({
  repoUrl: repoUrlSchema,
  productionUrl: productionUrlSchema.optional(),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;
