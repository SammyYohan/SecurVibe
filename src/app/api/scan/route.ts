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
 * Vercel : un audit enchaîne jusqu'à 200 lectures GitHub puis 4 contrôles
 * HTTP/TLS. Sur le plan Hobby, 60 s est le maximum par fonction : sans cette
 * valeur, la durée par défaut peut couper le flux avant l'événement "done".
 */
export const maxDuration = 60;

const UNLOCK_STEP_ID = 4;

const GENERIC_ERROR_MESSAGE = "An unexpected error occurred during the audit.";

/** Plages de progression allouées à chaque service dans le flux global. */
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

    // Quota d'usage gratuit : fenêtre minute + plafond journalier par IP
    // + plafond global journalier (store partagé Upstash, repli mémoire).
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    const quota = await checkDailyQuota(ip);
    if (quota.ok === false) {
      const message =
        quota.reason === "minute"
          ? "Too many audits in a short time. Wait a minute and retry."
          : quota.reason === "daily"
            ? `Daily audit limit reached for this network (${AUDITS_PER_DAY} per day). It resets at midnight UTC.`
            : "The free daily capacity of GuardVibe is currently used up. Come back in a few hours.";
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

    // Garde-fou de concurrence par instance : le service ne peut pas être
    // saturé par un pic (chaque audit tient le flux ~30 à 60 s).
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

    // Un seul contrôleur d'annulation: requête client + cancel() du flux.
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
            isClosed = true; // contrôleur déjà fermé
          }
        };

        const closeStream = (): void => {
          if (isClosed) return;
          isClosed = true;
          try {
            streamController.close();
          } catch {
            // Déjà fermé par l'environnement.
          }
        };

        try {
          getServerEnv();

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
            // scanError est déjà un ScanEvent error valide (code + message).
            send(scanError);
            return; // pas d'audit site si le scan échoue
          }

          // Audit de production (réel) — inclus pour tout le monde, exécuté
          // uniquement si l'URL est fournie et si la connexion tient.
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
              "[guardvibe] Unexpected error during audit.",
              error instanceof Error ? error.name : typeof error,
            );
            send({ type: "error", code: "INTERNAL_ERROR", message: GENERIC_ERROR_MESSAGE });
          }
          // Annulation: fermeture silencieuse, sans événement d'erreur.
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
    // Invalides/inattendus au niveau de l'enveloppe: jamais de stack au client.
    console.error(
      "[guardvibe] Unexpected error while starting the audit.",
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
  // Le token ne transite QUE dans cette requête; jamais persisté.
  return {
    repoUrl: parsed.data.repoUrl,
    productionUrl: parsed.data.productionUrl,
    githubToken: parsed.data.githubToken,
  };
}

function respond400(code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status: 400, headers: { "Cache-Control": "no-store" } });
}
