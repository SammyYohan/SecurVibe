export type PlanId = "free" | "essential" | "pro" | "team" | "pack";

export type PlanPrice = {
  /** Prix mensuel de référence (USD/EUR identiques à la source). */
  monthly: number;
  /** Facturation annuelle (10 x le mensuel = 2 mois offerts). */
  yearlyTotal: number;
};

export const PLAN_PRICES: Record<PlanId, PlanPrice> = {
  free: { monthly: 0, yearlyTotal: 0 },
  essential: { monthly: 9, yearlyTotal: 90 },
  pro: { monthly: 24, yearlyTotal: 240 },
  team: { monthly: 79, yearlyTotal: 790 },
  pack: { monthly: 12, yearlyTotal: 12 }, // unique, à l'unité
};

export function yearlyMonthlyEquivalent(plan: PlanId): number {
  return PLAN_PRICES[plan].yearlyTotal / 12;
}

/** Lien de paiement Stripe optionnel par plan (variables d'env). */
export function checkoutHref(plan: PlanId): string | null {
  if (plan === "free") return null;
  const envKey = plan === "pack" ? "STRIPE_LINK_PACK" : `STRIPE_LINK_${plan.toUpperCase()}`;
  const value = process.env[envKey];
  if (typeof value === "string" && value.startsWith("https://")) return value;
  return null;
}
