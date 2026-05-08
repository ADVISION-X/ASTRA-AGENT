import { buildStableTextInputRef } from "../shared/text-input-types.js";
import type { TextInputResultSeed } from "./text-input-input-gate.js";
import {
  buildTextInputRuntimeProofArtifactFields,
  buildTextInputRuntimeProofIdentityFields,
  buildTextInputRuntimeProofLifecycleFields,
  buildTextInputRuntimeProofPolicyFields,
  buildTextInputRuntimeProofTargetFields,
} from "./text-input-proof-builder.js";

function buildTextInputResultChainFields(seed: Pick<TextInputResultSeed, "missionId" | "runId" | "stepId" | "mapPackageId" | "mapPackageVersion" | "selectedMapId" | "selectedMapVersion" | "activationId" | "activationSnapshotRef" | "capabilityCallId" | "nerveBusEnvelopeId" | "sourceRef">) {
  return {
    missionId: seed.missionId,
    runId: seed.runId,
    stepId: seed.stepId,
    mapPackageId: seed.mapPackageId,
    mapPackageVersion: seed.mapPackageVersion,
    selectedMapId: seed.selectedMapId,
    selectedMapVersion: seed.selectedMapVersion,
    activationId: seed.activationId,
    activationSnapshotRef: seed.activationSnapshotRef,
    capabilityCallId: seed.capabilityCallId,
    nerveBusEnvelopeId: seed.nerveBusEnvelopeId,
    sourceRef: seed.sourceRef,
  };
}

export function buildTextInputCandidateOutput(input: {
  seed: TextInputResultSeed;
  actionExecutionRef: string | null;
  primitiveExecutionRef: string | null;
  typedTextHash: string | null;
  keySequenceHash: string | null;
  status: "success" | "failed" | "review_required";
}, postActionVerificationHandoffRef: string | null) {
  if (
    input.status !== "success"
    || !input.actionExecutionRef
    || !input.primitiveExecutionRef
    || postActionVerificationHandoffRef === null
    || input.seed.childCapabilityId === null
  ) {
    return null;
  }

  return {
    attemptRef: input.seed.attemptRef,
    actionExecutionRef: input.actionExecutionRef,
    primitiveExecutionRef: input.primitiveExecutionRef,
    targetRef: input.seed.targetRef ?? input.seed.inputRef,
    targetKind: input.seed.targetKind ?? "textField",
    actionKind: input.seed.childCapabilityId,
    inputTextRef: input.seed.inputTextRef,
    inputTextHash: input.seed.inputTextHash,
    approvedTextRef: input.seed.approvedTextRef,
    approvedTextHash: input.seed.approvedTextHash,
    typedTextHash: input.typedTextHash,
    keySequenceHash: input.keySequenceHash,
    textLength: input.seed.inputText?.length ?? input.seed.approvedText?.length ?? 0,
    key: input.seed.key,
    postActionVerificationRequired: true as const,
    postActionVerificationHandoffRef,
  };
}

export function buildTextInputRuntimeProofIdentityInput(
  input: {
    seed: TextInputResultSeed;
    actionExecutionRef: string | null;
    primitiveExecutionRef: string | null;
    typedTextHash: string | null;
    keySequenceHash: string | null;
  },
  outputRef: string | null,
  diagnosticPayloadRef: string,
  debugBundle: { debugLogRef: string; structuredRuntimeEventRef: string },
) {
  return buildTextInputRuntimeProofIdentityFields({
    attemptRef: input.seed.attemptRef,
    missionId: input.seed.missionId,
    runId: input.seed.runId,
    childCapabilityId: input.seed.childCapabilityId,
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    stepId: input.seed.stepId,
    mapPackageId: input.seed.mapPackageId,
    mapPackageVersion: input.seed.mapPackageVersion,
    selectedMapId: input.seed.selectedMapId,
    selectedMapVersion: input.seed.selectedMapVersion,
    activationId: input.seed.activationId,
    activationSnapshotRef: input.seed.activationSnapshotRef,
    capabilityCallId: input.seed.capabilityCallId,
    nerveBusEnvelopeId: input.seed.nerveBusEnvelopeId,
    sourceAbilityGroupId: input.seed.sourceAbilityGroupId,
    sourceChildCapabilityId: input.seed.sourceChildCapabilityId,
    sourceOwner: input.seed.sourceOwner,
    sourceProofRef: input.seed.sourceProofRef,
    sourceRef: input.seed.sourceRef,
    idempotencyKey: input.seed.idempotencyKey,
    inputRef: input.seed.inputRef,
    outputRef,
    diagnosticPayloadRef,
    debugLogRef: debugBundle.debugLogRef,
    structuredRuntimeEventRef: debugBundle.structuredRuntimeEventRef,
  });
}

export function buildTextInputRuntimeProofArtifactInput(input: {
  seed: TextInputResultSeed;
  actionExecutionRef: string | null;
  primitiveExecutionRef: string | null;
  clearPrimitiveExecutionRef: string | null;
  writePrimitiveExecutionRef: string | null;
  operationRef: string | null;
  typedTextHash: string | null;
  keySequenceHash: string | null;
}) {
  return buildTextInputRuntimeProofArtifactFields({
    actionExecutionRef: input.actionExecutionRef,
    primitiveExecutionRef: input.primitiveExecutionRef,
    clearPrimitiveExecutionRef: input.clearPrimitiveExecutionRef,
    writePrimitiveExecutionRef: input.writePrimitiveExecutionRef,
    operationRef: input.operationRef,
    inputTextRef: input.seed.inputTextRef,
    inputTextHash: input.seed.inputTextHash,
    approvedTextRef: input.seed.approvedTextRef,
    approvedTextHash: input.seed.approvedTextHash,
    approvedTextSourceRef: input.seed.approvedTextSourceRef,
    approvedTextApprovalRef: input.seed.approvedTextApprovalRef,
    typedTextHash: input.typedTextHash,
    keySequenceHash: input.keySequenceHash,
    approvedCommitRef: input.seed.approvedCommitRef,
  });
}

