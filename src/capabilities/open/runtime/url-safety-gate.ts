import type { OpenTargetProfile, OpenUrlSafetyDecision } from "../contract.js";
import { OpenUrlSafetyDecisionSchema } from "../schema.js";
import {
  isForbiddenOpenProtocol,
  matchesAllowedHostname,
  normalizeOpenUrl,
} from "../shared/open-url.js";

type WebOpenTargetProfile = Extract<OpenTargetProfile, { targetKind: "platform-feed" | "local-workbench" }>;

const resolveOpenScheme = (protocol: string): "http" | "https" | null =>
  protocol === "https:" ? "https" : protocol === "http:" ? "http" : null;

const buildUrlSafetyDecision = (input: {
  status: "allow" | "block";
  reason: string | null;
  normalizedUrl: string | null;
  hostname: string | null;
  scheme: "http" | "https" | null;
}): OpenUrlSafetyDecision => OpenUrlSafetyDecisionSchema.parse({
  status: input.status,
  reason: input.reason,
  normalizedUrl: input.normalizedUrl,
  hostname: input.hostname,
  scheme: input.scheme,
});

const buildUrlSafetyResult = (input: {
  ok: boolean;
  failureCode: "url_policy_blocked" | null;
  reason: string | null;
  normalizedUrl: string | null;
  hostname: string | null;
  scheme: "http" | "https" | null;
  decisionStatus: "allow" | "block";
}): {
  ok: boolean;
  failureCode: "url_policy_blocked" | null;
  reason: string | null;
  normalizedUrl: string | null;
  hostname: string | null;
  scheme: "http" | "https" | null;
  decision: OpenUrlSafetyDecision;
} => ({
  ok: input.ok,
  failureCode: input.failureCode,
  reason: input.reason,
  normalizedUrl: input.normalizedUrl,
  hostname: input.hostname,
  scheme: input.scheme,
  decision: buildUrlSafetyDecision({
    status: input.decisionStatus,
    reason: input.reason,
    normalizedUrl: input.normalizedUrl,
    hostname: input.hostname,
    scheme: input.scheme,
  }),
});

const buildInvalidUrlPolicyBlockResult = (): ReturnType<typeof buildUrlSafetyResult> => buildUrlSafetyResult({
  ok: false,
  failureCode: "url_policy_blocked",
  reason: "target url is not a valid absolute url",
  normalizedUrl: null,
  hostname: null,
  scheme: null,
  decisionStatus: "block",
});

const buildForbiddenProtocolPolicyBlockResult = (parsedUrl: URL): ReturnType<typeof buildUrlSafetyResult> => buildUrlSafetyResult({
  ok: false,
  failureCode: "url_policy_blocked",
  reason: `forbidden target url protocol: ${parsedUrl.protocol}`,
  normalizedUrl: parsedUrl.toString(),
  hostname: parsedUrl.hostname,
  scheme: resolveOpenScheme(parsedUrl.protocol),
  decisionStatus: "block",
});

const buildDisallowedSchemePolicyBlockResult = (
  parsedUrl: URL,
  profile: WebOpenTargetProfile,
  scheme: "http" | "https" | null,
): ReturnType<typeof buildUrlSafetyResult> => buildUrlSafetyResult({
  ok: false,
  failureCode: "url_policy_blocked",
  reason: `scheme ${parsedUrl.protocol} is not allowed for ${profile.childCapabilityId}`,
  normalizedUrl: parsedUrl.toString(),
  hostname: parsedUrl.hostname,
  scheme,
  decisionStatus: "block",
});

const buildHostnamePolicyBlockResult = (
  parsedUrl: URL,
  profile: WebOpenTargetProfile,
  scheme: "http" | "https" | null,
): ReturnType<typeof buildUrlSafetyResult> => buildUrlSafetyResult({
  ok: false,
  failureCode: "url_policy_blocked",
  reason: `hostname ${parsedUrl.hostname} is outside the governed allowlist for ${profile.childCapabilityId}`,
  normalizedUrl: parsedUrl.toString(),
  hostname: parsedUrl.hostname,
  scheme,
  decisionStatus: "block",
});

const buildAllowedUrlPolicyResult = (parsedUrl: URL, scheme: "http" | "https" | null): ReturnType<typeof buildUrlSafetyResult> => buildUrlSafetyResult({
  ok: true,
  failureCode: null,
  reason: null,
  normalizedUrl: parsedUrl.toString(),
  hostname: parsedUrl.hostname,
  scheme,
  decisionStatus: "allow",
});

export function evaluateUrlSafety(input: {
  profile: WebOpenTargetProfile;
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
    return buildInvalidUrlPolicyBlockResult();
  }

  if (isForbiddenOpenProtocol(parsedUrl.protocol)) {
    return buildForbiddenProtocolPolicyBlockResult(parsedUrl);
  }

  const scheme = resolveOpenScheme(parsedUrl.protocol);
  if (!scheme || !input.profile.allowedSchemes.includes(scheme)) {
    return buildDisallowedSchemePolicyBlockResult(parsedUrl, input.profile, scheme);
  }

  if (!matchesAllowedHostname(parsedUrl.hostname, input.profile.allowedHostnames)) {
    return buildHostnamePolicyBlockResult(parsedUrl, input.profile, scheme);
  }

  return buildAllowedUrlPolicyResult(parsedUrl, scheme);
}
