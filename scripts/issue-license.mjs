#!/usr/bin/env node
/**
 * Émet une clé de licence GuardVibe signée (HMAC-SHA256).
 *
 * Usage :
 *   LICENSE_SECRET="…" node scripts/issue-license.mjs \
 *     --plan pro --id ord_12345 --days 365
 *
 * Le secret doit être identique à la variable LICENSE_SECRET du serveur.
 * À exécuter en local uniquement : la clé produite est envoyée au client.
 */

import { createHmac, randomUUID } from "node:crypto";

const VERSION = "gv1";
const PLANS = new Set(["essential", "pro", "team", "pack"]);

function fail(message) {
  console.error(`Erreur : ${message}`);
  console.error(
    "Usage : LICENSE_SECRET=… node scripts/issue-license.mjs --plan <essential|pro|team|pack> [--id <commande>] [--days <n>] [--no-expiry]",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
function readFlag(name) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

const secret = process.env.LICENSE_SECRET;
if (typeof secret !== "string" || secret.length < 32) {
  fail("LICENSE_SECRET est absent ou trop court (32 caractères minimum).");
}

const plan = readFlag("plan");
if (plan === undefined || !PLANS.has(plan)) fail("--plan doit valoir essential, pro, team ou pack.");

const id = readFlag("id") ?? `lic_${randomUUID()}`;
const noExpiry = args.includes("--no-expiry");
const days = Number(readFlag("days") ?? "365");
if (!noExpiry && (!Number.isFinite(days) || days <= 0)) fail("--days doit être un nombre positif.");

const exp = noExpiry ? null : Math.floor(Date.now() / 1000) + Math.round(days * 86_400);
const payload = Buffer.from(
  JSON.stringify({ sub: id, plan, iat: Math.floor(Date.now() / 1000), exp }),
  "utf8",
).toString("base64url");
const signature = createHmac("sha256", secret).update(`${VERSION}.${payload}`).digest("base64url");
const key = `${VERSION}.${payload}.${signature}`;

console.log(key);
console.error(`\nPlan : ${plan}`);
console.error(`Commande : ${id}`);
console.error(noExpiry ? "Validité : sans expiration" : `Validité : ${days} jours`);
