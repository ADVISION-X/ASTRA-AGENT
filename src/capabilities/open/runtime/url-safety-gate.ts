import type { OpenTargetProfile, OpenUrlSafetyDecision } from "../contract.js";
import { OpenUrlSafetyDecisionSchema } from "../schema.js";
import {
  isForbiddenOpenProtocol,
  matchesAllowedHostname,
  normalizeOpenUrl,
} from "../shared/open-url.js";

export function evaluateUrlSafety(input: {
  profile: OpenTargetProfile;
  targetUrl: string;
}): {
  ok: boolean;
  failureCode: "url_policy_blocked" | null;
  reason: string | null;
  normalizedUrl: string | null;
  hostname: string | null;
  scheme: "http" | "https" | null;
  decision: OpenUrlSafetyDecision;
} {
  let parsedUrl: URL;
  try {
    parsedUrl = normalizeOpenUrl(input.targetUrl);
  } catch {
    return {
      ok: false,
      failureCode: "url_policy_blocked",
      reason: "target url is not a valid absolute url",
      normalizedUrl: null,
      hostname: null,
      scheme: null,
      decision: OpenUrlSafetyDecisionSchema.parse({
        status: "block",
        reason: "target url is not a valid absolute url",
        normalizedUrl: null,
        hostname: null,
        scheme: null,
      }),
    };
  }

  if (isForbiddenOpenProtocol(parsedUrl.protocol)) {
    return {
      ok: false,
      failureCode: "url_policy_blocked",
      reason: `forbidden target url protocol: ${parsedUrl.protocol}`,
      normalizedUrl: parsedUrl.toString(),
      hostname: parsedUrl.hostname,
      scheme: parsedUrl.protocol === "https:" ? "https" : "http",
      decision: OpenUrlSafetyDecisionSchema.parse({
        status: "block",
        reason: `forbidden target url protocol: ${parsedUrl.protocol}`,
        normalizedUrl: parsedUrl.toString(),
        hostname: parsedUrl.hostname,
        scheme: parsedUrl.protocol === "https:" ? "https" : "http",
      }),
    };
  }

  const scheme = parsedUrl.protocol === "https:" ? "https" : parsedUrl.protocol === "http:" ? "http" : null;
  if (!scheme || !input.profile.allowedSchemes.includes(scheme)) {
    return {
      ok: false,
      failureCode: "url_policy_blocked",
      reason: `scheme ${parsedUrl.protocol} is not allowed for ${input.profile.childCapabilityId}`,
      normalizedUrl: parsedUrl.toString(),
      hostname: parsedUrl.hostname,
      scheme: scheme ?? "http",
      decision: OpenUrlSafetyDecisionSchema.parse({
        status: "block",
        reason: `scheme ${parsedUrl.protocol} is not allowed for ${input.profile.childCapabilityId}`,
        normalizedUrl: parsedUrl.toString(),
        hostname: parsedUrl.hostname,
        scheme: scheme ?? "http",
      }),
    };
  }

  if (!matchesAllowedHostname(parsedUrl.hostname, input.profile.allowedHostnames)) {
    return {
      ok: false,
      failureCode: "url_policy_blocked",
      reason: `hostname ${parsedUrl.hostname} is outside the governed allowlist for ${input.profile.childCapabilityId}`,
      normalizedUrl: parsedUrl.toString(),
      hostname: parsedUrl.hostname,
      scheme,
      decision: OpenUrlSafetyDecisionSchema.parse({
        status: "block",
        reason: `hostname ${parsedUrl.hostname} is outside the governed allowlist for ${input.profile.childCapabilityId}`,
        normalizedUrl: parsedUrl.toString(),
        hostname: parsedUrl.hostname,
        scheme,
      }),
    };
  }

  return {
    ok: true,
    failureCode: null,
    reason: null,
    normalizedUrl: parsedUrl.toString(),
    hostname: parsedUrl.hostname,
    scheme,
    decision: OpenUrlSafetyDecisionSchema.parse({
      status: "allow",
      reason: null,
      normalizedUrl: parsedUrl.toString(),
      hostname: parsedUrl.hostname,
      scheme,
    }),
  };
}