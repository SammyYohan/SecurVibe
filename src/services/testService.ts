import "server-only";

import { sleep, isAbortError } from "@/lib/sleep";
import type { ProgressRange, ScanEvent, StepStatus } from "@/types";

/** Étapes du parcours acheteur testé par l'agent simulé (aucun réseau). */
const STEP_LABELS: readonly string[] = [
  "Accès à la page de tarification...",
  "Clic sur le bouton S'abonner...",
  "Remplissage du formulaire de paiement de test...",
  "Vérification du déblocage du compte utilisateur...",
];

/** Identifiant de la seule étape pouvant échouer. */
const UNLOCK_STEP_ID = 4;

const JOURNEY_FAILURE_DETAIL =
  "Le compte est resté en statut « free » 30 s après le paiement de test.";

/**
 * Simule un agent autonome de type Playwright contre l'URL de production.
 * AUCUNE requête réseau sortante n'est effectuée (mode démo).
 */
export async function* runPurchaseJourney(
  input: { productionUrl: string },
  range: ProgressRange,
  signal: AbortSignal,
): AsyncGenerator<ScanEvent, void, void> {
  try {
    const hostname = resolveHostname(input.productionUrl);

    // Les 4 étapes apparaissent d'un coup, en PENDING.
    for (let index = 0; index < STEP_LABELS.length; index += 1) {
      yield { type: "test_step", step: buildStep(index + 1, "PENDING", hostname) };
    }

    for (let index = 0; index < STEP_LABELS.length; index += 1) {
      const stepId = index + 1;
      yield { type: "test_step", step: buildStep(stepId, "RUNNING", hostname) };

      await sleep(randomIntBetween(600, 1200), signal);

      const finalStatus =
        stepId === UNLOCK_STEP_ID ? resolveFinalStatus(hostname) : "SUCCESS";
      yield {
        type: "test_step",
        step: {
          ...buildStep(stepId, finalStatus, hostname),
          ...(finalStatus === "FAILED" ? { detail: JOURNEY_FAILURE_DETAIL } : {}),
        },
      };

      yield {
        type: "progress",
        value: interpolate(range, stepId, STEP_LABELS.length),
      };
    }
  } catch (error) {
    // Annulation : fin silencieuse, sans événement d'erreur.
    if (!isAbortError(error)) throw error;
  }
}

function buildStep(
  id: number,
  status: StepStatus,
  hostname: string,
): { id: number; label: string; status: StepStatus; timestamp: string } {
  const label = STEP_LABELS[id - 1] ?? `Étape ${id} de ${hostname}`;
  return { id, label, status, timestamp: new Date().toISOString() };
}

function resolveHostname(productionUrl: string): string {
  try {
    return new URL(productionUrl).hostname;
  } catch {
    // Défense en profondeur : la route a déjà validé l'URL.
    throw new Error("URL de production invalide.");
  }
}

/** Déclencheurs de démo sur le nom d'hôte ; hôte inconnu : tirage 50/50. */
function resolveFinalStatus(hostname: string): "SUCCESS" | "FAILED" {
  if (hostname === "fail.example.com") return "FAILED";
  if (hostname === "ok.example.com") return "SUCCESS";
  return Math.random() < 0.5 ? "FAILED" : "SUCCESS";
}

function interpolate(range: ProgressRange, current: number, total: number): number {
  const ratio = current / total;
  return Math.round(range.from + ratio * (range.to - range.from));
}

function randomIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
