import type { ParsedOpenRequest, OpenTargetPolicyDecision, OpenTargetProfile } from "../contract.js";
import type { OpenProfileOverride } from "../ports/open-profile-port.js";
import { OpenTargetPolicyDecisionSchema } from "../schema.js";

function buildTargetProfileRef(childCapabilityId: OpenTargetProfile["childCapabilityId"]): string {
  return `open-target-profile:${childCapabilityId}`;
}

export function evaluateOpenTargetPolicy(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  profileOverride: OpenProfileOverride | null;
}): {
  ok: boolean;
  failureCode: "target_policy_blocked" | null;
  reason: string | null;
  resolvedTargetUrl: string | null;
  resolvedTargetTitle: string | null;
  decision: OpenTargetPolicyDecision;
} {
  const targetProfileRef = buildTargetProfileRef(input.profile.childCapabilityId);

  if (!input.profile.allowedCaller.includes(input.request.requestedBy)) {
    const reason = `requestedBy ${input.request.requestedBy} is outside the governed caller allowlist`;
    return {
      ok: false,
      failureCode: "target_policy_blocked",
      reason,
      resolvedTargetUrl: null,
      resolvedTargetTitle: null,
      decision: OpenTargetPolicyDecisionSchema.parse({
        status: "block",
        reason,
        targetProfileRef: null,
        resolvedTargetUrl: null,
        resolvedTargetTitle: null,
        targetUrlSource: "rejected_missing",
      }),
    };
  }

  if (input.profile.requiresNerveBus && input.request.sourceAbilityGroupId !== "nerve-bus" && input.request.requestedBy !== "orchestration") {
    const reason = "open requires orchestration-issued or nerve-bus-transported caller context";
    return {
      ok: false,
      failureCode: "target_policy_blocked",
      reason,
      resolvedTargetUrl: null,
      resolvedTargetTitle: null,
      decision: OpenTargetPolicyDecisionSchema.parse({
        status: "block",
        reason,
        targetProfileRef: null,
        resolvedTargetUrl: null,
        resolvedTargetTitle: null,
        targetUrlSource: "rejected_missing",
      }),
    };
  }

  if (
    input.request.childCapabilityId !== input.profile.childCapabilityId
    || input.request.platformId !== input.profile.platformId
    || input.request.targetKind !== input.profile.targetKind
  ) {
    const reason = "request childCapabilityId / platformId / targetKind does not match the registered open target profile";
    return {
      ok: false,
      failureCode: "target_policy_blocked",
      reason,
      resolvedTargetUrl: null,
      resolvedTargetTitle: null,
      decision: OpenTargetPolicyDecisionSchema.parse({
        status: "block",
        reason,
        targetProfileRef: null,
        resolvedTargetUrl: null,
        resolvedTargetTitle: null,
        targetUrlSource: "rejected_missing",
      }),
    };
  }

  if (input.request.targetUrl) {
    return {
      ok: true,
      failureCode: null,
      reason: null,
      resolvedTargetUrl: input.request.targetUrl,
      resolvedTargetTitle: input.request.targetTitle ?? input.profileOverride?.defaultTitle ?? input.profile.defaultTitle,
      decision: OpenTargetPolicyDecisionSchema.parse({
        status: "allow",
        reason: null,
        targetProfileRef,
        resolvedTargetUrl: input.request.targetUrl,
        resolvedTargetTitle: input.request.targetTitle ?? input.profileOverride?.defaultTitle ?? input.profile.defaultTitle,
        targetUrlSource: "provided",
      }),
    };
  }

  if (input.request.targetProfileRef !== targetProfileRef) {
    const reason = `open requires targetUrl or explicit targetProfileRef ${targetProfileRef}; silent profile defaulting is forbidden`;
    return {
      ok: false,
      failureCode: "target_policy_blocked",
      reason,
      resolvedTargetUrl: null,
      resolvedTargetTitle: null,
      decision: OpenTargetPolicyDecisionSchema.parse({
        status: "block",
        reason,
        targetProfileRef: null,
        resolvedTargetUrl: null,
        resolvedTargetTitle: null,
        targetUrlSource: "rejected_missing",
      }),
    };
  }

  return {
    ok: true,
    failureCode: null,
    reason: null,
    resolvedTargetUrl: input.profileOverride?.defaultUrl ?? input.profile.defaultUrl,
    resolvedTargetTitle: input.request.targetTitle ?? input.profileOverride?.defaultTitle ?? input.profile.defaultTitle,
    decision: OpenTargetPolicyDecisionSchema.parse({
      status: "allow",
      reason: null,
      targetProfileRef,
      resolvedTargetUrl: input.profileOverride?.defaultUrl ?? input.profile.defaultUrl,
      resolvedTargetTitle: input.request.targetTitle ?? input.profileOverride?.defaultTitle ?? input.profile.defaultTitle,
      targetUrlSource: "registered_profile",
    }),
  };
}