import "server-only";

import { z } from "zod";
import { sleep, isAbortError } from "@/lib/sleep";
import { getServerEnv } from "@/lib/env";
import { parseGithubRepoUrl } from "@/lib/validation";
import { queryVulnerabilities, type DependencyRef } from "@/services/vulnClient";
import type { Finding, ProgressRange, ScanEvent, Severity } from "@/types";

/**
 * Scan RÉEL d'un dépôt GitHub :
 *  1. existence + arborescence via l'API github.com (1 à 2 requêtes de quota) ;
 *  2. lecture des fichiers via raw.githubusercontent.com (hors quota API) ;
 *  3. détection de secrets par règles + hygiène (.env commité, .gitignore, lockfile, CI) ;
 *  4. vulnérabilités connues via OSV.dev à partir du manifeste npm.
 * En cas d'annulation, le générateur se termine silencieusement.
 */

export type ScanInput = { repoUrl: string; githubToken?: string };

const MAX_CODE_FILES = 50;
const MAX_FILE_BYTES = 64 * 1024;
const CODE_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rb", ".go",
  ".java", ".kt", ".php", ".cs", ".swift", ".dart",
];
const IGNORED_PATH_RES: readonly RegExp[] = [
  /^\.github\//, /^vendor\//, /^coverage\//, /^dist\//, /^build\//,
  /^node_modules\//, /(\.min\.js|\.spec\.|\.test\.|\.d\.ts)$/,
];

type SecretRule = { id: string; severity: Severity; regex: RegExp };
type RuleCopy = { issue: string; explanation: string; fix: string };

const RULE_COPY: Record<string, RuleCopy> = {
  "rule-github-pat": {
    issue: "GitHub personal access token committed",
    explanation:
      "A GitHub token is present in this file. Anyone with read access to the repository can retrieve it and act with your account or organization permissions — leaked tokens are harvested automatically within minutes.",
    fix: "1. Revoke the token (GitHub → Settings → Developer settings).\n2. Remove it from the code and purge the history where needed.\n3. Read secrets from a server-only environment variable validated with zod.",
  },
  "rule-stripe-secret": {
    issue: "Stripe secret key committed",
    explanation: "A live Stripe secret key appears in the source. Leaked, it grants full control over payments and customer data of the linked account.",
    fix: "1. Rotate the key in the Stripe dashboard immediately.\n2. Call Stripe from a server-side route only, with the key read from a validated environment variable (never NEXT_PUBLIC_).",
  },
  "rule-openai-key": {
    issue: "OpenAI API key committed",
    explanation: "An OpenAI key is readable in code; it can bill prompts on your account or reveal prompt content.",
    fix: "1. Revoke the key on platform.openai.com.\n2. Call the provider from the server only, reading the key from a validated environment variable.",
  },
  "rule-aws-access-key": {
    issue: "AWS access key committed",
    explanation: "An AWS access key id appears in source. Bots scan public repositories for these keys within minutes to abuse cloud privileges.",
    fix: "1. Deactivate the key pair in IAM right away.\n2. Prefer short-lived roles (OIDC federation) instead of static keys in code.",
  },
  "rule-slack-token": {
    issue: "Slack token committed",
    explanation: "A Slack bot or user token is committed; message history, channels and webhooks can be read or manipulated.",
    fix: "Rotate it in Slack App Management, restrict scopes, and keep the value in a server-side environment variable.",
  },
  "rule-gitlab-pat": {
    issue: "GitLab personal access token committed",
    explanation: "A GitLab PAT grants API access to projects, packages and CI variables.",
    fix: "Revoke it (GitLab → access tokens), then inject it as a protected environment variable.",
  },
  "rule-private-key": {
    issue: "Private key material committed",
    explanation: "A PEM private-key block is committed. Whoever obtains it can impersonate the service or sign as it.",
    fix: "1. Treat this key as compromised and rotate it (CA, SSH, JWT issuer…).\n2. Generate a fresh key; only its path belongs in code, the secret lives in a secret manager.",
  },
  "rule-signed-jwt": {
    issue: "Signed JWT committed",
    explanation: "A signed JWT appears in code; it stays usable for its remaining lifetime and can leak claims.",
    fix: "Remove token literals from code; mint JWTs at runtime (server-side) with short TTLs.",
  },
  "rule-hardcoded-credential": {
    issue: "Possible hardcoded credential",
    explanation: "A long opaque value is assigned to a password/API key-like variable. It may be a real secret or a throwaway — both deserve a review.",
    fix: "Replace it with an environment variable validated server-side, and add secret-scanning in CI to catch regressions.",
  },
};

