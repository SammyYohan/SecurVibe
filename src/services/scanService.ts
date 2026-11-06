import "server-only";

import { z } from "zod";
import { isAbortError } from "@/lib/sleep";
import { getServerEnv } from "@/lib/env";
import { detectLockKind, resolvePackagesForAudit } from "@/lib/lockfile";
import {
  findSecrets,
  MAX_SECRET_FINDINGS,
  RULE_COPY,
  type SecretMatch,
} from "@/lib/secrets";
import { parseGithubRepoUrl } from "@/lib/validation";
import { queryVulnerabilities, type DependencyRef } from "@/services/vulnClient";
import type { Finding, ProgressRange, ScanEvent, Severity } from "@/types";

/**
 * Scan RÉEL d'un dépôt GitHub :
 *  1. existence + arborescence via l'API github.com (1 à 2 requêtes de quota) ;
 *  2. lecture des fichiers via raw.githubusercontent.com, avec le token
 *     pour les dépôts privés (repli API GitHub si le raw refuse) ;
 *  3. détection de secrets par règles, fichiers à risque en premier
 *     (.env, workflows, auth), plusieurs constats par fichier ;
 *  4. hygiène (.env commité, .gitignore, lockfile, CI, hachage) ;
 *  5. vulnérabilités connues via OSV.dev sur les versions du lockfile.
 * En cas d'annulation, le générateur se termine silencieusement.
 */

export type ScanInput = {
  repoUrl: string;
  githubToken?: string;
  /** Plafond de fichiers du plan ; absent = plafond gratuit. */
  maxFiles?: number;
};

const MAX_CODE_FILES = 50;
const MAX_FILES_CEILING = 500;
const MAX_FILE_BYTES = 64 * 1024;
const MAX_LOCK_BYTES = 8 * 1024 * 1024;
const FETCH_BATCH = 6;
const CODE_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rb", ".go",
  ".java", ".kt", ".php", ".cs", ".swift", ".dart",
  ".yml", ".yaml", ".json", ".toml", ".ini", ".sh",
];
const IGNORED_PATH_RES: readonly RegExp[] = [
  /^vendor\//, /^coverage\//, /^dist\//, /^build\//,
  /^node_modules\//, /(\.min\.js|\.spec\.|\.test\.|\.d\.ts)$/,
];
const LOCK_BASENAMES = ["pnpm-lock.yaml", "package-lock.json", "npm-shrinkwrap.json", "yarn.lock"];

