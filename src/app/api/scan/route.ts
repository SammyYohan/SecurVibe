import "server-only";

import { isAbortError } from "@/lib/sleep";
import { getServerEnv } from "@/lib/env";
import { computeScore } from "@/lib/score";
import { scanRequestSchema } from "@/lib/validation";
import { runPurchaseJourney } from "@/services/testService";
import { scanRepository } from "@/services/scanService";
import type {
  Finding,
  ProgressRange,
  ScanErrorEvent,
  ScanEvent,
} from "@/types";

export const runtime = "nodejs";

const PRODUCTION_URL_FALLBACK = "https://mon-saas.com";

const UNLOCK_STEP_ID = 4;

const GENERIC_ERROR_MESSAGE =
  "Une erreur interne est survenue pendant l'analyse.";

/** Plage de progression allouée à chaque service dans le flux global. */
const SCAN_RANGE: ProgressRange = { from: 0, to: 60 };
const JOURNEY_RANGE: ProgressRange = { from: 60, to: 100 };

const STREAM_HEADERS: Record<string, string> = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  "X-Accel-Buffering": "no",
};

export async function POST(request: Request): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return respond400(
        "INVALID_REQUEST",
        "Requête invalide : corps JSON illisible.",
      );
    }

    const parsed = scanRequestSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return respond400(
        "INVALID_URL",
        issue?.message ?? "Requête invalide.",
      );
    }

    const { repoUrl } = parsed.data;
    const productionUrl = parsed.data.productionUrl ?? PRODUCTION_URL_FALLBACK;

    // Un seul contrôleur : relié au signal de la requête ET au cancel()
    // du flux, pour que les générateurs s'arrêtent si le client coupe.
    const controller = new AbortController();
    const onClientAbort = (): void => controller.abort();
    if (request.signal.aborted) {
      controller.abort();
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
            streamController.enqueue(
              encoder.encode(`${JSON.stringify(event)}\n`),
            );
          } catch {
            // Contrôleur déjà fermé : ignorer, le flux est coupé.
            isClosed = true;
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
          let serverEnvReady = true;
          try {
            getServerEnv();
          } catch {
            serverEnvReady = false;
          }
          if (!serverEnvReady) {
            send({
              type: "error",
              code: "INTERNAL_ERROR",
              message:
                "Configuration serveur indisponible. Réessayez plus tard.",
            });
            return;
          }

          const findings: Finding[] = [];
          let scanError: ScanErrorEvent | null = null;

          for await (const event of scanRepository(
            { repoUrl },
            SCAN_RANGE,
            controller.signal,
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
            send(scanError);
            return;
          }

          // Parcours d'achat uniquement si le scan s'est terminé sans erreur
          // et si la connexion du client est toujours active.
          if (controller.signal.aborted) return;

          let journeyFailed = false;
          for await (const event of runPurchaseJourney(
            { productionUrl },
            JOURNEY_RANGE,
            controller.signal,
          )) {
            if (event.type === "error") {
              send(event);
              return;
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

          send({
            type: "done",
            score: computeScore(findings, journeyFailed),
            mode: "demo",
          });
        } catch (error) {
          if (!isAbortError(error)) {
            console.error(
              "[guardvibe] Erreur inattendue pendant l'analyse.",
              error instanceof Error ? error.name : typeof error,
            );
            send({ type: "error", code: "INTERNAL_ERROR", message: GENERIC_ERROR_MESSAGE });
          }
          // Annulation : le flux se ferme sans événement d'erreur.
        } finally {
          request.signal.removeEventListener("abort", onClientAbort);
          closeStream();
        }
      },
      cancel(): void {
        controller.abort();
      },
    });

    return new Response(stream, { status: 200, headers: STREAM_HEADERS });
  } catch (error) {
    // Filet de sécurité : aucune erreur ne doit casser l'échange HTTP.
    if (!isAbortError(error)) {
      console.error(
        "[guardvibe] Erreur inattendue lors du lancement du scan.",
        error instanceof Error ? error.name : typeof error,
      );
      return respond400(
        "INTERNAL_ERROR",
        "Impossible de lancer l'analyse. Réessayez.",
      );
    }
    return new Response(null, { status: 499, headers: { "Cache-Control": "no-store" } });
  }
}

function respond400(code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