// Construites au runtime par concaténation: aucune clé réelle en littéral.
const RULES: readonly SecretRule[] = [
  { id: "rule-github-pat", severity: "CRITICAL", regex: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { id: "rule-stripe-secret", severity: "CRITICAL", regex: new RegExp("\\bsk_live_[A-Za-z0-9]{16,}\\b") },
  { id: "rule-openai-key", severity: "CRITICAL", regex: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/ },
  { id: "rule-aws-access-key", severity: "CRITICAL", regex: new RegExp("\\b(AKIA)[0-9A-Z]{16}\\b") },
  { id: "rule-slack-token", severity: "CRITICAL", regex: /\bxox[beas]-[A-Za-z0-9-]{10,}\b/ },
  { id: "rule-gitlab-pat", severity: "CRITICAL", regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/ },
  { id: "rule-private-key", severity: "CRITICAL", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: "rule-signed-jwt", severity: "CRITICAL", regex: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/ },
  {
    id: "rule-hardcoded-credential",
    severity: "WARNING",
    regex: /(?:password|passwd|api[_-]?key|secret)[A-Za-z0-9_ "'-]*\s*[:=]\s*["'][A-Za-z0-9+/=_-]{16,}["']/i,
  },
];

const repoSchema = z.object({ default_branch: z.string() });
const gitTreeSchema = z.object({
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.enum(["blob", "tree", "commit"]),
      size: z.number().optional(),
    }),
  ),
});
const packageJsonSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

const EXACT_SEMVER = /^\d+\.\d+\.\d+(?:[-+].*)?$/;
const PASSWORD_HASH_LIBS = ["bcrypt", "argon2"];

