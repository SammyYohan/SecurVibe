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
  }, "Must be a valid https:// URL.");

const serverEnvSchema = z.object({
  // Optional GitHub token: raises the server-side scanning quota (60 -> 5000/h).
  GITHUB_TOKEN: optionalSecretSchema,
  // Shared quota store (Upstash Redis, REST API). Missing: the quotas fall
  // back to in-memory (per instance) — the service keeps working.
  UPSTASH_REDIS_REST_URL: optionalUrlSchema,
  UPSTASH_REDIS_REST_TOKEN: optionalSecretSchema,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

/**
 * Strict validation of the server environment variables (cached in the
 * process memory). Throws if a provided variable is invalid — surfaced
 * as an INTERNAL_ERROR by the routes, never leaking details to the client.
 */
export function getServerEnv(): ServerEnv {
  if (cachedEnv !== null) return cachedEnv;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Invalid server environment variables.");
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}
