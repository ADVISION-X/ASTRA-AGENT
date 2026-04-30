import { POST_ACTION_CHILD_POLICY_MAP } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

export function validateActionProof(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
}) {
  const request = input.request;
  const proof = request.actionProof;
  const childPolicy = POST_ACTION_CHILD_POLICY_MAP[request.childCapabilityId];
  const allowedSourceChildCapabilityIds: readonly string[] = childPolicy.allowedSourceChildCapabilityIds;
  const allowedActionTypes: readonly string[] = childPolicy.allowedActionTypes;

  if (proof.sourceAbilityGroupId !== childPolicy.allowedSourceAbilityGroupId) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "forbidden_action_source" as const,
      reviewRequiredReason: null,
      statusMessage: `${request.childCapabilityId} does not accept action proofs from ${proof.sourceAbilityGroupId}.`,
      dataQualityFlags: ["forbidden_action_source"],
      actionProofDecision: "failed:forbidden_action_source" as const,
    };
  }

  if (!allowedSourceChildCapabilityIds.includes(proof.sourceChildCapabilityId)) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "forbidden_action_source" as const,
      reviewRequiredReason: null,
      statusMessage: `${request.childCapabilityId} does not accept action proofs from ${proof.sourceChildCapabilityId}.`,
      dataQualityFlags: ["forbidden_action_source"],
      actionProofDecision: "failed:forbidden_action_source_child" as const,
    };
  }

  if (!allowedActionTypes.includes(proof.actionType)) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "forbidden_action_source" as const,
      reviewRequiredReason: null,
      statusMessage: `${request.childCapabilityId} does not accept action type ${proof.actionType}.`,
      dataQualityFlags: ["forbidden_action_source"],
      actionProofDecision: "failed:forbidden_action_type" as const,
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

  if (proof.actionLogRef === null && proof.actionRecordRef === null) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "action_log_missing" as const,
      reviewRequiredReason: null,
      statusMessage: "Action proof must expose actionLogRef or actionRecordRef.",
      dataQualityFlags: ["action_log_missing"],
      actionProofDecision: "failed:action_log_missing" as const,
    };
  }

  const requiredExecutionRef = proof[childPolicy.requiredExecutionRef];
  if (requiredExecutionRef === null) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "missing_action_proof" as const,
      reviewRequiredReason: null,
      statusMessage: `${childPolicy.requiredExecutionRef} is required for ${request.childCapabilityId}.`,
      dataQualityFlags: ["action_execution_ref_missing"],
      actionProofDecision: "failed:missing_required_execution_ref" as const,
    };
  }

  if (!proof.sourceRuntimeProofRef) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "source_runtime_proof_missing" as const,
      reviewRequiredReason: null,
      statusMessage: "Action proof must expose sourceRuntimeProofRef.",
      dataQualityFlags: ["source_runtime_proof_missing"],
      actionProofDecision: "failed:source_runtime_proof_missing" as const,
    };
  }

  if (proof.sessionId !== request.sessionId || proof.roundId !== request.roundId || proof.videoVisitId !== request.videoVisitId) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "action_binding_conflict" as const,
      reviewRequiredReason: null,
      statusMessage: "Action proof binding does not match verification session, round, or video visit.",
      dataQualityFlags: ["action_binding_conflict"],
      actionProofDecision: "failed:binding_conflict" as const,
    };
  }

  const actionLogRef = proof.actionLogRef ?? proof.actionRecordRef;
  if (actionLogRef !== null) {
    const actionLog = input.context.evidenceReadPort.getActionLogByRef(request, actionLogRef);
    if (actionLog === null) {
      return {
        ok: false,
        status: "review_required" as const,
        failureReason: "action_log_missing" as const,
        reviewRequiredReason: "Action log could not be resolved from the governed read model.",
        statusMessage: "Action log binding could not be verified.",
        dataQualityFlags: ["action_log_missing"],
        actionProofDecision: "review_required:action_log_unresolved" as const,
      };
    }

    if (actionLog.sourceRuntimeProofRef !== proof.sourceRuntimeProofRef) {
      return {
        ok: false,
        status: "failed" as const,
        failureReason: "action_binding_conflict" as const,
        reviewRequiredReason: null,
        statusMessage: "Action log binding conflicts with sourceRuntimeProofRef.",
        dataQualityFlags: ["action_binding_conflict"],
        actionProofDecision: "failed:action_log_runtime_proof_conflict" as const,
      };
    }
  }

  if (!input.context.evidenceReadPort.verifyProofRef(request, proof.sourceRuntimeProofRef)) {
    return {
      ok: false,
      status: "review_required" as const,
      failureReason: "source_runtime_proof_missing" as const,
      reviewRequiredReason: "sourceRuntimeProofRef is not yet verifiable from the governed proof chain.",
      statusMessage: "Action proof runtime proof binding could not be verified.",
      dataQualityFlags: ["source_runtime_proof_missing"],
      actionProofDecision: "review_required:source_runtime_proof_unverified" as const,
    };
  }

  return {
    ok: true,
    actionProofDecision: "allow" as const,
  };
}
