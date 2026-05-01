import { POST_ACTION_CHILD_POLICY_MAP } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

function buildActionProofFailure(failureReason: string, actionProofDecision: string, statusMessage: string, dataQualityFlags: string[] = [failureReason]) {
  return {
    ok: false as const,
    status: (failureReason === "self_reported_success_only" || failureReason === "action_log_missing" || failureReason === "source_runtime_proof_missing" ? "review_required" : "failed") as "failed" | "review_required",
    failureReason: failureReason as "forbidden_action_source" | "self_reported_success_only" | "action_log_missing" | "missing_action_proof" | "source_runtime_proof_missing" | "action_binding_conflict",
    reviewRequiredReason: failureReason === "self_reported_success_only"
      ? "Self-reported action completion cannot be the only proof for final verification."
      : failureReason === "action_log_missing"
        ? "Action log could not be resolved from the governed read model."
        : failureReason === "source_runtime_proof_missing"
          ? "sourceRuntimeProofRef is not yet verifiable from the governed proof chain."
          : null,
    statusMessage,
    dataQualityFlags,
    actionProofDecision: actionProofDecision as string,
  };
}

function validateActionProofSourceCompatibility(input: {
  request: ParsedPostActionVerificationAbilityInput;
  proof: ParsedPostActionVerificationAbilityInput["actionProof"];
  childPolicy: (typeof POST_ACTION_CHILD_POLICY_MAP)[ParsedPostActionVerificationAbilityInput["childCapabilityId"]];
}) {
  const { request, proof, childPolicy } = input;

  if (proof.sourceAbilityGroupId !== childPolicy.allowedSourceAbilityGroupId) {
    return buildActionProofFailure(
      "forbidden_action_source",
      "failed:forbidden_action_source",
      `${request.childCapabilityId} does not accept action proofs from ${proof.sourceAbilityGroupId}.`,
      ["forbidden_action_source"],
    );
  }

  if (!(childPolicy.allowedSourceChildCapabilityIds as readonly string[]).includes(proof.sourceChildCapabilityId)) {
    return buildActionProofFailure(
      "forbidden_action_source",
      "failed:forbidden_action_source_child",
      `${request.childCapabilityId} does not accept action proofs from ${proof.sourceChildCapabilityId}.`,
      ["forbidden_action_source"],
    );
  }

  if (!(childPolicy.allowedActionTypes as readonly string[]).includes(proof.actionType)) {
    return buildActionProofFailure(
      "forbidden_action_source",
      "failed:forbidden_action_type",
      `${request.childCapabilityId} does not accept action type ${proof.actionType}.`,
      ["forbidden_action_source"],
    );
  }

  return { ok: true as const };
}

function resolveActionProofSelfReportedOnlyFailure(proof: ParsedPostActionVerificationAbilityInput["actionProof"]) {
  if (!proof.selfReportedOnly) {
    return null;
  }

  return buildActionProofFailure(
    "self_reported_success_only",
    "review_required:self_reported_only",
    "Action proof is self-reported only.",
    ["self_reported_only"],
  );
}

function resolveActionProofActionLogPresenceFailure(proof: ParsedPostActionVerificationAbilityInput["actionProof"]) {
  if (proof.actionLogRef !== null || proof.actionRecordRef !== null) {
    return null;
  }

  return buildActionProofFailure(
    "action_log_missing",
    "failed:action_log_missing",
    "Action proof must expose actionLogRef or actionRecordRef.",
    ["action_log_missing"],
  );
}

function resolveActionProofRequiredExecutionRefFailure(input: {
  request: ParsedPostActionVerificationAbilityInput;
  proof: ParsedPostActionVerificationAbilityInput["actionProof"];
  childPolicy: (typeof POST_ACTION_CHILD_POLICY_MAP)[ParsedPostActionVerificationAbilityInput["childCapabilityId"]];
}) {
  if (input.proof[input.childPolicy.requiredExecutionRef] !== null) {
    return null;
  }

  return buildActionProofFailure(
    "missing_action_proof",
    "failed:missing_required_execution_ref",
    `${input.childPolicy.requiredExecutionRef} is required for ${input.request.childCapabilityId}.`,
    ["action_execution_ref_missing"],
  );
}

