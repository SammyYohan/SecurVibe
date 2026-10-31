import "server-only";

import { z } from "zod";

const optionalSecretSchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
  });

const optionalUrlSchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    if (trimmed === undefined || trimmed === "") return undefined;
    return trimmed;
  })
  .refine((value) => {
    if (value === undefined) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Doit être une URL https:// valide.");

const stripeLinkSchema = optionalUrlSchema;

const serverEnvSchema = z.object({
  // Token GitHub optionnel : augmente le quota de scanning serveur (60 -> 5000/h).
  GITHUB_TOKEN: optionalSecretSchema,
  // Secret de signature des clés de licence (32 caractères minimum).
  // Absent : toutes les clés sont refusées et le plan gratuit s'applique.
  LICENSE_SECRET: optionalSecretSchema,
  // Liens de paiement Stripe (Payment Links) par plan — optionnels en beta.
  STRIPE_LINK_ESSENTIAL: stripeLinkSchema,
  STRIPE_LINK_PRO: stripeLinkSchema,
  STRIPE_LINK_TEAM: stripeLinkSchema,
  STRIPE_LINK_PACK: stripeLinkSchema,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

/**
 * Validation stricte des variables serveur (cache en mémoire du process).
 * Lève une erreur si une variable fournie est invalide — convertie
 * en événement INTERNAL_ERROR par la route, jamais de détail au client.
 */
export function getServerEnv(): ServerEnv {
  if (cachedEnv !== null) return cachedEnv;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Variables d'environnement serveur invalides.");
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}
