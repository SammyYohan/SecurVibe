import { isAbortError } from "@/lib/sleep";
import { getServerEnv } from "@/lib/env";
import {
  acquireAuditSlot,
  checkDailyQuota,
  releaseAuditSlot,
} from "@/lib/quota";
import { AUDITS_PER_DAY, MAX_AUDIT_FILES } from "@/lib/plans";
import { computeScore } from "@/lib/score";
import { scanRequestSchema } from "@/lib/validation";
import { pruneRateLimitBuckets } from "@/lib/rateLimit";
import { runProductionAudit } from "@/services/siteService";
import { scanRepository } from "@/services/scanService";
import type {
  Finding,
  ProgressRange,
  ScanErrorEvent,
  ScanEvent,
} from "@/types";

export const runtime = "nodejs";

/**
 * Vercel: one audit chains up to 200 GitHub reads then 4 HTTP/TLS checks.
 * On the Hobby plan, 60 s is the per-function maximum: without this value,
 * the default timeout could cut the stream before the "done" event.
 */
export const maxDuration = 60;

const UNLOCK_STEP_ID = 4;

const GENERIC_ERROR_MESSAGE = "An unexpected error occurred during the audit.";

/** Progress ranges allocated to each service in the global flow. */
const SCAN_RANGE: ProgressRange = { from: 0, to: 60 };
const SITE_RANGE: ProgressRange = { from: 60, to: 100 };

const STREAM_HEADERS: Record<string, string> = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  "X-Accel-Buffering": "no",
};

const TOO_MANY_REQUESTS_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request): Promise<Response> {
  let startedController: AbortController | undefined;
  try {
    const tokens = parseScanRequest(await request.json().catch(() => null));
    if (tokens === null) {
      return respond400("INVALID_REQUEST", "Invalid request: provide a GitHub repository URL.");
    }

    // Free-service quota: minute window + per-IP daily ceiling
    // + global daily ceiling (Upstash shared store, memory fallback).
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    const quota = await checkDailyQuota(ip);
    if (quota.ok === false) {
      const message =
        quota.reason === "minute"
          ? "Too many audits in a short time. Wait a minute and retry."
          : quota.reason === "daily"
            ? `Daily audit limit reached for this network (${AUDITS_PER_DAY} per day). It resets at midnight UTC.`
            : "The free daily capacity of SecurVibe is currently used up. Come back in a few hours.";
      return Response.json(
        { error: { code: "RATE_LIMITED", message } },
        {
          status: 429,
          headers: {
            ...TOO_MANY_REQUESTS_HEADERS,
            "Retry-After": String(quota.retryAfterSeconds),
          },
        },
      );
    }
    if (Math.random() < 0.05) pruneRateLimitBuckets();

    // Per-instance concurrency guardrail: the service cannot be saturated
    // by a burst (each audit holds its stream open for ~30–60 s).
    if (acquireAuditSlot() === false) {
      return Response.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "The audit queue is momentarily full. Retry in a few seconds.",
          },
        },
        { status: 429, headers: TOO_MANY_REQUESTS_HEADERS },
      );
    }
    let slotReleased = false;
    const releaseSlot = (): void => {
      if (slotReleased) return;
      slotReleased = true;
      releaseAuditSlot();
    };

    // A single cancellation controller: client request + stream cancel().
    startedController = new AbortController();
    const activeController = startedController;
    const onClientAbort = (): void => activeController.abort();
    if (request.signal.aborted) {
      activeController.abort();
    } else {
      request.signal.addEventListener("abort", onClientAbort, { once: true });
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(streamController) {
        const encoder = new TextEncoder();
        let isClosed = false;

        const send = (event: ScanEvent): void => {
          if (isClosed) return;
          try {
            streamController.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            isClosed = true; // controller already closed
          }
        };

        const closeStream = (): void => {
          if (isClosed) return;
          isClosed = true;
          try {
            streamController.close();
          } catch {
            // Already closed by the environment.
          }
        };

        try {
          try {
            getServerEnv();
          } catch {
            // Env misconfigured: fail-open, the audit proceeds with optional
            // integrations (GitHub token, Upstash) gracefully degraded.
          }

          const findings: Finding[] = [];
          let scanError: ScanErrorEvent | null = null;

          for await (const event of scanRepository(
            {
              repoUrl: tokens.repoUrl,
              githubToken: tokens.githubToken,
              maxFiles: MAX_AUDIT_FILES,
            },
            SCAN_RANGE,
            activeController.signal,
          )) {
            if (event.type === "error") {
              scanError = event;
              break;
            }
            if (event.type === "finding") {
              findings.push(event.finding);
            }
            send(event);
          }

          if (scanError !== null) {
            // scanError is already a valid error ScanEvent (code + message).
            send(scanError);
            return; // no site audit when the scan fails
          }

          // Production audit (real) — included for everyone, run only when
          // the URL is provided and the connection is still alive.
          let journeyFailed = false;
          if (tokens.productionUrl !== undefined && !activeController.signal.aborted) {
            for await (const event of runProductionAudit(
              { productionUrl: tokens.productionUrl },
              SITE_RANGE,
              activeController.signal,
            )) {
              if (event.type === "error") {
                send(event);
                return;
              }
              if (event.type === "finding") {
                findings.push(event.finding);
              }
              if (
                event.type === "test_step" &&
                event.step.id === UNLOCK_STEP_ID &&
                event.step.status === "FAILED"
              ) {
                journeyFailed = true;
              }
              send(event);
            }
          }

          send({
            type: "done",
            score: computeScore(findings, journeyFailed),
            mode: "real",
          });
        } catch (error) {
          if (!isAbortError(error)) {
            console.error(
              "[securvibe] Unexpected error during audit.",
              error instanceof Error
                ? `${error.name}: ${error.message}`
                : typeof error,
            );
            send({ type: "error", code: "INTERNAL_ERROR", message: GENERIC_ERROR_MESSAGE });
          }
          // Cancellation: silent close, no error event.
        } finally {
          request.signal.removeEventListener("abort", onClientAbort);
          releaseSlot();
          closeStream();
        }
      },
      cancel(): void {
        releaseSlot();
        startedController?.abort();
      },
    });

    return new Response(stream, { status: 200, headers: STREAM_HEADERS });
  } catch (error) {
    if (isAbortError(error)) {
      return new Response(null, { status: 499, headers: { "Cache-Control": "no-store" } });
    }
    // Invalid/unexpected at the envelope level: never leak a stack to the client.
    console.error(
      "[securvibe] Unexpected error while starting the audit.",
      error instanceof Error ? error.name : typeof error,
    );
    return respond400("INTERNAL_ERROR", "Could not start the audit. Please retry.");
  }
}

function parseScanRequest(body: unknown): {
  repoUrl: string;
  productionUrl: string | undefined;
  githubToken: string | undefined;
} | null {
  const parsed = scanRequestSchema.safeParse(body);
  if (!parsed.success) return null;
  // The token only transits through this request; it is never persisted.
  return {
    repoUrl: parsed.data.repoUrl,
    productionUrl: parsed.data.productionUrl,
    githubToken: parsed.data.githubToken,
  };
}

function respond400(code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status: 400, headers: { "Cache-Control": "no-store" } });
}
