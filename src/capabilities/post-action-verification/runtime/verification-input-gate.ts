import { POST_ACTION_CHILD_POLICY_MAP } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";

function hasRequestedContextBindings(request: ParsedPostActionVerificationAbilityInput) {
  const requiredBindings = [
    request.requestedBy,
    request.missionId,
    request.runId,
    request.sessionId,
    request.stepId,
    request.mapPackageId,
    request.mapPackageVersion,
    request.selectedMapId,
    request.selectedMapVersion,
    request.activationSnapshotRef,
    request.capabilityCallId,
    request.nerveBusEnvelopeId,
    request.inputRef,
    request.idempotencyKey,
  ];

  return requiredBindings.every(Boolean);
}

function createInputGateFailure(
  statusMessage: string,
  dataQualityFlag: string,
  failureReason: "missing_expected_outcome" | "missing_requested_context" | "action_status_not_success" | "source_runtime_proof_missing",
) {
  return {
    ok: false as const,
    status: "failed" as const,
    failureReason,
    reviewRequiredReason: null,
    statusMessage,
    dataQualityFlags: [dataQualityFlag],
    inputDecision: `failed:${failureReason}` as const,
  };
}

function resolveExpectedOutcomeFailure(request: ParsedPostActionVerificationAbilityInput) {
  const childPolicy = POST_ACTION_CHILD_POLICY_MAP[request.childCapabilityId];
  if (request.expectedOutcome.outcomeType === childPolicy.expectedOutcomeType) {
    return null;
  }

  return createInputGateFailure(
    `Expected outcome ${childPolicy.expectedOutcomeType} is required for ${request.childCapabilityId}.`,
    "expected_outcome_mismatch",
    "missing_expected_outcome",
  );
}

function resolveRequestedContextFailure(request: ParsedPostActionVerificationAbilityInput) {
  if (hasRequestedContextBindings(request)) {
    return null;
  }

  return createInputGateFailure(
    "Post Action Verification requires requestedBy, mission/run/step/map chain refs, activationSnapshotRef, capabilityCallId, nerveBusEnvelopeId, inputRef, and idempotencyKey bindings.",
    "requested_context_missing",
    "missing_requested_context",
  );
}

function resolveActionStatusFailure(request: ParsedPostActionVerificationAbilityInput) {
  if (request.actionProof.actionStatus === "success") {
    return null;
  }

  return createInputGateFailure(
    "Post Action Verification cannot verify a failed or blocked action as successful.",
    "action_not_success",
    "action_status_not_success",
  );
}

function resolveSourceRuntimeProofFailure(request: ParsedPostActionVerificationAbilityInput) {
  if (request.actionProof.sourceRuntimeProofRef) {
    return null;
  }

  return createInputGateFailure(
    "sourceRuntimeProofRef is required for governed verification.",
    "source_runtime_proof_missing",
    "source_runtime_proof_missing",
  );
}

export function validatePostActionVerificationInput(request: ParsedPostActionVerificationAbilityInput) {
  return (
    resolveExpectedOutcomeFailure(request) ??
    resolveRequestedContextFailure(request) ??
    resolveActionStatusFailure(request) ??
    resolveSourceRuntimeProofFailure(request) ?? {
      ok: true as const,
      inputDecision: "allow" as const,
    }
  );
}