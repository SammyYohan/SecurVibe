import "server-only";

import { getServerEnv } from "@/lib/env";
import {
  AUDITS_PER_DAY,
  AUDITS_PER_MINUTE,
  GLOBAL_DAILY_AUDITS,
  MAX_CONCURRENT_AUDITS,
} from "@/lib/plans";
import { consumeDailyAudit, rateLimit } from "@/lib/rateLimit";

/**
 * Quota d'usage du service gratuit, pensé pour un hébergement serverless
 * (Vercel) où la mémoire d'une instance ne dure pas :
 *
 *  1. garde-fou mémoire par instance (fenêtre minute) — instantané, protège
 *     l'instance même si le store partagé est lent ou absent ;
 *  2. store partagé Upstash Redis via son API REST (2 appels fetch, aucun
 *     SDK) : compteur minute par IP, compteur journalier par IP (clé datée
 *     UTC, reset à minuit) et plafond global journalier ;
 *  3. repli mémoire (quota journalier) quand Upstash n'est pas configuré ou
 *     injoignable — le service continue, la précision est moindre.
 *
 * En cas d'erreur du store partagé, la décision est « fail-open » : mieux
 * vaut laisser passer un audit que couper le service entier. Les autres
 * protections (garde mémoire, plafond de concurrence, quotas GitHub)
 * restent actives.
 */

export type QuotaReason = "minute" | "daily" | "global";

export type QuotaResult =
  | { ok: true; store: "redis" | "memory" }
  | {
      ok: false;
      reason: QuotaReason;
      retryAfterSeconds: number;
    };

const RETRY_AFTER_MINUTE = 60;
const DAY_TTL_MS = String(26 * 3600 * 1000); // marge au-delà de 24 h
const UPSTASH_TIMEOUT_MS = 2_000;

function secondsUntilNextUtcDay(now = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}

/** Un pipeline Upstash : un aller-retour HTTP pour les 6 commandes. */
async function upstashPipeline(
  commands: Array<[string, string, ...string[]]>,
): Promise<Array<[unknown, unknown]> | null> {
  let url: string | undefined;
  let token: string | undefined;
  try {
    const env = getServerEnv();
    url = env.UPSTASH_REDIS_REST_URL;
    token = env.UPSTASH_REDIS_REST_TOKEN;
  } catch {
    return null;
  }
  if (url === undefined || token === undefined) return null;

  try {
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!Array.isArray(body) || body.length !== commands.length) return null;
    return body as Array<[unknown, unknown]>;
  } catch (error) {
    console.error(
      "[guardvibe] Shared quota store unavailable (fail-open).",
      error instanceof Error ? error.name : typeof error,
    );
    return null;
  }
}

/** Fenêtre minute, quota journalier par IP et plafond global via Upstash. */
async function redisCheck(ip: string): Promise<QuotaResult | null> {
  const day = new Date().toISOString().slice(0, 10); // UTC yyyy-mm-dd
  const minuteKey = `gv:m:${ip}`;
  const dailyKey = `gv:d:${day}:${ip}`;
  const globalKey = `gv:g:${day}`;

  const results = await upstashPipeline([
    ["INCR", minuteKey],
    ["PEXPIRE", minuteKey, "70000"],
    ["INCR", dailyKey],
    ["PEXPIRE", dailyKey, DAY_TTL_MS],
    ["INCR", globalKey],
    ["PEXPIRE", globalKey, DAY_TTL_MS],
  ]);
  if (results === null) return null;

  const readCount = (index: number): number => {
    const entry = results[index];
    const value = entry?.[0];
    return typeof value === "number" ? value : Number(value) || 0;
  };
  const minuteCount = readCount(0);
  const dailyCount = readCount(2);
  const globalCount = readCount(4);

  if (minuteCount > AUDITS_PER_MINUTE) {
    return { ok: false, reason: "minute", retryAfterSeconds: RETRY_AFTER_MINUTE };
  }
  if (dailyCount > AUDITS_PER_DAY) {
    return {
      ok: false,
      reason: "daily",
      retryAfterSeconds: secondsUntilNextUtcDay(),
    };
  }
  if (globalCount > GLOBAL_DAILY_AUDITS) {
    return {
      ok: false,
      reason: "global",
      retryAfterSeconds: secondsUntilNextUtcDay(),
    };
  }
  return { ok: true, store: "redis" };
}

/** Point d'entrée : consomme une place de quota ou refuse avec un motif. */
export async function checkDailyQuota(ip: string): Promise<QuotaResult> {
  // L1 — mémoire locale : protège l'instance sans dépendance réseau.
  const localMinute = rateLimit(ip, AUDITS_PER_MINUTE);
  if (localMinute.ok === false) {
    return {
      ok: false,
      reason: "minute",
      retryAfterSeconds: Math.ceil(localMinute.retryAfterMs / 1000),
    };
  }

  // L2 — store partagé (compteurs valables à travers les instances).
  const shared = await redisCheck(ip);
  if (shared !== null) return shared;

  // Repli : sans store partagé, seuls les garde-fous mémoire s'appliquent.
  const localDaily = consumeDailyAudit(ip, AUDITS_PER_DAY);
  if (localDaily.ok === false) {
    return {
      ok: false,
      reason: "daily",
      retryAfterSeconds: Math.ceil(localDaily.retryAfterMs / 1000),
    };
  }
  return { ok: true, store: "memory" };
}

// ---------------------------------------------------------------------------
// Garde-fou de concurrence (par instance) : borne le nombre d'audits
// exécutés en même temps pour que le trafic ne fasse pas crasher le service.
// ---------------------------------------------------------------------------

let inFlightAudits = 0;

export function acquireAuditSlot(): boolean {
  if (inFlightAudits >= MAX_CONCURRENT_AUDITS) return false;
  inFlightAudits += 1;
  return true;
}

export function releaseAuditSlot(): void {
  inFlightAudits = Math.max(0, inFlightAudits - 1);
}
