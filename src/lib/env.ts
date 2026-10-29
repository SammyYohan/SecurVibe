import "server-only";

import { z } from "zod";

const optionalSecretSchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
  });

const serverEnvSchema = z.object({
  GUARDVIBE_MODE: z.enum(["demo"]).default("demo"),
  GITHUB_TOKEN: optionalSecretSchema,
  OPENAI_API_KEY: optionalSecretSchema,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validation stricte des variables serveur. Lève une erreur si une
 * variable fournie est invalide — propagée en événement INTERNAL_ERROR
 * par la route, jamais en détail technique au client.
 */
export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Variables d'environnement serveur invalides.");
  }
  return parsed.data;
}
