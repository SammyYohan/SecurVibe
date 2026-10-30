import "server-only";

import { z } from "zod";
import { isAbortError } from "@/lib/sleep";

/**
 * Client OSV.dev (base de vulnérabilités open source, gratuite, sans clé).
 * Une seule requête batch pour tout le manifeste — coût réseau minimal.
 */

export type DependencyRef = { name: string; version: string };

export type DependencyVulnerability = {
  dependency: DependencyRef;
  /** Identifiants d'avis (GHSA-, CVE-…). */
  advisoryIds: string[];
};

const osvBatchResponseSchema = z.object({
  results: z
    .array(
      z.object({
        vulns: z
          .array(
            z.object({
              id: z.string(),
              aliases: z.array(z.string()).optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

/** Vérifie les dépendances npm contre OSV.dev. En cas d'indisponibilité: pas de faux positif. */
export async function queryVulnerabilities(
  dependencies: readonly DependencyRef[],
  signal: AbortSignal,
): Promise<DependencyVulnerability[]> {
  try {
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
    if (!response.ok) return [];

    const data = osvBatchResponseSchema.safeParse(await response.json());
    if (!data.success) return [];

    const vulnerabilities: DependencyVulnerability[] = [];
    dependencies.forEach((dependency, index) => {
      const result = data.data.results?.[index];
      const vulns = result?.vulns;
      if (vulns !== undefined && vulns.length > 0) {
        const ids = new Set<string>();
        for (const vuln of vulns) {
          ids.add(vuln.id);
          for (const alias of vuln.aliases ?? []) ids.add(alias);
        }
        vulnerabilities.push({
          dependency,
          advisoryIds: [...ids].slice(0, 5),
        });
      }
    });
    return vulnerabilities;
  } catch (error) {
    if (isAbortError(error)) throw error;
    return []; // OSV indisponible: pas de fausse alerte
  }
}
