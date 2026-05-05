import type { ParsedOpenRequest, OpenTargetPolicyDecision, OpenTargetProfile } from "../contract.js";
import type { OpenProfileOverride } from "../ports/open-profile-port.js";
import { OpenTargetPolicyDecisionSchema } from "../schema.js";

type WebOpenTargetProfile = Extract<OpenTargetProfile, { targetKind: "platform-feed" | "local-workbench" }>;

function buildTargetProfileRef(childCapabilityId: OpenTargetProfile["childCapabilityId"]): string {
  return `open-target-profile:${childCapabilityId}`;
}

function resolveExpectedTargetProfileRef(profile: OpenTargetProfile): string {
  return profile.targetKind === "local-program" ? profile.targetProfileRef : buildTargetProfileRef(profile.childCapabilityId);
}

const requiresNerveBusCallerContext = (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
}): boolean => input.profile.requiresNerveBus && input.request.sourceAbilityGroupId !== "nerve-bus" && input.request.requestedBy !== "orchestration";

const matchesRegisteredOpenTargetProfile = (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
}): boolean => input.request.childCapabilityId === input.profile.childCapabilityId && input.request.platformId === input.profile.platformId && input.request.targetKind === input.profile.targetKind;

type OpenTargetPolicyOutcome = {
  ok: boolean;
  failureCode: "target_policy_blocked" | null;
  reason: string | null;
  resolvedTargetUrl: string | null;
  resolvedTargetTitle: string | null;
  decision: OpenTargetPolicyDecision;
};

const buildTargetPolicyDecision = (input: {
  status: "allow" | "block";
  reason: string | null;
  targetProfileRef: string | null;
  resolvedTargetUrl: string | null;
  resolvedTargetTitle: string | null;
  targetUrlSource: "provided" | "registered_profile" | "rejected_missing";
}): OpenTargetPolicyDecision => OpenTargetPolicyDecisionSchema.parse({
  status: input.status,
  reason: input.reason,
  targetProfileRef: input.targetProfileRef,
  resolvedTargetUrl: input.resolvedTargetUrl,
  resolvedTargetTitle: input.resolvedTargetTitle,
  targetUrlSource: input.targetUrlSource,
});

const buildTargetPolicyOutcome = (input: {
  ok: boolean;
  failureCode: "target_policy_blocked" | null;
  reason: string | null;
  resolvedTargetUrl: string | null;
  resolvedTargetTitle: string | null;
  targetProfileRef: string | null;
  targetUrlSource: "provided" | "registered_profile" | "rejected_missing";
  decisionStatus: "allow" | "block";
}): OpenTargetPolicyOutcome => ({
  ok: input.ok,
  failureCode: input.failureCode,
  reason: input.reason,
  resolvedTargetUrl: input.resolvedTargetUrl,
  resolvedTargetTitle: input.resolvedTargetTitle,
  decision: buildTargetPolicyDecision({
    status: input.decisionStatus,
    reason: input.reason,
    targetProfileRef: input.targetProfileRef,
    resolvedTargetUrl: input.resolvedTargetUrl,
    resolvedTargetTitle: input.resolvedTargetTitle,
    targetUrlSource: input.targetUrlSource,
  }),
});

const buildAllowedProvidedTargetPolicyOutcome = (
  input: ParsedOpenRequest,
  profile: WebOpenTargetProfile,
  profileOverride: OpenProfileOverride | null,
  targetProfileRef: string,
): OpenTargetPolicyOutcome => buildTargetPolicyOutcome({
  ok: true,
  failureCode: null,
  reason: null,
  resolvedTargetUrl: input.targetUrl,
  resolvedTargetTitle: input.targetTitle ?? profileOverride?.defaultTitle ?? profile.defaultTitle,
  targetProfileRef,
  targetUrlSource: "provided",
  decisionStatus: "allow",
});

const buildRegisteredProfileTargetPolicyOutcome = (
  profile: WebOpenTargetProfile,
  profileOverride: OpenProfileOverride | null,
  targetProfileRef: string,
  input: ParsedOpenRequest,
): OpenTargetPolicyOutcome => buildTargetPolicyOutcome({
  ok: true,
  failureCode: null,
  reason: null,
  resolvedTargetUrl: profileOverride?.defaultUrl ?? profile.defaultUrl,
  resolvedTargetTitle: input.targetTitle ?? profileOverride?.defaultTitle ?? profile.defaultTitle,
  targetProfileRef,
  targetUrlSource: "registered_profile",
  decisionStatus: "allow",
});

const buildRejectedTargetPolicyOutcome = (reason: string): OpenTargetPolicyOutcome => buildTargetPolicyOutcome({
  ok: false,
  failureCode: "target_policy_blocked",
  reason,
  resolvedTargetUrl: null,
  resolvedTargetTitle: null,
  targetProfileRef: null,
  targetUrlSource: "rejected_missing",
  decisionStatus: "block",
});

const resolveOpenTargetPolicyBlockReason = (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
}): string | null => {
  if (!input.profile.allowedCaller.includes(input.request.requestedBy)) {
    return `requestedBy ${input.request.requestedBy} is outside the governed caller allowlist`;
  }

  if (requiresNerveBusCallerContext({ request: input.request, profile: input.profile })) {
    return "open requires orchestration-issued or nerve-bus-transported caller context";
  }

  if (!matchesRegisteredOpenTargetProfile({ request: input.request, profile: input.profile })) {
    return "request childCapabilityId / platformId / targetKind does not match the registered open target profile";
  }

  const expectedTargetProfileRef = resolveExpectedTargetProfileRef(input.profile);
  if (!input.request.targetUrl && input.request.targetProfileRef !== expectedTargetProfileRef) {
    return `open requires targetUrl or explicit targetProfileRef ${expectedTargetProfileRef}; silent profile defaulting is forbidden`;
  }

  return null;
};

export function evaluateOpenTargetPolicy(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  profileOverride: OpenProfileOverride | null;
}): OpenTargetPolicyOutcome {
  const targetProfileRef = resolveExpectedTargetProfileRef(input.profile);

  const blockReason = resolveOpenTargetPolicyBlockReason(input);
  if (blockReason) {
    return buildRejectedTargetPolicyOutcome(blockReason);
  }

  if (input.request.targetUrl) {
    if (input.profile.targetKind === "local-program") {
      return buildRejectedTargetPolicyOutcome("local program open must not accept targetUrl or URL fallback");
    }
    return buildAllowedProvidedTargetPolicyOutcome(input.request, input.profile, input.profileOverride, targetProfileRef);
  }

  if (input.profile.targetKind === "local-program") {
    return buildTargetPolicyOutcome({
      ok: true,
      failureCode: null,
      reason: null,
      resolvedTargetUrl: null,
      resolvedTargetTitle: input.request.targetTitle ?? input.profile.defaultTitle,
      targetProfileRef,
      targetUrlSource: "registered_profile",
      decisionStatus: "allow",
    });
  }

  return buildRegisteredProfileTargetPolicyOutcome(input.profile, input.profileOverride, targetProfileRef, input.request);
}