const LOCAL_AUTH = [/^next-auth$/, /^@auth\//, /^lucia$/, /^@lucia-auth\//, /^passport$/, /^better-auth$/];
const HOSTED_AUTH = [/^@clerk\//, /^@supabase\/supabase-js$/, /^@auth0\//, /^firebase$/, /^@firebase\//];
const HASH_LIBS = ["bcrypt", "bcryptjs", "argon2", "@node-rs/argon2"];

const repoSchema = z.object({ default_branch: z.string() });
const gitTreeSchema = z.object({
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.enum(["blob", "tree", "commit"]),
      size: z.number().optional(),
    }),
  ),
  truncated: z.boolean().optional(),
});
const packageJsonSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

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

    const fileCap = Math.min(
      Math.max(input.maxFiles ?? MAX_CODE_FILES, 1),
      MAX_FILES_CEILING,
    );
    const codeFiles = blobs
      .filter((entry) => isScannable(entry.path, entry.size))
      .sort((left, right) => riskRank(right.path) - riskRank(left.path) || left.path.localeCompare(right.path))
      .slice(0, fileCap);

    const envFiles = blobs.filter((entry) => {
      const base = entry.path.split("/").pop() ?? entry.path;
      return isEnvFile(base) && !isEnvTemplate(base);
    });
    const hasLockfile = blobs.some((entry) => LOCK_BASENAMES.includes(entry.path));
    const lockEntry = LOCK_BASENAMES
      .map((name) => blobs.find((entry) => entry.path === name))
      .find((entry) => entry !== undefined);
    const gitignoreEntry = blobs.find((entry) => entry.path === ".gitignore");
    const hasWorkflows = blobs.some(
      (entry) => entry.path.startsWith(".github/workflows/") && /\.ya?ml$/.test(entry.path),
    );
    const manifestEntry = blobs.find((entry) => entry.path.toLowerCase() === "package.json");

    yield { type: "scan_started", totalFiles: codeFiles.length };

    const hygieneFindings: Finding[] = [];
    if (treeParsed.data.truncated === true) {
      hygieneFindings.push({
        id: "scan-tree-truncated",
        file: defaultBranch,
        severity: "WARNING",
        issue: "Repository tree was truncated by GitHub",
        explanation:
          "GitHub did not return the full file list. Files past the cutoff were not scanned, so a clean report on this repository is incomplete.",
        fix: "Split the repository or audit the unscanned directories with a local secret scanner.",
      });
    }

    const totalUnits = codeFiles.length + 4;
    let doneUnits = 0;
    let secretCount = 0;

    for (let offset = 0; offset < codeFiles.length; offset += FETCH_BATCH) {
      if (signal.aborted) return;
      if (secretCount >= MAX_SECRET_FINDINGS) {
        doneUnits = codeFiles.length;
        yield { type: "progress", value: interpolate(range, doneUnits, totalUnits) };
        break;
      }

      const batch = codeFiles.slice(offset, offset + FETCH_BATCH);
      const contents = await Promise.all(
        batch.map((file) => rawContent(ref.owner, ref.repo, defaultBranch, file.path, token, signal)),
      );

      for (let index = 0; index < batch.length; index += 1) {
        const file = batch[index];
        const content = contents[index];
        if (file !== undefined && content != null && secretCount < MAX_SECRET_FINDINGS) {
          for (const match of findSecrets(content)) {
            if (secretCount >= MAX_SECRET_FINDINGS) break;
            yield { type: "finding", finding: buildSecretFinding(file.path, match) };
            secretCount += 1;
          }
        }
        doneUnits += 1;
        yield { type: "progress", value: interpolate(range, doneUnits, totalUnits) };
      }
    }

    if (envFiles.length > 0) {
      const names = envFiles.slice(0, 4).map((entry) => entry.path).join(", ");
      hygieneFindings.push({
        id: "scan-env-committed",
        file: `${names}${envFiles.length > 4 ? `, … (+${envFiles.length - 4} more)` : ""}`,
        severity: "CRITICAL",
        issue: "Committed .env file(s)",
        explanation:
          "The repository history contains environment files. They usually hold database passwords and provider keys: committing them leaks secrets through the repo, forks and build caches. Their contents are scanned with the same secret rules when they fit in the file cap.",
        fix: "1. Add `.env*` (except `!.env.example`) to .gitignore.\n2. Rotate every secret that may appear in these files.\n3. Purge the history where needed (git filter-repo).",
      });
    }

    const gitignoreContent =
      gitignoreEntry === undefined
        ? null
        : await rawContent(ref.owner, ref.repo, defaultBranch, ".gitignore", token, signal);
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

    if (manifestEntry !== undefined) {
      const manifestContent = await rawContent(ref.owner, ref.repo, defaultBranch, "package.json", token, signal);
      let lockText: string | null = null;
      const lockKind = lockEntry === undefined ? null : detectLockKind(lockEntry.path);
      const lockTooBig = lockEntry?.size !== undefined && lockEntry.size > MAX_LOCK_BYTES;
      if (lockEntry !== undefined && lockKind !== null && !lockTooBig) {
        lockText = await rawContent(ref.owner, ref.repo, defaultBranch, lockEntry.path, token, signal);
      }
      if (manifestContent !== null) {
        const manifestFindings = await buildManifestFindings(
          manifestContent,
          lockText,
          lockKind,
          lockTooBig,
          signal,
        );
        for (const finding of manifestFindings) hygieneFindings.push(finding);
      }
    }
    doneUnits += 1;
    yield { type: "progress", value: interpolate(range, doneUnits, totalUnits) };

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
        file: lockEntry?.path ?? "package.json",
        severity: "OK",
        issue: "Lockfile committed",
        explanation:
          "A lockfile pins the dependency graph. Exact versions from the root lockfile are what OSV.dev is queried with.",
        fix: "Keep frozen installs in CI (`--frozen-lockfile`) so manifest/lockfile drift fails the build.",
      });
    } else if (manifestEntry !== undefined) {
      hygieneFindings.push({
        id: "scan-lockfile-missing",
        file: "package.json",
        severity: "WARNING",
        issue: "No lockfile committed",
        explanation:
          "Without package-lock/pnpm-lock/yarn.lock, only exact versions written in package.json can be checked. Range specifiers are skipped, so known vulnerabilities in the resolved tree stay invisible.",
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

    for (const finding of hygieneFindings) {
      yield { type: "finding", finding };
    }
    doneUnits += 1;
    yield { type: "progress", value: interpolate(range, doneUnits, totalUnits) };
  } catch (error) {
    if (!isAbortError(error)) throw error;
  }
}

function buildSecretFinding(filePath: string, match: SecretMatch): Finding {
  const copy = RULE_COPY[match.rule.id];
  const clientNote = match.clientExposed
    ? " The value sits on a client-exposed variable (NEXT_PUBLIC_, VITE_ or similar), so it ships in the browser bundle."
    : "";
  return {
    id: `scan-${match.rule.id}-${match.line}-${hashCode(filePath)}`,
    file: `${filePath} (line ${match.line})`,
    severity: match.rule.severity,
    issue: copy?.issue ?? "Sensitive value detected",
    explanation:
      (copy?.explanation ?? "A value matching a secret pattern was found. Double-check manually.") + clientNote,
    fix: copy?.fix ?? "Rotate the value and move it to a server-side environment variable.",
  };
}

function hashCode(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function isScannable(path: string, size: number | undefined): boolean {
  const base = path.split("/").pop() ?? path;
  if (LOCK_BASENAMES.includes(base)) return false;
  if (IGNORED_PATH_RES.some((pattern) => pattern.test(path))) return false;
  if (size !== undefined && (size < 1 || size > MAX_FILE_BYTES)) return false;
  if (base === "Dockerfile" || base === "dockerfile" || base === "Containerfile") return true;
  if (isEnvFile(base) && !isEnvTemplate(base)) return true;
  return CODE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
}

function riskRank(path: string): number {
  const lower = path.toLowerCase();
  const base = lower.split("/").pop() ?? lower;
  let rank = 0;
  if (isEnvFile(base) && !isEnvTemplate(base)) rank += 100;
  if (/(secret|credential|password|token|apikey|api-key|stripe|supabase)/.test(lower)) rank += 40;
  if (lower.includes(".github/workflows/")) rank += 30;
  if (/(^|\/)(middleware|auth|route)\.(t|j)sx?$/.test(lower)) rank += 20;
  if (base === "dockerfile" || base.startsWith("docker-compose")) rank += 15;
  return rank;
}

async function buildManifestFindings(
  content: string,
  lockText: string | null,
  lockKind: ReturnType<typeof detectLockKind>,
  lockTooBig: boolean,
  signal: AbortSignal,
): Promise<readonly Finding[]> {
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

  if (allDeps.some(([name]) => isHashLib(name))) {
    manifestFindings.push({
      id: "scan-hash-ok",
      file: "package.json",
      severity: "OK",
      issue: "Password hashing library present (bcrypt/argon2)",
      explanation: "The dependency list includes a recognized password-hashing library, the right approach for credential storage.",
      fix: "Keep parameters modern (bcrypt cost ≥ 12) and never log passwords or hashes.",
    });
  } else if (needsLocalPasswordHash(allDeps.map(([name]) => name))) {
    manifestFindings.push({
      id: "scan-hash-missing",
      file: "package.json",
      severity: "WARNING",
      issue: "Local auth dependency without a password hashing library",
      explanation:
        "The manifest includes a library that stores credentials in your app (NextAuth, Lucia, Passport, Better Auth) and neither bcrypt, bcryptjs nor argon2.",
      fix: "Hash passwords with argon2 or bcrypt (cost ≥ 12). Hosted auth (Clerk, Supabase, Auth0) does not need this.",
    });
  }

  if (lockTooBig) {
    manifestFindings.push({
      id: "scan-lockfile-too-big",
      file: "lockfile",
      severity: "WARNING",
      issue: "Lockfile is too large to resolve versions",
      explanation: "The root lockfile exceeds 8 MB, so OSV.dev is queried with exact versions from package.json only.",
      fix: "Run `pnpm audit` locally for the full tree, and keep the lockfile reviewable.",
    });
  }

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

  const resolved = resolvePackagesForAudit(
    allDeps.map(([name, range]) => ({ name, range })),
    lockTooBig ? null : lockText,
    lockTooBig ? null : lockKind,
  );

  if (resolved.lockfileBroken) {
    manifestFindings.push({
      id: "scan-lockfile-unreadable",
      file: "lockfile",
      severity: "WARNING",
      issue: "Lockfile could not be parsed",
      explanation: "The root lockfile is present but unreadable, so only exact versions written in package.json were eligible for OSV.dev.",
      fix: "Regenerate the lockfile (`pnpm install`) and commit it. Then re-run the audit.",
    });
  }

  const pinnedRefs: DependencyRef[] = resolved.packages.map((pkg) => ({
    name: pkg.name,
    version: pkg.version,
  }));

  if (resolved.unresolvedDirect > 0) {
    manifestFindings.push({
      id: "scan-unpinned",
      file: "package.json",
      severity: "WARNING",
      issue: `${resolved.unresolvedDirect} direct dependencies have no exact version`,
      explanation: lockText === null && !lockTooBig
        ? "Range specifiers (^, ~, *) and a missing usable lockfile mean those packages were not sent to OSV.dev. A clean dependency line would not cover them."
        : "These direct dependencies are neither exact in package.json nor present in the parsed lockfile, so OSV.dev did not see them.",
      fix: "Commit the lockfile and install with `--frozen-lockfile`. Treat the lockfile as the source of truth.",
    });
  }

  if (pinnedRefs.length === 0) return manifestFindings;

  const query = await queryVulnerabilities(pinnedRefs, signal);
  if (query.status === "unavailable") {
    manifestFindings.push({
      id: "scan-osv-unavailable",
      file: "package.json",
      severity: "WARNING",
      issue: "Dependency advisory check unavailable",
      explanation:
        "OSV.dev did not answer, so this audit cannot claim the dependencies are free of known vulnerabilities.",
      fix: "Re-run the audit. If OSV.dev stays unreachable, run `pnpm audit` locally before shipping.",
    });
    return manifestFindings;
  }

  const vulnerabilities = query.vulnerabilities;
  if (vulnerabilities.length === 0 && resolved.unresolvedDirect === 0) {
    manifestFindings.push({
      id: "scan-osv-ok",
      file: "package.json",
      severity: "OK",
      issue: "No known vulnerability from OSV.dev",
      explanation: `Checked ${pinnedRefs.length} versions (lockfile when present, otherwise exact pins) against OSV.dev: none reported.`,
      fix: "Keep a weekly audit in CI and re-pin after each upgrade.",
    });
  } else if (vulnerabilities.length > 0) {
    const severe = vulnerabilities.some(
      (item) => item.highestSeverity === "CRITICAL" || item.highestSeverity === "HIGH",
    );
    const worstSeverity: Severity = severe ? "CRITICAL" : "WARNING";
    const listing = vulnerabilities
      .slice(0, 5)
      .map((item) => `${item.dependency.name}@${item.dependency.version} → ${item.advisoryIds.slice(0, 2).join(", ")}`)
      .join(" ; ");
    manifestFindings.push({
      id: "scan-osv-issues",
      file: "package.json",
      severity: worstSeverity,
      issue: `${vulnerabilities.length} dependencies with published advisories`,
      explanation: `OSV.dev reports advisories for these resolved versions: ${listing}${
        vulnerabilities.length > 5 ? ` (+${vulnerabilities.length - 5} more)` : ""
      }. High and critical advisories are scored as critical. Check each advisory before upgrading.`,
      fix: "Run `pnpm audit` for the full list, then upgrade or override the affected packages; block releases while the audit fails.",
    });
  }

  return manifestFindings;
}

function isHashLib(name: string): boolean {
  const lower = name.toLowerCase();
  return HASH_LIBS.some((lib) => lower === lib);
}

function needsLocalPasswordHash(names: readonly string[]): boolean {
  const hosted = names.some((name) => HOSTED_AUTH.some((pattern) => pattern.test(name)));
  if (hosted) return false;
  return names.some((name) => LOCAL_AUTH.some((pattern) => pattern.test(name)));
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
  token: string | undefined,
  signal: AbortSignal,
): Promise<string | null> {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const rawUrl = `${RAW_BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodedPath}`;
  const fromRaw = await fetchText(rawUrl, token, signal);
  if (fromRaw !== null) return fromRaw;
  if (token === undefined) return null;

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
  return fetchText(apiUrl, token, signal, "application/vnd.github.raw");
}

async function fetchText(
  url: string,
  token: string | undefined,
  signal: AbortSignal,
  accept?: string,
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {};
    if (token !== undefined) headers.Authorization = `Bearer ${token}`;
    if (accept !== undefined) {
      headers.Accept = accept;
      headers["X-GitHub-Api-Version"] = "2022-11-28";
      headers["User-Agent"] = "guardvibe-scan";
    }
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }
}

const ENV_TEMPLATE_RE =
  /^\.env(?:\.[A-Za-z0-9_-]+)*\.(?:example|sample|template|dist|defaults)$/;

function isEnvFile(base: string): boolean {
  return /^\.env(?:\..+)?$/.test(base);
}

function isEnvTemplate(base: string): boolean {
  return ENV_TEMPLATE_RE.test(base);
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
