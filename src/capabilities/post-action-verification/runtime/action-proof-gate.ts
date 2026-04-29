import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";

function matchesActionSource(request: ParsedPostActionVerificationAbilityInput): boolean {
  if (request.childCapabilityId === "verify-page-opened") {
    return request.actionProof.sourceAbilityGroupId === "open";
  }

  if (request.childCapabilityId === "verify-video-changed-after-scroll") {
    return request.actionProof.sourceAbilityGroupId === "mouse-scroll";
  }

  return request.actionProof.sourceAbilityGroupId === "mouse-click";
}

export function validateActionProof(request: ParsedPostActionVerificationAbilityInput) {
  const proof = request.actionProof;
  if (!matchesActionSource(request)) {
    return {
      ok: false,
      status: "blocked" as const,
      failureReason: "forbidden_action_source" as const,
      reviewRequiredReason: null,
      statusMessage: `${request.childCapabilityId} does not accept action proofs from ${proof.sourceAbilityGroupId}.`,
      dataQualityFlags: ["forbidden_action_source"],
      actionProofDecision: "blocked:forbidden_action_source" as const,
    };
  }

  if (proof.selfReportedOnly) {
    return {
      ok: false,
      status: "review_required" as const,
      failureReason: "self_reported_success_only" as const,
      reviewRequiredReason: "Self-reported action completion cannot be the only proof for final verification.",
      statusMessage: "Action proof is self-reported only.",
      dataQualityFlags: ["self_reported_only"],
      actionProofDecision: "review_required:self_reported_only" as const,
    };
  }

  const executionRefPresent = proof.navigationAttemptRef !== null || proof.primitiveExecutionRef !== null || proof.scrollExecutionRef !== null;
  if (!executionRefPresent) {
    return {
      ok: false,
      status: "blocked" as const,
      failureReason: "missing_action_proof" as const,
      reviewRequiredReason: null,
      statusMessage: "Action proof must expose a governed execution ref.",
      dataQualityFlags: ["action_execution_ref_missing"],
      actionProofDecision: "blocked:missing_execution_ref" as const,
    };
  }

  if (proof.sessionId !== request.sessionId || proof.roundId !== request.roundId || proof.videoVisitId !== request.videoVisitId) {
    return {
      ok: false,
      status: "blocked" as const,
      failureReason: "action_binding_conflict" as const,
      reviewRequiredReason: null,
      statusMessage: "Action proof binding does not match verification session, round, or video visit.",
      dataQualityFlags: ["action_binding_conflict"],
      actionProofDecision: "blocked:binding_conflict" as const,
    };
  }

  return {
    ok: true,
    actionProofDecision: "allow" as const,
  };
}
