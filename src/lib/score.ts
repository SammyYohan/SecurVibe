import type { Finding } from "@/types";

const CRITICAL_PENALTY = 15;
const WARNING_PENALTY = 5;
const JOURNEY_FAILURE_PENALTY = 10;

/** Fonction pure : utilisée côté serveur (événement "done") et côté client (score provisoire). */
export function computeScore(
  findings: readonly Finding[],
  journeyFailed: boolean,
): number {
  const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
  const warningCount = findings.filter((f) => f.severity === "WARNING").length;

  const penalty =
    CRITICAL_PENALTY * criticalCount +
    WARNING_PENALTY * warningCount +
    (journeyFailed ? JOURNEY_FAILURE_PENALTY : 0);

  return Math.max(0, 100 - penalty);
}

export type ScoreTier = "good" | "medium" | "bad";

export function getScoreTier(score: number): ScoreTier {
  if (score >= 80) return "good";
  if (score >= 50) return "medium";
  return "bad";
}
