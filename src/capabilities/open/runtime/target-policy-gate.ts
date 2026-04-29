import type { ParsedOpenRequest, OpenTargetPolicyDecision, OpenTargetProfile } from "../contract.js";
import type { OpenProfileOverride } from "../ports/open-profile-port.js";
import { OpenTargetPolicyDecisionSchema } from "../schema.js";

export function evaluateOpenTargetPolicy(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  profileOverride: OpenProfileOverride | null;
}): {
  ok: boolean;
  failureCode: "target_policy_blocked" | null;
  reason: string | null;
  resolvedTargetUrl: string;
  resolvedTargetTitle: string;
  decision: OpenTargetPolicyDecision;
} {
  const resolvedTargetUrl = input.request.targetUrl ?? input.profileOverride?.defaultUrl ?? input.profile.defaultUrl;
  const resolvedTargetTitle = input.request.targetTitle ?? input.profileOverride?.defaultTitle ?? input.profile.defaultTitle;

  if (
    input.request.childCapabilityId !== input.profile.childCapabilityId
    || input.request.platformId !== input.profile.platformId
    || input.request.targetKind !== input.profile.targetKind
  ) {
    return {
      ok: false,
      failureCode: "target_policy_blocked",
      reason: "request childCapabilityId / platformId / targetKind does not match the registered open target profile",
      resolvedTargetUrl,
      resolvedTargetTitle,
      decision: OpenTargetPolicyDecisionSchema.parse({
        status: "block",
        reason: "request does not match the governed child target profile",
        targetProfileRef: `open-target-profile:${input.profile.childCapabilityId}`,
        resolvedTargetUrl,
        resolvedTargetTitle,
      }),
    };
  }

  return {
    ok: true,
    failureCode: null,
    reason: null,
    resolvedTargetUrl,
    resolvedTargetTitle,
    decision: OpenTargetPolicyDecisionSchema.parse({
      status: "allow",
      reason: null,
      targetProfileRef: `open-target-profile:${input.profile.childCapabilityId}`,
      resolvedTargetUrl,
      resolvedTargetTitle,
    }),
  };
}