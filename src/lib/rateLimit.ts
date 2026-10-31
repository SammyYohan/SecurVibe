import "server-only";

/**
 * Limiteur de requêtes en mémoire (par instance).
 * Protège l'endpoint public des abus ; suffisant pour une instance unique.
 * Les plans payants profitent d'un quota plus élevé (dépassé: HTTP 429).
 */
type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const buckets = new Map<string, Bucket>();
const dailyBuckets = new Map<string, Bucket>();

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

/**
 * Quota d'audits du plan gratuit, par IP et par fenêtre de 24 h.
 * En mémoire (par instance) : c'est un garde-fou d'usage loyal, pas une
 * comptabilité de facturation.
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

/** Nettoyage périodique léger pour éviter la croissance indéfinie. */
export function pruneRateLimitBuckets(): void {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(ip);
  }
  for (const [ip, bucket] of dailyBuckets) {
    if (now >= bucket.resetAt) dailyBuckets.delete(ip);
  }
}
