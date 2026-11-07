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
 * Free-service usage quota, designed for serverless hosting (Vercel)
 * where an instance's memory does not survive between requests:
 *
 *  1. per-instance in-memory guardrail (minute window) — instantaneous,
 *     protects the instance even when the shared store is slow or absent;
 *  2. shared Upstash Redis store through its REST API (2 fetch calls,
 *     no SDK): per-IP minute counter, per-IP daily counter (UTC-dated
 *     key, resets at midnight UTC) and global daily ceiling;
 *  3. in-memory fallback (daily quota) when Upstash is not configured
 *     or unreachable — the service keeps running with lower accuracy.
 *
 * When the shared store fails, the decision is "fail-open": letting one
 * audit through is better than cutting the whole service. The other
 * guardrails (memory guard, concurrency cap, GitHub quotas) stay active.
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
const DAY_TTL_MS = String(26 * 3600 * 1000); // margin beyond 24 h
const UPSTASH_TIMEOUT_MS = 2_000;

function secondsUntilNextUtcDay(now = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}

/** One Upstash pipeline: a single HTTP round-trip for the 6 commands. */
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
      "[securvibe] Shared quota store unavailable (fail-open).",
      error instanceof Error ? error.name : typeof error,
    );
    return null;
  }
}

/** Minute window, per-IP daily quota and global ceiling through Upstash. */
async function redisCheck(ip: string): Promise<QuotaResult | null> {
  const day = new Date().toISOString().slice(0, 10); // UTC yyyy-mm-dd
  const minuteKey = `sv:m:${ip}`;
  const dailyKey = `sv:d:${day}:${ip}`;
  const globalKey = `sv:g:${day}`;

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

/** Entry point: consumes one quota slot or rejects with a reason. */
export async function checkDailyQuota(ip: string): Promise<QuotaResult> {
  // L1 — local memory: protects the instance with no network dependency.
  const localMinute = rateLimit(ip, AUDITS_PER_MINUTE);
  if (localMinute.ok === false) {
    return {
      ok: false,
      reason: "minute",
      retryAfterSeconds: Math.ceil(localMinute.retryAfterMs / 1000),
    };
  }

  // L2 — shared store (counters valid across instances).
  const shared = await redisCheck(ip);
  if (shared !== null) return shared;

  // Fallback: without a shared store, only the memory guardrails apply.
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
// Concurrency guardrail (per instance): bounds the number of audits that
// can run at the same time so a traffic spike cannot crash the service.
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