export function buildTextInputRuntimeProofTargetInput(input: {
  seed: TextInputResultSeed;
}) {
  return buildTextInputRuntimeProofTargetFields({
    inputTargetRef: input.seed.inputTargetRef,
    targetRef: input.seed.targetRef,
    targetProofRef: input.seed.targetProofRef,
    targetProofOwner: input.seed.targetProofOwner as never,
    focusProofRef: input.seed.focusProofRef,
    focusProofOwner: input.seed.focusProofOwner as never,
    focusVerifiedAt: input.seed.focusVerifiedAt,
    geometryGuardProofRef: input.seed.geometryGuardProofRef,
    mouseClickProofRef: input.seed.mouseClickProofRef,
    postActionFocusVerificationRef: input.seed.postActionFocusVerificationRef,
    targetKind: input.seed.targetKind,
    targetEvidenceRefs: input.seed.targetEvidenceRefs,
  });
}

export function buildTextInputRuntimeProofPolicyInput(input: {
  seed: TextInputResultSeed;
  policyDecision: "allow" | "block" | "review_required";
  sensitiveTextDecision: "allowed" | "blocked" | "review_required";
  redactionDecision: "masked" | "hash_only" | "none";
  keyPolicyDecision: "allowed" | "blocked_enter" | "blocked_modifier" | "blocked_unknown";
  clipboardDecision: "not_used" | "snapshot_captured" | "prepared" | "restored" | "cleared" | "failed";
  clipboardSnapshotRef: string | null;
  clipboardProofRef: string | null;
  originalClipboardHash: string | null;
  restoredClipboardHash: string | null;
  commitPolicyRef: string | null;
  outputBoundaryDecision: "valid" | "invalid_success_payload" | "invalid_failure_payload" | "review_required_clipboard_restore_failed";
}) {
  return buildTextInputRuntimeProofPolicyFields({
    actionKind: input.seed.childCapabilityId,
    key: input.seed.key,
    textLength: input.seed.inputText?.length ?? input.seed.approvedText?.length ?? 0,
    policyDecision: input.policyDecision,
    sensitiveTextDecision: input.sensitiveTextDecision,
    redactionDecision: input.redactionDecision,
    keyPolicyDecision: input.keyPolicyDecision,
    outputBoundaryDecision: input.outputBoundaryDecision,
    clipboardDecision: input.clipboardDecision,
    clipboardSnapshotRef: input.clipboardSnapshotRef,
    clipboardProofRef: input.clipboardProofRef,
    originalClipboardHash: input.originalClipboardHash,
    restoredClipboardHash: input.restoredClipboardHash,
    commitPolicyRef: input.commitPolicyRef,
  });
}

export function buildTextInputRuntimeProofLifecycleInput(input: {
  seed: TextInputResultSeed;
  primitiveDecision: "not_run" | "started" | "succeeded" | "failed" | "aborted" | "timed_out";
  primitivePortKind: string;
  replaceWriteMode: "type-text" | "paste-text" | null;
  primitiveStartedAt: string | null;
  primitiveEndedAt: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
  postActionVerificationHandoffRef: string | null;
  outputBoundaryStatus: "success" | "failed" | "review_required";
}) {
  return buildTextInputRuntimeProofLifecycleFields({
    primitiveDecision: input.primitiveDecision,
    primitivePortKind: input.primitivePortKind,
    replaceWriteMode: input.replaceWriteMode,
    primitiveStartedAt: input.primitiveStartedAt,
    primitiveEndedAt: input.primitiveEndedAt,
    maxDurationMs: input.seed.policy.maxDurationMs,
    primitiveTimeoutMs: input.seed.policy.primitiveTimeoutMs,
    postActionVerificationHandoffRef: input.postActionVerificationHandoffRef,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.outputBoundaryStatus,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    dataQualityFlags: input.dataQualityFlags,
  });
}

export function buildTextInputAbilityResultPayload(
  input: {
    seed: TextInputResultSeed;
    policyDecision: "allow" | "block" | "review_required";
  },
  outputBoundary: {
    status: "success" | "failed" | "review_required";
    output: unknown;
    failureReason: string | null;
    reviewRequiredReason: string | null;
    statusMessage: string;
    dataQualityFlags: string[];
  },
  artifacts: {
    debugBundle: { debugLogRef: string; structuredRuntimeEventRef: string };
    diagnosticPayloadRef: string;
  },
  runtimeProof: unknown,
) {
  return {
    abilityGroupId: "text-input",
    childCapabilityId: input.seed.childCapabilityId,
    status: outputBoundary.status,
    ...buildTextInputResultChainFields(input.seed),
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    attemptRef: input.seed.attemptRef,
    output: outputBoundary.output,
    diagnosticPayloadRef: artifacts.diagnosticPayloadRef,
    failureReason: outputBoundary.failureReason,
    reviewRequiredReason: outputBoundary.reviewRequiredReason,
    statusMessage: outputBoundary.statusMessage,
    policyDecision: input.policyDecision,
    debugLogRef: artifacts.debugBundle.debugLogRef,
    structuredRuntimeEventRef: artifacts.debugBundle.structuredRuntimeEventRef,
    dataQualityFlags: outputBoundary.dataQualityFlags,
    runtimeProof,
  };
}
