/**
 * url-policy.ts — URL and target policy for Open capability.
 *
 * Open validates URLs. Open does not fall back to default URLs.
 * If policy fails, Open fails closed.
 */

import { createHash } from "node:crypto";

// ─── Allowed Schemes ────────────────────────────────────────────────────────

const ALLOWED_SCHEMES = ["https:", "http:"] as const;

/** Hash a URL for proof without storing the raw URL. */
export function hashTargetUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export type UrlPolicyResult =
  | { ok: true; url: URL }
  | { ok: false; failureReason: string };

/**
 * validateTargetUrl — validates a URL string passes Open's governed policy.
 *
 * Fails closed: no fallback, no default.
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

// ─── Platform Registry ──────────────────────────────────────────────────────

/**
 * Governed platform target entries.
 * These are DATA — not child capabilities.
 * Add new platforms here as data, not as new child capabilities.
 */
const GOVERNED_PLATFORM_TARGETS: Record<string, string> = {
  "facebook-web": "https://www.facebook.com/",
  "tiktok-web": "https://www.tiktok.com/",
  "local-workbench": "http://localhost:3000/",
};

export type ResolvePlatformTargetResult =
  | { ok: true; url: string }
  | { ok: false; failureReason: string };

/**
 * resolvePlatformTarget — resolves a targetProfileRef to a governed URL.
 *
 * Fails closed: no default fallback.
 */
export function resolvePlatformTarget(targetProfileRef: string): ResolvePlatformTargetResult {
  const url = GOVERNED_PLATFORM_TARGETS[targetProfileRef];
  if (!url) {
    return {
      ok: false,
      failureReason: `TARGET_PROFILE_NOT_FOUND: "${targetProfileRef}" is not a governed platform target`,
    };
  }
  return { ok: true, url };
}

/** Resolve a governed open target defaults (backward-compat for callers). */
export function resolveOpenTargetDefaultsForPlatform(platformId: string): {
  targetProfileRef: string;
} | null {
  if (platformId in GOVERNED_PLATFORM_TARGETS) {
    return { targetProfileRef: platformId };
  }
  return null;
}
