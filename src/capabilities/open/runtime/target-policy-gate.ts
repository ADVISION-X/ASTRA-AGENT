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

  if (!input.profile.allowedCaller.includes(input.request.requestedBy)) {
    return {
      ok: false,
      failureCode: "target_policy_blocked",
      reason: `requestedBy ${input.request.requestedBy} is outside the governed caller allowlist`,
      resolvedTargetUrl,
      resolvedTargetTitle,
      decision: OpenTargetPolicyDecisionSchema.parse({
        status: "block",
        reason: `requestedBy ${input.request.requestedBy} is outside the governed caller allowlist`,
        targetProfileRef: null,
        resolvedTargetUrl: null,
        resolvedTargetTitle: null,
      }),
    };
  }

  if (input.profile.requiresNerveBus && input.request.sourceAbilityGroupId !== "nerve-bus" && input.request.requestedBy !== "orchestration") {
    return {
      ok: false,
      failureCode: "target_policy_blocked",
      reason: "open requires orchestration-issued or nerve-bus-transported caller context",
      resolvedTargetUrl,
      resolvedTargetTitle,
      decision: OpenTargetPolicyDecisionSchema.parse({
        status: "block",
        reason: "open requires orchestration-issued or nerve-bus-transported caller context",
        targetProfileRef: null,
        resolvedTargetUrl: null,
        resolvedTargetTitle: null,
      }),
    };
  }

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
        targetProfileRef: null,
        resolvedTargetUrl: null,
        resolvedTargetTitle: null,
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