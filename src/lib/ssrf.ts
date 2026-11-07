/**
 * Outgoing HTTP requests hardened against SSRF.
 *
 * Each target — the initial URL as well as every redirect — is:
 *  1. syntactically validated (HTTP/HTTPS, without credentials);
 *  2. resolved via DNS, and **all** of its addresses must be public;
 *  3. contacted on the validated IP address (`hostname` = IP, `Host`/SNI =
 *     origin name), so there is no second resolution: DNS rebinding is
 *     neutralized between validation and connection.
 *
 * Strictly server-side module (node:dns, node:http, node:https): never
 * import it from a client component.
 */

import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";

import { isPrivateAddress, isPrivateOrLocalHost } from "@/lib/validation";

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 8_000;
const USER_AGENT = "securvibe-audit";

const BLOCKED_DETAIL =
  "Target blocked: private, loopback, link-local or otherwise non-public address.";
const UNREACHABLE_DETAIL =
  "No HTTP response (DNS, timeout or TLS error). The site may be down or the URL wrong.";

type ResolvedTarget = { url: URL; address: string };
type Validation = ResolvedTarget | { detail: string };

export type SafeResponse = {
  status: number;
  headers: Headers;
  /** Final URL, after redirects. */
  finalUrl: string;
  /** Public IP actually contacted (reusable for the TLS check). */
  address: string;
  /** Final URL if it differs from the initial URL and is HTTPS. */
  redirectedTo: string | null;
};

export type SafeFetchResult =
  | { kind: "reachable"; response: SafeResponse }
  | { kind: "unreachable"; detail: string };

type Hop =
  | {
      kind: "response";
      status: number;
      headers: Headers;
      location: string | null;
      address: string;
    }
  | { kind: "unreachable"; detail: string };

function createAbortError(): Error {
  if (typeof DOMException === "function") {
    return new DOMException("The audit was cancelled.", "AbortError");
  }
  const error = new Error("The audit was cancelled.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw createAbortError();
}

/** Validates a URL and returns its pinned public IP. */
export async function validateTargetUrl(
  url: URL,
  signal: AbortSignal,
): Promise<Validation> {
  throwIfAborted(signal);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { detail: "Blocked: only public HTTP/HTTPS targets can be audited." };
  }
  if (url.username !== "" || url.password !== "") {
    return { detail: "Blocked: credentials in the target URL are not allowed." };
  }
  if (isPrivateOrLocalHost(url.hostname)) return { detail: BLOCKED_DETAIL };

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
  } catch {
    throwIfAborted(signal);
    return { detail: "DNS resolution failed for this hostname." };
  }
  throwIfAborted(signal);
  if (addresses.length === 0) return { detail: "DNS resolution returned no address." };

  // One private address is enough to refuse: the resolver could pick it.
  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) return { detail: BLOCKED_DETAIL };
  }
  const chosen = addresses[0];
  if (chosen === undefined) return { detail: "DNS resolution returned no address." };

  return { url, address: chosen.address };
}

/** GET HTTP/HTTPS with SSRF validation of the target and each redirect. */
export async function safeFetch(
  rawUrl: string,
  signal: AbortSignal,
): Promise<SafeFetchResult> {
  let target: Validation;
  try {
    target = await validateTargetUrl(new URL(rawUrl), signal);
  } catch (error) {
    if (signal.aborted) throw error;
    return { kind: "unreachable", detail: "Invalid URL." };
  }
  if ("detail" in target) return { kind: "unreachable", detail: target.detail };

  const initialUrl = target.url.href;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const hop = await probe(target, signal);
    if (hop.kind === "unreachable") return hop;

    const isRedirect =
      hop.location !== null && hop.status >= 300 && hop.status < 400;

    if (!isRedirect) {
      const changed = target.url.href !== initialUrl;
      return {
        kind: "reachable",
        response: {
          status: hop.status,
          headers: hop.headers,
          finalUrl: target.url.href,
          address: hop.address,
          redirectedTo:
            changed && target.url.protocol === "https:" ? target.url.href : null,
        },
      };
    }

    if (redirects === MAX_REDIRECTS) {
      return { kind: "unreachable", detail: "Too many redirects (max 5)." };
    }

    let next: URL;
    try {
      next = new URL(hop.location ?? "", target.url);
    } catch {
      return { kind: "unreachable", detail: "Redirected to an invalid URL." };
    }

    // Each hop is revalidated (protocol, literal IP, DNS) before any request.
    const validated = await validateTargetUrl(next, signal);
    if ("detail" in validated) return { kind: "unreachable", detail: validated.detail };
    target = validated;
  }

  return { kind: "unreachable", detail: "Too many redirects (max 5)." };
}

/** One request only, to the already-validated IP (Host and SNI keep the origin name). */
async function probe(target: ResolvedTarget, signal: AbortSignal): Promise<Hop> {
  throwIfAborted(signal);

  const isHttps = target.url.protocol === "https:";
  const port =
    target.url.port === "" ? (isHttps ? 443 : 80) : Number(target.url.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    return { kind: "unreachable", detail: "Invalid port." };
  }

  const combined = AbortSignal.any([
    signal,
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  ]);
  const servername = target.url.hostname.replace(/^\[|\]$/g, "");

  return new Promise<Hop>((resolve, reject) => {
    let settled = false;
    const finish = (hop: Hop): void => {
      if (settled) return;
      settled = true;
      resolve(hop);
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const onResponse = (response: IncomingMessage): void => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (value === undefined) continue;
        for (const item of Array.isArray(value) ? value : [value]) {
          headers.append(name, item);
        }
      }
      const status = response.statusCode ?? 0;
      const location = response.headers.location ?? null;
      response.on("error", () => {
        // Body intentionally destroyed: the headers are already read.
      });
      response.destroy();

      if (status === 0) {
        finish({ kind: "unreachable", detail: UNREACHABLE_DETAIL });
        return;
      }
      finish({
        kind: "response",
        status,
        headers,
        location,
        address: target.address,
      });
    };

    try {
      const options = {
        hostname: target.address,
        port,
        path: `${target.url.pathname}${target.url.search}`,
        method: "GET",
        headers: {
          Host: target.url.host,
          "User-Agent": USER_AGENT,
          Accept: "*/*",
          Connection: "close",
        },
        signal: combined,
        ...(isHttps ? { servername } : {}),
      };
      const request = isHttps
        ? httpsRequest(options, onResponse)
        : httpRequest(options, onResponse);

      request.once("error", () => {
        if (signal.aborted) {
          fail(createAbortError());
          return;
        }
        finish({ kind: "unreachable", detail: UNREACHABLE_DETAIL });
      });
      request.end();
    } catch {
      finish({ kind: "unreachable", detail: UNREACHABLE_DETAIL });
    }
  });
}