function resolveActionProofSourceRuntimeProofFailure(proof: ParsedPostActionVerificationAbilityInput["actionProof"]) {
  if (proof.sourceRuntimeProofRef) {
    return null;
  }

  return buildActionProofFailure(
    "source_runtime_proof_missing",
    "failed:source_runtime_proof_missing",
    "Action proof must expose sourceRuntimeProofRef.",
    ["source_runtime_proof_missing"],
  );
}

function resolveActionProofBindingConflictFailure(input: {
  request: ParsedPostActionVerificationAbilityInput;
  proof: ParsedPostActionVerificationAbilityInput["actionProof"];
}) {
  if (input.proof.sessionId === input.request.sessionId && input.proof.roundId === input.request.roundId && input.proof.videoVisitId === input.request.videoVisitId) {
    return null;
  }

  return buildActionProofFailure(
    "action_binding_conflict",
    "failed:binding_conflict",
    "Action proof binding does not match verification session, round, or video visit.",
    ["action_binding_conflict"],
  );
}

function validateActionProofGovernedFields(input: {
  request: ParsedPostActionVerificationAbilityInput;
  proof: ParsedPostActionVerificationAbilityInput["actionProof"];
  childPolicy: (typeof POST_ACTION_CHILD_POLICY_MAP)[ParsedPostActionVerificationAbilityInput["childCapabilityId"]];
}) {
  for (const failure of [
    resolveActionProofSelfReportedOnlyFailure(input.proof),
    resolveActionProofActionLogPresenceFailure(input.proof),
    resolveActionProofRequiredExecutionRefFailure(input),
    resolveActionProofSourceRuntimeProofFailure(input.proof),
    resolveActionProofBindingConflictFailure({ request: input.request, proof: input.proof }),
  ]) {
    if (failure) return failure;
  }

  return { ok: true as const };
}

function validateActionProofLogAndRuntimeBinding(input: {
  request: ParsedPostActionVerificationAbilityInput;
  proof: ParsedPostActionVerificationAbilityInput["actionProof"];
  context: PostActionVerificationRuntimeContext;
}) {
  const { request, proof, context } = input;
  const actionLogRef = proof.actionLogRef ?? proof.actionRecordRef;

  if (actionLogRef !== null) {
    const actionLog = context.evidenceReadPort.getActionLogByRef(request, actionLogRef);
    if (actionLog === null) {
      return buildActionProofFailure(
        "action_log_missing",
        "review_required:action_log_unresolved",
        "Action log binding could not be verified.",
        ["action_log_missing"],
      );
    }

    if (actionLog.sourceRuntimeProofRef !== proof.sourceRuntimeProofRef) {
      return buildActionProofFailure(
        "action_binding_conflict",
        "failed:action_log_runtime_proof_conflict",
        "Action log binding conflicts with sourceRuntimeProofRef.",
        ["action_binding_conflict"],
      );
    }
  }

  if (!context.evidenceReadPort.verifyProofRef(request, proof.sourceRuntimeProofRef)) {
    return buildActionProofFailure(
      "source_runtime_proof_missing",
      "review_required:source_runtime_proof_unverified",
      "Action proof runtime proof binding could not be verified.",
      ["source_runtime_proof_missing"],
    );
  }

  return { ok: true as const };
}

export function validateActionProof(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
}) {
  const request = input.request;
  const proof = request.actionProof;
  const childPolicy = POST_ACTION_CHILD_POLICY_MAP[request.childCapabilityId];
  const sourceCompatibility = validateActionProofSourceCompatibility({ request, proof, childPolicy });
  if (!sourceCompatibility.ok) {
    return sourceCompatibility;
  }

  const governedFields = validateActionProofGovernedFields({ request, proof, childPolicy });
  if (!governedFields.ok) {
    return governedFields;
  }

  const binding = validateActionProofLogAndRuntimeBinding({ request, proof, context: input.context });
  if (!binding.ok) {
    return binding;
  }

  return {
    ok: true,
    actionProofDecision: "allow" as const,
  };
}
