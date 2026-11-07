import type { Severity } from "@/types";

/**
 * Secret rules. The patterns are public key shapes (prefix + alphabet),
 * never a real key.
 * The matched text is not copied into the finding.
 */

export type SecretRule = {
  id: string;
  severity: Severity;
  regex: RegExp;
};

export type SecretMatch = {
  rule: SecretRule;
  line: number;
  /** The line exposes the value to the browser (NEXT_PUBLIC_, VITE_…). */
  clientExposed: boolean;
};

export const MAX_SECRETS_PER_FILE = 3;
export const MAX_SECRET_FINDINGS = 25;

const HIGH_CONFIDENCE = new Set([
  "rule-github-pat",
  "rule-stripe-secret",
  "rule-stripe-restricted",
  "rule-openai-key",
  "rule-anthropic-key",
  "rule-aws-access-key",
  "rule-gitlab-pat",
  "rule-private-key",
  "rule-slack-webhook",
]);

export const RULES: readonly SecretRule[] = [
  { id: "rule-github-pat", severity: "CRITICAL", regex: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { id: "rule-stripe-secret", severity: "CRITICAL", regex: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { id: "rule-stripe-restricted", severity: "CRITICAL", regex: /\brk_live_[A-Za-z0-9]{16,}\b/ },
  { id: "rule-stripe-webhook", severity: "WARNING", regex: /\bwhsec_[A-Za-z0-9]{16,}\b/ },
  { id: "rule-openai-key", severity: "CRITICAL", regex: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/ },
  { id: "rule-anthropic-key", severity: "CRITICAL", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { id: "rule-aws-access-key", severity: "CRITICAL", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    id: "rule-aws-secret",
    severity: "CRITICAL",
    regex: /(?:aws_secret_access_key|secret_access_key)\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}/i,
  },
  { id: "rule-slack-token", severity: "CRITICAL", regex: /\bxox[beas]-[A-Za-z0-9-]{10,}\b/ },
  {
    id: "rule-slack-webhook",
    severity: "CRITICAL",
    regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/,
  },
  { id: "rule-gitlab-pat", severity: "CRITICAL", regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/ },
  { id: "rule-private-key", severity: "CRITICAL", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: "rule-npm-token", severity: "CRITICAL", regex: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { id: "rule-resend-key", severity: "WARNING", regex: /\bre_[A-Za-z0-9]{20,}\b/ },
  { id: "rule-google-api-key", severity: "WARNING", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    id: "rule-signed-jwt",
    severity: "CRITICAL",
    regex: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/,
  },
  {
    id: "rule-database-url",
    severity: "CRITICAL",
    regex: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s'":/]+:[^\s'":@]{8,}@[^\s'"]+/i,
  },
  {
    id: "rule-hardcoded-credential",
    severity: "WARNING",
    regex: /(?:password|passwd|api[_-]?key|secret)[A-Za-z0-9_ "'-]*\s*[:=]\s*["'][A-Za-z0-9+/=_-]{16,}["']/i,
  },
];

const CLIENT_EXPOSURE = /NEXT_PUBLIC_|VITE_|PUBLIC_|import\.meta\.env/i;

const PLACEHOLDER =
  /example|changeme|placeholder|your[-_ ]?(api[-_ ]?)?key|redacted|dummy|fake|xxxx+|<.*>|password@|user:password/i;

const LOCAL_DB = /localhost|127\.0\.0\.1|0\.0\.0\.0|example\.com/i;

export type RuleCopy = { issue: string; explanation: string; fix: string };

export const RULE_COPY: Record<string, RuleCopy> = {
  "rule-github-pat": {
    issue: "GitHub personal access token committed",
    explanation:
      "A GitHub token is present in this file. Anyone with read access to the repository can retrieve it and act with your account or organization permissions — leaked tokens are harvested automatically within minutes.",
    fix: "1. Revoke the token (GitHub → Settings → Developer settings).\n2. Remove it from the code and purge the history where needed.\n3. Read secrets from a server-only environment variable validated with zod.",
  },
  "rule-stripe-secret": {
    issue: "Stripe secret key committed",
    explanation:
      "A live Stripe secret key appears in the source. Leaked, it grants full control over payments and customer data of the linked account.",
    fix: "1. Rotate the key in the Stripe dashboard immediately.\n2. Call Stripe from a server-side route only, with the key read from a validated environment variable (never NEXT_PUBLIC_).",
  },
  "rule-stripe-restricted": {
    issue: "Stripe restricted key committed",
    explanation:
      "A live Stripe restricted key is committed. Its scopes may still read or move money and customer data.",
    fix: "1. Roll the key in the Stripe dashboard.\n2. Keep the replacement in a server-only environment variable.",
  },
  "rule-stripe-webhook": {
    issue: "Stripe webhook secret committed",
    explanation:
      "A webhook signing secret is committed. With it, an attacker can forge Stripe events your server will trust.",
    fix: "Roll the endpoint secret in the Stripe dashboard and read it from a server-only environment variable.",
  },
  "rule-openai-key": {
    issue: "OpenAI API key committed",
    explanation: "An OpenAI key is readable in code; it can bill prompts on your account or reveal prompt content.",
    fix: "1. Revoke the key on platform.openai.com.\n2. Call the provider from the server only, reading the key from a validated environment variable.",
  },
  "rule-anthropic-key": {
    issue: "Anthropic API key committed",
    explanation: "An Anthropic key is readable in code and can be used to bill the linked account.",
    fix: "Revoke it in the Anthropic console and read the replacement from a server-only environment variable.",
  },
  "rule-aws-access-key": {
    issue: "AWS access key committed",
    explanation:
      "An AWS access key id appears in source. Bots scan public repositories for these keys within minutes to abuse cloud privileges.",
    fix: "1. Deactivate the key pair in IAM right away.\n2. Prefer short-lived roles (OIDC federation) instead of static keys in code.",
  },
  "rule-aws-secret": {
    issue: "AWS secret access key committed",
    explanation: "An AWS secret access key is assigned in source. Paired with an access key id, it opens the account.",
    fix: "Deactivate the key pair in IAM and move both values to a secret manager. Prefer OIDC roles.",
  },
  "rule-slack-token": {
    issue: "Slack token committed",
    explanation: "A Slack bot or user token is committed; message history, channels and webhooks can be read or manipulated.",
    fix: "Rotate it in Slack App Management, restrict scopes, and keep the value in a server-side environment variable.",
  },
  "rule-slack-webhook": {
    issue: "Slack incoming webhook committed",
    explanation: "A Slack webhook URL can post into the linked channel until it is revoked.",
    fix: "Regenerate the webhook in Slack and store the URL in a server-only environment variable.",
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
  "rule-npm-token": {
    issue: "npm access token committed",
    explanation: "An npm token can publish or read private packages under the linked account.",
    fix: "Revoke the token on npmjs.com and inject a new one as a CI secret, not as a file in git.",
  },
  "rule-resend-key": {
    issue: "Resend API key committed",
    explanation: "A Resend key can send mail as your domain and read the account's sending activity.",
    fix: "Roll the key in the Resend dashboard and read it from a server-only environment variable.",
  },
  "rule-google-api-key": {
    issue: "Google API key committed",
    explanation:
      "A Google API key is committed. Browser keys are common, and unrestricted keys can spend quota on paid APIs.",
    fix: "Restrict the key by API and HTTP referrer (or rotate it) and avoid embedding unrestricted keys.",
  },
  "rule-signed-jwt": {
    issue: "Signed JWT committed",
    explanation:
      "A signed JWT appears in code. Supabase service-role keys are JWTs: committed, they bypass row-level security for as long as they stay valid.",
    fix: "Remove token literals from code. Mint short-lived tokens on the server. Never ship a service-role key to the browser.",
  },
  "rule-database-url": {
    issue: "Database URL with a password committed",
    explanation: "A connection string includes a password. Anyone who can read the file can connect to the database.",
    fix: "Rotate the database password and move the URL to a server-only environment variable.",
  },
  "rule-hardcoded-credential": {
    issue: "Possible hardcoded credential",
    explanation:
      "A long opaque value is assigned to a password/API key-like variable. It may be a real secret or a throwaway — both deserve a review.",
    fix: "Replace it with an environment variable validated server-side, and add secret-scanning in CI to catch regressions.",
  },
};

export function findSecrets(content: string, limit = MAX_SECRETS_PER_FILE): SecretMatch[] {
  const lines = content.split("\n");
  const found: SecretMatch[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const rule of RULES) {
      rule.regex.lastIndex = 0;
      if (!rule.regex.test(line)) continue;
      if (shouldSkip(rule, line)) continue;
      found.push({
        rule,
        line: index + 1,
        clientExposed: CLIENT_EXPOSURE.test(line),
      });
      if (found.length >= limit) return found;
      break;
    }
  }
  return found;
}

function shouldSkip(rule: SecretRule, line: string): boolean {
  if (HIGH_CONFIDENCE.has(rule.id)) return false;
  if (PLACEHOLDER.test(line)) return true;
  if (rule.id === "rule-database-url" && LOCAL_DB.test(line)) return true;
  return false;
}
