/**
 * url-policy.ts — URL and target policy for Open capability.
 *
 * Open validates URLs. Open does not substitute or inject target URLs.
 * If policy fails, Open fails closed.
 */

import { createHash } from "node:crypto";

// ─── Allowed Schemes ────────────────────────────────────────────────────────

const ALLOWED_SCHEMES = ["https:", "http:"] as const;

/** Hash a URL for proof without storing the raw URL. */
function hashTargetUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export type UrlPolicyResult =
  | { ok: true; url: URL }
  | { ok: false; failureReason: string };

/**
 * validateTargetUrl — validates a URL string passes Open's governed policy.
 *
 * Fails closed when an explicit target is unavailable.
 */
export function validateTargetUrl(raw: string): UrlPolicyResult {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, failureReason: `URL_PARSE_FAILED: not a valid URL: ${raw}` };
  }

  if (!(ALLOWED_SCHEMES as readonly string[]).includes(parsed.protocol)) {
    return {
      ok: false,
      failureReason: `URL_SCHEME_FORBIDDEN: scheme ${parsed.protocol} not allowed`,
    };
  }

  if (!parsed.hostname || parsed.hostname.length < 1) {
    return { ok: false, failureReason: "URL_NO_HOST: URL has no hostname" };
  }

  return { ok: true, url: parsed };
}
