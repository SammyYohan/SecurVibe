import "server-only";

/**
 * In-memory rate limiters (per instance, sliding windows).
 * First line of defense against abuse: instant, dependency-free, effective
 * even for a single user. Once deployed multi-instance or serverless, they
 * are complemented by the shared store in `quota.ts` (Upstash Redis).
 */
type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const buckets = new Map<string, Bucket>();
const dailyBuckets = new Map<string, Bucket>();

/** 12 requests/minute/IP by default. */
export function rateLimit(ip: string, limit = 12): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (bucket === undefined || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: Math.max(500, bucket.resetAt - now) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

/**
 * Free-plan audit quota, per IP and per 24 h window.
 * In memory (per instance): this is a fair-use guardrail, not billing
 * accounting.
 */
export function consumeDailyAudit(
  ip: string,
  limit: number,
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = dailyBuckets.get(ip);

  if (bucket === undefined || now >= bucket.resetAt) {
    dailyBuckets.set(ip, { count: 1, resetAt: now + DAY_MS });
    return { ok: true, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: Math.max(1_000, bucket.resetAt - now) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

/** Lightweight periodic cleanup to prevent unbounded growth. */
export function pruneRateLimitBuckets(): void {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(ip);
  }
  for (const [ip, bucket] of dailyBuckets) {
    if (now >= bucket.resetAt) dailyBuckets.delete(ip);
  }
}
