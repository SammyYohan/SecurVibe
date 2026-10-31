/**
 * Limites des plans — source unique, partagée par le serveur (application
 * réelle) et par la page de tarifs (affichage). Toute promesse commerciale
 * doit correspondre à une valeur de ce fichier.
 */

export const PLAN_IDS = ["free", "essential", "pro", "team", "pack"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export type PlanLimits = {
  /** Nombre maximum de fichiers source analysés par audit. */
  files: number;
  /**
   * Audits autorisés par IP et par fenêtre de 24 h.
   * `null` = pas de plafond au-delà de la protection anti-abus (12/min).
   */
  auditsPerDay: number | null;
  /** L'audit HTTP/TLS du site de production est-il inclus dans ce plan ? */
  productionAudit: boolean;
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { files: 50, auditsPerDay: 5, productionAudit: false },
  essential: { files: 200, auditsPerDay: null, productionAudit: true },
  pro: { files: 500, auditsPerDay: null, productionAudit: true },
  team: { files: 500, auditsPerDay: null, productionAudit: true },
  // Pack : licence de 6 mois sur un projet, audits illimités (pas de compteur
  // prépayé, qui exigerait un stockage serveur persistant).
  pack: { files: 200, auditsPerDay: null, productionAudit: true },
};

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}
