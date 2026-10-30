import "server-only";

import { connect as tlsConnect } from "node:tls";
import { isAbortError } from "@/lib/sleep";
import type {
  ProgressRange,
  ScanEvent,
  StepStatus,
  TestStep,
} from "@/types";

/**
 * Audit RÉEL de l'URL de production (aucune simulation) :
 *  1. accessibilité HTTPS ;
 *  2. redirection HTTP → HTTPS ;
 *  3. certificat TLS (nature réelle via tls.connect) ;
 *  4. en-têtes de sécurité HTTP (CSP, HSTS, X-Frame-Options…).
 * Aucune connexion sortante autre que vers l'URL soumise par l'utilisateur.
 */

export type SiteInput = { productionUrl: string };

const STEP_LABELS: readonly string[] = [
  "Reach the production URL via HTTPS",
  "Check HTTP → HTTPS redirect",
  "Inspect the TLS certificate",
  "Check security HTTP headers",
];

const REQUIRED_HEADERS: readonly { name: string; hint: string }[] = [
  { name: "content-security-policy", hint: "CSP mitigates XSS and injected scripts." },
  { name: "strict-transport-security", hint: "HSTS forces HTTPS for returning visitors." },
  { name: "x-frame-options", hint: "Prevents clickjacking via framing." },
  { name: "x-content-type-options", hint: "Blocks MIME-type sniffing." },
  { name: "referrer-policy", hint: "Controls data leaked via referrers." },
  { name: "permissions-policy", hint: "Restricts powerful browser features." },
];

export async function* runProductionAudit(
  input: SiteInput,
  range: ProgressRange,
  signal: AbortSignal,
): AsyncGenerator<ScanEvent, void, void> {
  try {
    const hostname = safeHostname(input.productionUrl);

    // Les 4 étapes apparaissent immédiatement, en PENDING.
    for (let index = 1; index <= STEP_LABELS.length; index += 1) {
      yield { type: "test_step", step: buildStep(index, "PENDING") };
    }

    // ---- Étape 1: accessibilité HTTPS ------------------------------------
    yield { type: "test_step", step: buildStep(1, "RUNNING") };
    const response = await fetchUrl(input.productionUrl, signal);
    const reachable = response.kind === "reachable";
    yield {
      type: "test_step",
      step: {
        ...buildStep(1, reachable ? "SUCCESS" : "FAILED"),
        detail: reachable
          ? `HTTP ${response.status} received from ${hostname}`
          : response.detail,
      },
    };
    yield { type: "progress", value: interpolate(range, 1, 4) };

    // ---- Étape 2: redirection HTTP → HTTPS ---------------------------------
    yield { type: "test_step", step: buildStep(2, "RUNNING") };
    const httpProbe = await fetchUrl(`http://${hostname}`, signal);
    const redirectOk =
      httpProbe.kind === "reachable" &&
      httpProbe.redirectedTo !== null &&
      httpProbe.redirectedTo.startsWith("https://");
    yield {
      type: "test_step",
      step: {
        ...buildStep(2, redirectOk ? "SUCCESS" : "FAILED"),
        detail: redirectOk
          ? `HTTP traffic redirected to ${httpProbe.redirectedTo}`
          : "Plain HTTP requests are not redirected to HTTPS automatically.",
      },
    };
    yield { type: "progress", value: interpolate(range, 2, 4) };

    // ---- Étape 3: certificat TLS --------------------------------------------
    yield { type: "test_step", step: buildStep(3, "RUNNING") };
    const certificate = reachable ? await inspectTls(hostname, signal) : { daysLeft: null, reason: "Site unreachable: TLS not checked." };
    const tlsFailed = certificate.daysLeft === null || certificate.daysLeft <= 7;
    yield {
      type: "test_step",
      step: {
        ...buildStep(3, tlsFailed ? "FAILED" : "SUCCESS"),
        detail:
          certificate.daysLeft !== null
            ? `Certificate valid for ${certificate.daysLeft} more days`
            : (certificate.reason ?? "Certificate could not be inspected."),
      },
    };
    yield { type: "progress", value: interpolate(range, 3, 4) };

    // ---- Étape 4: en-têtes de sécurité ----------------------------------------
    yield { type: "test_step", step: buildStep(4, "RUNNING") };
    const missingHeaders: string[] = [];
    const headerHints: string[] = [];
    if (response.kind === "reachable") {
      for (const required of REQUIRED_HEADERS) {
        if (!response.headers.has(required.name)) {
          missingHeaders.push(required.name);
          headerHints.push(`• ${required.name}: ${required.hint}`);
        }
      }
    }
    const headersFailed = missingHeaders.length >= 3;
    yield {
      type: "test_step",
      step: {
        ...buildStep(4, headersFailed ? "FAILED" : "SUCCESS"),
        detail:
          missingHeaders.length === 0
            ? "All key security headers present (CSP, HSTS, X-Frame-Options…)"
            : `Missing headers: ${missingHeaders.slice(0, 6).join(", ")}`,
      },
    };

    // Constats actionnables réels (les mêmes règles de gravité que le scan).
    if (reachable && missingHeaders.length > 0) {
      yield {
        type: "finding",
        finding: {
          id: "site-missing-headers",
          file: `https://${hostname}`,
          severity: missingHeaders.length >= 3 ? "CRITICAL" : "WARNING",
          issue: `${missingHeaders.length} security header(s) missing on production`,
          explanation: `These headers are absent from the HTTP response:\n${headerHints.join("\n")}\nThey are the cheapest large risk-reducers: a single config file in your hosting dashboard.`,
          fix: "Example for a Node host or a reverse proxy (set on all responses, including errors):\n\nContent-Security-Policy: default-src 'self'; frame-ancestors 'none'\nStrict-Transport-Security: max-age=31536000; includeSubDomains\nX-Frame-Options: DENY\nX-Content-Type-Options: nosniff\nReferrer-Policy: strict-origin-when-cross-origin\nPermissions-Policy: camera=(), microphone=(), geolocation=()",
        },
      };
    }
    if (certificate.daysLeft !== null && certificate.daysLeft <= 30) {
      yield {
        type: "finding",
        finding: {
          id: "site-tls-expiry",
          file: `https://${hostname}`,
          severity: certificate.daysLeft <= 14 ? "CRITICAL" : "WARNING",
          issue: `TLS certificate expires in ${certificate.daysLeft} days`,
          explanation: "An expired certificate breaks all traffic with a full-screen warning; automated users and search bots drop instantly.",
          fix: "Automate renewal (Let's Encrypt / certbot timer, or managed TLS by your host) and alert at T-14 days.",
        },
      };
    }
    yield { type: "progress", value: interpolate(range, 4, 4) };
  } catch (error) {
    if (!isAbortError(error)) throw error;
  }
}

