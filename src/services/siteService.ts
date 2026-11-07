import "server-only";

import { connect as tlsConnect } from "node:tls";
import { isAbortError } from "@/lib/sleep";
import { safeFetch } from "@/lib/ssrf";
import type {
  ProgressRange,
  ScanEvent,
  StepStatus,
  TestStep,
} from "@/types";

/**
 * Real audit of the production URL (no simulation):
 *  1. HTTPS reachability;
 *  2. HTTP → HTTPS redirect;
 *  3. TLS certificate (real inspection via tls.connect);
 *  4. HTTP security headers (CSP, HSTS, X-Frame-Options…).
 * No outbound connection other than to the URL submitted by the user.
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

    // The 4 steps appear immediately, as PENDING.
    for (let index = 1; index <= STEP_LABELS.length; index += 1) {
      yield { type: "test_step", step: buildStep(index, "PENDING") };
    }

    // ---- Step 1: HTTPS reachability ------------------------------------
    yield { type: "test_step", step: buildStep(1, "RUNNING") };
    const probe = await safeFetch(input.productionUrl, signal);
    const response = probe.kind === "reachable" ? probe.response : null;
    yield {
      type: "test_step",
      step: {
        ...buildStep(1, response !== null ? "SUCCESS" : "FAILED"),
        detail:
          probe.kind === "reachable"
            ? `HTTP ${probe.response.status} received from ${hostname}`
            : probe.detail,
      },
    };
    yield { type: "progress", value: interpolate(range, 1, 4) };

    // ---- Step 2: HTTP → HTTPS redirect ---------------------------------
    yield { type: "test_step", step: buildStep(2, "RUNNING") };
    const httpProbe = await safeFetch(`http://${hostname}`, signal);
    const redirectTarget =
      httpProbe.kind === "reachable" ? httpProbe.response.redirectedTo : null;
    yield {
      type: "test_step",
      step: {
        ...buildStep(2, redirectTarget !== null ? "SUCCESS" : "FAILED"),
        detail:
          redirectTarget !== null
            ? `HTTP traffic redirected to ${redirectTarget}`
            : "Plain HTTP requests are not redirected to HTTPS automatically.",
      },
    };
    yield { type: "progress", value: interpolate(range, 2, 4) };

    // ---- Step 3: TLS certificate --------------------------------------------
    yield { type: "test_step", step: buildStep(3, "RUNNING") };
    const certificate =
      response !== null
        ? await inspectTls(hostname, signal, response.address)
        : { daysLeft: null, reason: "Site unreachable: TLS not checked." };
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

    // ---- Step 4: security headers ----------------------------------------
    yield { type: "test_step", step: buildStep(4, "RUNNING") };
    const missingHeaders: string[] = [];
    const headerHints: string[] = [];
    if (response !== null) {
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

    // Real actionable findings (same severity rules as the scan).
    if (response !== null && missingHeaders.length > 0) {
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

async function inspectTls(
  hostname: string,
  signal: AbortSignal,
  address: string,
): Promise<{ daysLeft: number | null; reason: string | null }> {
  return new Promise((resolve) => {
    let socket: import("node:tls").TLSSocket | null = null;

    const finish = (result: { daysLeft: number | null; reason: string | null }): void => {
      try {
        socket?.destroy();
      } catch {
        // socket already destroyed
      }
      resolve(result);
    };

    const onAbort = (): void => {
      socket?.destroy();
      // no rejection: the cancellation surfaces via the next check
    };
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      socket = tlsConnect({
        // IP already validated: the handshake cannot be redirected by DNS.
        host: address,
        port: 443,
        servername: hostname.replace(/^\[|\]$/g, ""),
        rejectUnauthorized: false, // we want to inspect, not reject here
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