export async function* scanRepository(
  input: ScanInput,
  range: ProgressRange,
  signal: AbortSignal,
): AsyncGenerator<ScanEvent, void, void> {
  try {
    const ref = parseGithubRepoUrl(input.repoUrl);
    if (ref === null) {
      yield { type: "error", code: "INVALID_URL", message: "Invalid GitHub repository URL." };
      return;
    }

    let token: string | undefined;
    const userToken = normalizeToken(input.githubToken);
    if (userToken !== undefined) {
      token = userToken;
    } else {
      try {
        token = getServerEnv().GITHUB_TOKEN;
      } catch {
        token = undefined;
      }
    }

    // ---- 1. Existence du dépôt + branche par défaut ------------------------
    const repoResult = await ghJson(`repos/${ref.owner}/${ref.repo}`, token, signal);
    if (repoResult === null) {
      yield {
        type: "error",
        code: "INTERNAL_ERROR",
        message: "GitHub is unreachable right now. Retry in a few minutes.",
      };
      return;
    }
    if (repoResult.status === 403 || repoResult.status === 429) {
      yield {
        type: "error",
        code: "INTERNAL_ERROR",
        message: "GitHub API rate limit reached. Add your own GitHub token in settings, or retry in a few minutes.",
      };
      return;
    }
    if (repoResult.status !== 200) {
      yield {
        type: "error",
        code: "REPO_NOT_FOUND",
        message: "Repository not found or private. Check the URL and access rights.",
      };
      return;
    }
    const repoParsed = repoSchema.safeParse(repoResult.body);
    if (!repoParsed.success) {
      yield {
        type: "error",
        code: "INTERNAL_ERROR",
        message: "Unexpected GitHub response. Retry in a few minutes.",
      };
      return;
    }
    const defaultBranch = repoParsed.data.default_branch;

    // ---- 2. Arborescence ----------------------------------------------------
    const treeResult = await ghJson(
      `repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
      token,
      signal,
    );
    if (treeResult === null) {
      yield { type: "error", code: "INTERNAL_ERROR", message: "GitHub is unreachable right now. Retry in a few minutes." };
      return;
    }
    if (treeResult.status !== 200) {
      yield { type: "error", code: "REPO_NOT_FOUND", message: "Could not read the repository tree." };
      return;
    }
    const treeParsed = gitTreeSchema.safeParse(treeResult.body);
    if (!treeParsed.success) {
      yield { type: "error", code: "INTERNAL_ERROR", message: "Unexpected repository tree. Retry in a few minutes." };
      return;
    }
    const blobs = treeParsed.data.tree.filter((entry) => entry.type === "blob");

    const codeFiles = blobs
      .filter((entry) => !IGNORED_PATH_RES.some((rx) => rx.test(entry.path)))
      .filter((entry) => CODE_EXTENSIONS.some((ext) => entry.path.toLowerCase().endsWith(ext)))
      .filter((entry) => entry.size === undefined || (entry.size >= 1 && entry.size <= MAX_FILE_BYTES))
      .slice(0, MAX_CODE_FILES);

    // Les gabarits versionnés (.env.example, .env.sample…) ne sont pas des secrets.
    const envFiles = blobs.filter(
      (entry) => /^\.env(\..+)?$/.test(entry.path) && !isEnvTemplate(entry.path),
    );
    const hasLockfile = blobs.some(
      (entry) =>
        /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|npm-shrinkwrap\.json)$/.test(entry.path),
    );
    const gitignoreEntry = blobs.find((entry) => entry.path === ".gitignore");
    const hasWorkflows = blobs.some(
      (entry) => entry.path.startsWith(".github/workflows/") && /\.ya?ml$/.test(entry.path),
    );
    const manifestEntry = blobs.find((entry) => entry.path.toLowerCase() === "package.json");

    yield { type: "scan_started", totalFiles: codeFiles.length };

    const hygieneFindings: Finding[] = [];
    const totalUnits = codeFiles.length + 4;
    let doneUnits = 0;

    // ---- 3. Contenu des fichiers: détection de secrets -----------------------
    for (const file of codeFiles) {
      if (signal.aborted) return;
      const content = await rawContent(ref.owner, ref.repo, defaultBranch, file.path, signal);
      if (content !== null) {
        const match = findFirstSecret(content);
        if (match !== null) {
          yield { type: "finding", finding: buildSecretFinding(file.path, match) };
        }
      }
      doneUnits += 1;
      yield { type: "progress", value: interpolate(range, doneUnits, totalUnits) };
      if (doneUnits % 5 === 0) await sleep(randomIntBetween(120, 320), signal);
    }

    // ---- 4. Fichiers .env commités ------------------------------------------
    if (envFiles.length > 0) {
      const names = envFiles.slice(0, 4).map((entry) => entry.path).join(", ");
      hygieneFindings.push({
        id: "scan-env-committed",
        file: `${names}${envFiles.length > 4 ? `, … (+${envFiles.length - 4} more)` : ""}`,
        severity: "CRITICAL",
        issue: "Committed .env file(s)",
        explanation:
          "The repository history contains environment files. They usually hold database passwords and provider keys: committing them leaks secrets through the repo, forks and build caches.",
        fix: "1. Add `.env*` (except `!.env.example`) to .gitignore.\n2. Rotate every secret that may appear in these files.\n3. Purge the history where needed (git filter-repo).",
      });
    }

    // ---- 5. .gitignore --------------------------------------------------------
    const gitignoreContent =
      gitignoreEntry === undefined
        ? null
        : await rawContent(ref.owner, ref.repo, defaultBranch, ".gitignore", signal);
    doneUnits += 1;
    yield { type: "progress", value: interpolate(range, doneUnits, totalUnits) };

    if (gitignoreContent !== null && excludesEnvFiles(gitignoreContent)) {
      hygieneFindings.push({
        id: "scan-gitignore-ok",
        file: ".gitignore",
        severity: "OK",
        issue: "Environment files are excluded from git",
        explanation: ".gitignore excludes .env* files; accidental environment secrets do not reach commits.",
        fix: "Keep the rule and extend it whenever a new secret file type appears.",
      });
    } else if (envFiles.length === 0) {
      hygieneFindings.push({
        id: "scan-gitignore-missing",
        file: ".gitignore",
        severity: "WARNING",
        issue: "No .env exclusion detected",
        explanation: "The repository does not exclude environment files. A forced commit could silently leak real credentials.",
        fix: "Add to .gitignore:\n`.env*`\n`!.env.example`\nand ship an empty template file for onboarding.",
      });
    }

    // ---- 6. Manifeste npm + OSV.dev -------------------------------------------
    if (manifestEntry !== undefined) {
      const manifestContent = await rawContent(ref.owner, ref.repo, defaultBranch, "package.json", signal);
      if (manifestContent !== null) {
        const manifestFindings = await buildManifestFindings(manifestContent, signal);
        for (const finding of manifestFindings) hygieneFindings.push(finding);
      }
    }
    doneUnits += 1;
    yield { type: "progress", value: interpolate(range, doneUnits, totalUnits) };

    // ---- 7. Lockfile + CI -------------------------------------------------------
    if (manifestEntry === undefined) {
      hygieneFindings.push({
        id: "scan-manifest-missing",
        file: "package.json",
        severity: "WARNING",
        issue: "No package.json at repository root",
        explanation: "The npm dependency audit was skipped because no manifest exists at the root.",
        fix: "Commit package.json at the root so dependency auditing can run.",
      });
    }
    if (hasLockfile) {
      hygieneFindings.push({
        id: "scan-lockfile-ok",
        file: "package.json",
        severity: "OK",
        issue: "Lockfile committed",
        explanation: "A lockfile pins the dependency graph exactly, so installs are reproducible across environments.",
        fix: "Keep frozen installs in CI (`--frozen-lockfile`) so manifest/lockfile drift fails the build.",
      });
    } else if (manifestEntry !== undefined) {
      hygieneFindings.push({
        id: "scan-lockfile-missing",
        file: "package.json",
        severity: "WARNING",
        issue: "No lockfile committed",
        explanation: "Without package-lock/pnpm-lock/yarn.lock, installs resolve different trees between machines, CI and production.",
        fix: "Commit your lockfile and install with `--frozen-lockfile` in CI.",
      });
    }
    if (hasWorkflows) {
      hygieneFindings.push({
        id: "scan-ci-ok",
        file: ".github/workflows",
        severity: "OK",
        issue: "CI workflows detected",
        explanation: "GitHub Actions workflows exist, so security checks can run automatically on every commit.",
        fix: "Add an audit job (`pnpm audit --prod`) plus secret scanning in CI so regressions never land silently.",
      });
    } else {
      hygieneFindings.push({
        id: "scan-ci-missing",
        file: ".github/workflows",
        severity: "WARNING",
        issue: "No CI workflow detected",
        explanation: "Without CI, nothing re-verifies security between two manual deployments; risk drifts silently.",
        fix: "Start with a minimal GitHub Actions workflow: install, typecheck, build, plus a secret scan.",
      });
    }
    doneUnits += 1;
    yield { type: "progress", value: interpolate(range, doneUnits, totalUnits) };

    // ---- Émission des constats d'hygiène ----------------------------------------
    for (const finding of hygieneFindings) {
      yield { type: "finding", finding };
    }
    doneUnits += 1;
    yield { type: "progress", value: interpolate(range, doneUnits, totalUnits) };
  } catch (error) {
    if (!isAbortError(error)) throw error;
  }
}

// ---------------------------------------------------------------- interne ----

function buildSecretFinding(filePath: string, match: { rule: SecretRule; line: number }): Finding {
  const copy = RULE_COPY[match.rule.id];
  return {
    id: `scan-${match.rule.id}-${match.line}-${hashCode(filePath)}`,
    file: `${filePath} (line ${match.line})`,
    severity: match.rule.severity,
    issue: copy?.issue ?? "Sensitive value detected",
    explanation:
      copy?.explanation ?? "A value matching a secret pattern was found. Double-check manually.",
    fix:
      copy?.fix ?? "Rotate the value and move it to a server-side environment variable.",
  };
}

/** Petit hash stable (FNV-1a-like) pour rendre les ids uniques et stables. */
function hashCode(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function findFirstSecret(content: string): { rule: SecretRule; line: number } | null {
  const lines = content.split("\n");
  for (const rule of RULES) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      rule.regex.lastIndex = 0;
      if (rule.regex.test(line)) {
        return { rule, line: index + 1 };
      }
    }
  }
  return null;
}

async function buildManifestFindings(content: string, signal: AbortSignal): Promise<readonly Finding[]> {
  const manifestFindings: Finding[] = [];

  let body: unknown = null;
  try {
    body = JSON.parse(content);
  } catch {
    body = null;
  }
  const parsed = packageJsonSchema.safeParse(body);
  if (!parsed.success) {
    manifestFindings.push({
      id: "scan-manifest-invalid",
      file: "package.json",
      severity: "WARNING",
      issue: "package.json is not valid JSON",
      explanation: "The manifest exists but cannot be parsed, so the dependency audit was skipped.",
      fix: "Fix the syntax of package.json: a valid manifest is required to install, build and audit.",
    });
    return manifestFindings;
  }

  const allDeps: Array<[string, string]> = [
    ...Object.entries(parsed.data.dependencies ?? {}),
    ...Object.entries(parsed.data.devDependencies ?? {}),
  ];

  if (allDeps.length === 0) {
    manifestFindings.push({
      id: "scan-osv-empty",
      file: "package.json",
      severity: "OK",
      issue: "No npm dependencies to audit",
      explanation: "The manifest declares no dependency, so there is no known-vulnerability surface in OSV.dev.",
      fix: "Reassess dependencies periodically; prefer minimal, actively maintained packages.",
    });
    return manifestFindings;
  }

  if (allDeps.some(([name]) => PASSWORD_HASH_LIBS.some((lib) => name.toLowerCase().includes(lib)))) {
    manifestFindings.push({
      id: "scan-hash-ok",
      file: "package.json",
      severity: "OK",
      issue: "Password hashing library present (bcrypt/argon2)",
      explanation: "The dependency list includes a recognized password-hashing library, the right approach for credential storage.",
      fix: "Keep parameters modern (bcrypt cost ≥ 12) and never log passwords or hashes.",
    });
  }

  const pinnedRefs: DependencyRef[] = [];
  let unpinnedCount = 0;
  for (const [name, version] of allDeps) {
    if (EXACT_SEMVER.test(version)) pinnedRefs.push({ name, version });
    else unpinnedCount += 1;
  }

  const vulnerabilities =
    pinnedRefs.length > 0 ? await queryVulnerabilities(pinnedRefs, signal) : [];

  if (pinnedRefs.length > 0 && vulnerabilities.length === 0) {
    manifestFindings.push({
      id: "scan-osv-ok",
      file: "package.json",
      severity: "OK",
      issue: "No known vulnerability from OSV.dev",
      explanation: `Checked ${pinnedRefs.length} pinned dependencies against OSV.dev advisories: none reported (npm ecosystem, exact versions).`,
      fix: "Keep a weekly audit in CI and re-pin after each upgrade.",
    });
  } else if (vulnerabilities.length > 0) {
    const worstSeverity: Severity = vulnerabilities.length >= 3 ? "CRITICAL" : "WARNING";
    const listing = vulnerabilities
      .slice(0, 5)
      .map((v) => `${v.dependency.name}@${v.dependency.version} → ${v.advisoryIds.slice(0, 2).join(", ")}`)
      .join(" ; ");
    manifestFindings.push({
      id: "scan-osv-issues",
      file: "package.json",
      severity: worstSeverity,
      issue: `${vulnerabilities.length} dependencies with published advisories`,
      explanation: `OSV.dev (public vulnerability database) reports advisories for these exact versions: ${listing}${
        vulnerabilities.length > 5 ? ` (+${vulnerabilities.length - 5} more)` : ""
      }. These are real CVE/GHSA entries — check each advisory before upgrading.`,
      fix: "Run `pnpm audit` for the full list, then upgrade or override the affected packages; block releases while the audit fails.",
    });
  }

  if (unpinnedCount > 0) {
    manifestFindings.push({
      id: "scan-unpinned",
      file: "package.json",
      severity: "WARNING",
      issue: `${unpinnedCount} dependencies use range versions`,
      explanation: "Range specifiers (^, ~, *) let different installs resolve different trees; audits become non-deterministic.",
      fix: "Commit the lockfile and enforce frozen installs in CI; treat the lockfile as the source of truth.",
    });
  }
  return manifestFindings;
}

const GITHUB_HEADERS: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "guardvibe-scan",
};

const TOKEN_SHAPES: readonly RegExp[] = [
  /^ghp_[A-Za-z0-9]{20,}$/,
  /^gho_[A-Za-z0-9]{20,}$/,
  /^github_pat_[A-Za-z0-9_]{30,}$/,
];

function normalizeToken(candidate: string | undefined): string | undefined {
  const trimmed = candidate?.trim();
  if (trimmed === undefined || trimmed === "") return undefined;
  if (TOKEN_SHAPES.some((shape) => shape.test(trimmed))) return trimmed;
  return undefined;
}

type GhResult = { status: number; body: unknown } | null;

async function ghJson(
  path: string,
  token: string | undefined,
  signal: AbortSignal,
): Promise<GhResult> {
  try {
    const response = await fetch(`https://api.github.com/${path}`, {
      headers: {
        ...GITHUB_HEADERS,
        ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      cache: "no-store",
    });
    const body: unknown = await response.json();
    return { status: response.status, body };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }
}

const RAW_BASE = "https://raw.githubusercontent.com";

async function rawContent(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  signal: AbortSignal,
): Promise<string | null> {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  try {
    const response = await fetch(
      `${RAW_BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(
        branch,
      )}/${encodedPath}`,
      { signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]), cache: "no-store" },
    );
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }
}

/** Gabarits d'environnement versionnés : attendus dans un dépôt, jamais des secrets. */
const ENV_TEMPLATE_RE =
  /^\.env(?:\.[A-Za-z0-9_-]+)*\.(?:example|sample|template|dist|defaults)$/;

function isEnvTemplate(path: string): boolean {
  return ENV_TEMPLATE_RE.test(path);
}

function excludesEnvFiles(content: string): boolean {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
  const ignoresEnv = lines.some((line) => /^[!.]*\.?env\b|\.env\*/.test(line) && !line.startsWith("!"));
  return ignoresEnv;
}

function interpolate(range: ProgressRange, current: number, total: number): number {
  if (total <= 0) return range.to;
  const ratio = current / total;
  return Math.min(range.to, Math.round(range.from + ratio * (range.to - range.from)));
}

function randomIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
