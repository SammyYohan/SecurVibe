import "server-only";

import { z } from "zod";
import { isAbortError } from "@/lib/sleep";

/**
 * OSV.dev client (open source vulnerability database, free, no key).
 * An outage is never reported as "no vulnerabilities".
 */

export type DependencyRef = { name: string; version: string };

export type AdvisorySeverity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";

export type DependencyVulnerability = {
  dependency: DependencyRef;
  /** Advisory identifiers (GHSA-, CVE-…). */
  advisoryIds: string[];
  highestSeverity: AdvisorySeverity;
};

export type VulnQueryResult =
  | { status: "ok"; vulnerabilities: DependencyVulnerability[] }
  | { status: "unavailable" };

const BATCH_SIZE = 100;

const osvBatchResponseSchema = z.object({
  results: z
    .array(
      z.object({
        vulns: z
          .array(
            z.object({
              id: z.string(),
              aliases: z.array(z.string()).optional(),
              severity: z
                .array(
                  z.object({
                    type: z.string().optional(),
                    score: z.string().optional(),
                  }),
                )
                .optional(),
              database_specific: z
                .object({ severity: z.string().optional() })
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

const SEVERITY_RANK: Record<AdvisorySeverity, number> = {
  UNKNOWN: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

/** Checks npm dependencies against OSV.dev. */
export async function queryVulnerabilities(
  dependencies: readonly DependencyRef[],
  signal: AbortSignal,
): Promise<VulnQueryResult> {
  if (dependencies.length === 0) return { status: "ok", vulnerabilities: [] };

  const vulnerabilities: DependencyVulnerability[] = [];
  try {
    for (let offset = 0; offset < dependencies.length; offset += BATCH_SIZE) {
      const slice = dependencies.slice(offset, offset + BATCH_SIZE);
      const batch = await queryBatch(slice, signal);
      if (batch === null) return { status: "unavailable" };
      vulnerabilities.push(...batch);
    }
    return { status: "ok", vulnerabilities };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { status: "unavailable" };
  }
}

async function queryBatch(
  dependencies: readonly DependencyRef[],
  signal: AbortSignal,
): Promise<DependencyVulnerability[] | null> {
  const response = await fetch("https://api.osv.dev/v1/querybatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      queries: dependencies.map((dependency) => ({
        package: { name: dependency.name, ecosystem: "npm" },
        version: dependency.version,
      })),
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
    cache: "no-store",
  });
  if (!response.ok) return null;

  const data = osvBatchResponseSchema.safeParse(await response.json());
  if (!data.success) return null;

  const vulnerabilities: DependencyVulnerability[] = [];
  dependencies.forEach((dependency, index) => {
    const vulns = data.data.results?.[index]?.vulns;
    if (vulns === undefined || vulns.length === 0) return;

    const ids = new Set<string>();
    let highest: AdvisorySeverity = "UNKNOWN";
    for (const vuln of vulns) {
      ids.add(vuln.id);
      for (const alias of vuln.aliases ?? []) ids.add(alias);
      const severity = classifySeverity(vuln);
      if (SEVERITY_RANK[severity] > SEVERITY_RANK[highest]) highest = severity;
    }
    vulnerabilities.push({
      dependency,
      advisoryIds: [...ids].slice(0, 5),
      highestSeverity: highest,
    });
  });
  return vulnerabilities;
}

function classifySeverity(vuln: {
  severity?: Array<{ score?: string }>;
  database_specific?: { severity?: string };
}): AdvisorySeverity {
  const label = vuln.database_specific?.severity?.toUpperCase();
  const fromLabel = severityFromLabel(label);
  let best: AdvisorySeverity = fromLabel;

  for (const item of vuln.severity ?? []) {
    const numeric = Number(item.score);
    if (!Number.isFinite(numeric)) continue;
    const fromScore = severityFromScore(numeric);
    if (SEVERITY_RANK[fromScore] > SEVERITY_RANK[best]) best = fromScore;
  }
  return best;
}

function severityFromLabel(label: string | undefined): AdvisorySeverity {
  if (label === "CRITICAL") return "CRITICAL";
  if (label === "HIGH") return "HIGH";
  if (label === "MODERATE" || label === "MEDIUM") return "MODERATE";
  if (label === "LOW") return "LOW";
  return "UNKNOWN";
}

function severityFromScore(score: number): AdvisorySeverity {
  if (score >= 9) return "CRITICAL";
  if (score >= 7) return "HIGH";
  if (score >= 4) return "MODERATE";
  return "LOW";
}
