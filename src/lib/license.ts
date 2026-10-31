import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import { isPlanId, type PlanId } from "@/lib/plans";

/**
 * Clés de licence signées — vérifiées côté serveur, sans base de données.
 *
 * Format : `gv1.<payload base64url>.<signature base64url>`
 *   payload    : JSON `{ sub, plan, iat, exp }` (exp en secondes, null = sans fin)
 *   signature  : HMAC-SHA256 de `gv1.<payload>` avec `LICENSE_SECRET`
 *
 * Une clé est un porteur : elle peut être partagée. C'est le prix de
 * l'absence de compte ; les limites restent appliquées côté serveur.
 */

const VERSION = "gv1";
const MAX_KEY_LENGTH = 512;

export type LicenseClaims = {
  /** Identifiant de commande (ex. identifiant Stripe). */
  id: string;
  plan: PlanId;
  /** Fin de validité (ms epoch), null = sans expiration. */
  expiresAt: number | null;
};

function readSecret(): string | null {
  try {
    return getServerEnv().LICENSE_SECRET ?? null;
  } catch {
    return null;
  }
}

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${VERSION}.${payload}`).digest();
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

/** Renvoie les droits portés par la clé, ou null si la clé est invalide/expirée. */
export function verifyLicense(key: string): LicenseClaims | null {
  if (key.length === 0 || key.length > MAX_KEY_LENGTH) return null;

  const secret = readSecret();
  if (secret === null) return null;

  const parts = key.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  const payload = parts[1];
  const signature = parts[2];
  if (payload === undefined || signature === undefined) return null;

  const expected = sign(payload, secret);
  let provided: Buffer;
  try {
    provided = decodeBase64Url(signature);
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(decodeBase64Url(payload).toString("utf8"));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;

  const claims = raw as { sub?: unknown; plan?: unknown; exp?: unknown };
  if (typeof claims.sub !== "string" || claims.sub.length === 0) return null;
  if (typeof claims.plan !== "string" || !isPlanId(claims.plan)) return null;

  let expiresAt: number | null = null;
  if (claims.exp !== null && claims.exp !== undefined) {
    if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) return null;
    expiresAt = claims.exp * 1000;
    if (Date.now() >= expiresAt) return null;
  }

  return { id: claims.sub, plan: claims.plan, expiresAt };
}