// -----------------------------------------------------------------------------

function buildStep(id: number, status: StepStatus): Omit<TestStep, "detail"> {
  return {
    id,
    label: STEP_LABELS[id - 1] ?? `Audit step ${id}`,
    status,
    timestamp: new Date().toISOString(),
  };
}

function safeHostname(productionUrl: string): string {
  return new URL(productionUrl).hostname;
}

type FetchResult =
  | { kind: "reachable"; status: number; headers: Headers; redirectedTo: string | null }
  | { kind: "unreachable"; detail: string };

async function fetchUrl(url: string, signal: AbortSignal): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
      cache: "no-store",
      headers: { "User-Agent": "guardvibe-audit" },
    });
    return {
      kind: "reachable",
      status: response.status,
      headers: response.headers,
      redirectedTo: response.url !== url && response.url.startsWith("https://") ? response.url : null,
    };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return {
      kind: "unreachable",
      detail: "No HTTP response (DNS, timeout or TLS error). The site may be down or the URL wrong.",
    };
  }
}

async function inspectTls(
  hostname: string,
  signal: AbortSignal,
): Promise<{ daysLeft: number | null; reason: string | null }> {
  return new Promise((resolve) => {
    let socket: import("node:tls").TLSSocket | null = null;

    const finish = (result: { daysLeft: number | null; reason: string | null }): void => {
      try {
        socket?.destroy();
      } catch {
        // socket déjà détruit
      }
      resolve(result);
    };

    const onAbort = (): void => {
      socket?.destroy();
      // pas de rejet: l'annulation remonte via le test suivant
    };
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      socket = tlsConnect({
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false, // on veut inspecter, pas rejeter ici
      });
      socket.setTimeout(8_000, () => {
        finish({ daysLeft: null, reason: "TLS handshake timeout." });
      });
      socket.once("error", () => {
        finish({ daysLeft: null, reason: "TLS handshake failed (no certificate exposed). " });
      });
      socket.once("secureConnect", () => {
        const certificate = socket?.getPeerCertificate();
        const validTo = typeof certificate?.valid_to === "string" ? certificate.valid_to : null;
        if (validTo === null) {
          finish({ daysLeft: null, reason: "No certificate information available." });
          return;
        }
        const expiry = Date.parse(validTo);
        if (Number.isNaN(expiry)) {
          finish({ daysLeft: null, reason: "Certificate date unreadable." });
          return;
        }
        const daysLeft = Math.round((expiry - Date.now()) / 86_400_000);
        finish({ daysLeft, reason: null });
      });
    } catch {
      finish({ daysLeft: null, reason: "TLS inspection unavailable." });
    }
  });
}

function interpolate(range: ProgressRange, current: number, total: number): number {
  const ratio = current / total;
  return Math.min(range.to, Math.round(range.from + ratio * (range.to - range.from)));
}
