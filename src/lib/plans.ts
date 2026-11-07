/**
 * Free-service limits — single source of truth, shared by the server
 * (where the rules are enforced) and the support page (transparency).
 * SecurVibe is 100% free: these quotas exist to make money from no one,
 * they bound the cost of every audit so the service stays stable and
 * available in the long term.
 */

/** Maximum audits per IP in a sliding 60-second window. */
export const AUDITS_PER_MINUTE = 6;

/** Maximum audits per IP per day (UTC calendar day, resets at midnight UTC). */
export const AUDITS_PER_DAY = 30;

/**
 * Global daily ceiling, all IPs combined. Protects the server's GitHub
 * quota (≈ 2 API calls per audit) and the free hosting capacity.
 */
export const GLOBAL_DAILY_AUDITS = 1000;

/** Audits running simultaneously per instance (memory/CPU guardrail). */
export const MAX_CONCURRENT_AUDITS = 3;

/** Maximum number of files analyzed per audit. */
export const MAX_AUDIT_FILES = 200;
