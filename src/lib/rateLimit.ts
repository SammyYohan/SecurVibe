import "server-only";

/**
 * Limiteur de requêtes en mémoire (par instance).
 * Protège l'endpoint public des abus ; suffisant pour une instance unique.
 * Les plans payants profitent d'un quota plus élevé (dépassé: HTTP 429).
 */
type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const buckets = new Map<string, Bucket>();

/** 12 requêtes/minute/IP par défaut. */
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

/** Nettoyage périodique léger pour éviter la croissance indéfinie. */
export function pruneRateLimitBuckets(): void {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(ip);
  }
}
