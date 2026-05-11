import { TextInputRuntimeProofSchema } from "../schema.js";
import { buildStableTextInputRef } from "../shared/text-input-types.js";

export function buildTextInputRuntimeProof(input: {
  attemptRef: string;
  missionId: string | null;
  runId: string | null;
  childCapabilityId: "type-text" | "paste-text" | "clear-input" | "replace-input" | "press-key" | "press-navigation-key" | "commit-input" | null;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string | null;
  bindingPackageId: string | null;
  bindingPackageVersion: string | null;
  selectedBindingId: string | null;
  bindingVersion: string | null;
  bindingActivationRef: string | null;
  bindingSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  sourceOwner: "commander-console" | "orchestration" | "ai" | "map-policy" | "human-approval" | null;
  sourceProofRef: string | null;
  sourceRef: string | null;
  idempotencyKey: string | null;
  inputRef: string;
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
  debugLogRef: string;
  structuredRuntimeEventRef: string;
  actionExecutionRef: string | null;
  primitiveExecutionRef: string | null;
  clearPrimitiveExecutionRef: string | null;
  writePrimitiveExecutionRef: string | null;
  operationRef: string | null;
  inputTextRef: string | null;
  inputTextHash: string | null;
  approvedTextRef: string | null;
  approvedTextHash: string | null;
  approvedTextSourceRef: string | null;
  approvedTextApprovalRef: string | null;
  typedTextHash: string | null;
  keySequenceHash: string | null;
  approvedCommitRef: string | null;
  inputTargetRef: string | null;
  targetRef: string | null;
  targetProofRef: string | null;
  targetProofOwner: "visual-target" | "geometry-guard" | "mouse-click" | "page-state" | "post-action-verification" | null;
  focusProofRef: string | null;
  focusProofOwner: "post-action-verification" | "page-state" | "mouse-click" | null;
  focusVerifiedAt: string | null;
  geometryGuardProofRef: string | null;
  mouseClickProofRef: string | null;
  postActionFocusVerificationRef: string | null;
  targetKind: "textField" | "searchField" | "commentComposer" | "editableArea" | "feedSurface" | null;
  targetEvidenceRefs: string[];
  actionKind: "type-text" | "paste-text" | "clear-input" | "replace-input" | "press-key" | "press-navigation-key" | "commit-input" | null;
  key: "Tab" | "Escape" | "Backspace" | "Delete" | "L" | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Enter" | null;
  textLength: number;
  policyDecision: "allow" | "block" | "review_required";
  sensitiveTextDecision: "allowed" | "blocked" | "review_required";
  redactionDecision: "masked" | "hash_only" | "none";
  keyPolicyDecision: "allowed" | "blocked_enter" | "blocked_modifier" | "blocked_unknown";
  outputBoundaryDecision: "valid" | "invalid_success_payload" | "invalid_failure_payload" | "review_required_clipboard_restore_failed";
  clipboardDecision: "not_used" | "snapshot_captured" | "prepared" | "restored" | "cleared" | "failed";
  clipboardSnapshotRef: string | null;
  clipboardProofRef: string | null;
  originalClipboardHash: string | null;
  restoredClipboardHash: string | null;
  commitPolicyRef: string | null;
  primitiveDecision: "not_run" | "started" | "succeeded" | "failed" | "aborted" | "timed_out";
  primitivePortKind: string;
  replaceWriteMode: "type-text" | "paste-text" | null;
  primitiveStartedAt: string | null;
  primitiveEndedAt: string | null;
  maxDurationMs: number;
  primitiveTimeoutMs: number;
  postActionVerificationHandoffRef: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
}) {
  return TextInputRuntimeProofSchema.parse({
    ...buildTextInputRuntimeProofIdentityFields(input),
    ...buildTextInputRuntimeProofArtifactFields(input),
    ...buildTextInputRuntimeProofTargetFields(input),
    ...buildTextInputRuntimeProofPolicyFields(input),
    ...buildTextInputRuntimeProofLifecycleFields(input),
    clock: buildTextInputRuntimeProofClock(input.clock),
  });
}

type TextInputRuntimeProofInput = Parameters<typeof buildTextInputRuntimeProof>[0];

export function buildTextInputRuntimeProofIdentityFields(input: Pick<TextInputRuntimeProofInput, "attemptRef" | "missionId" | "runId" | "childCapabilityId" | "sessionId" | "roundId" | "videoVisitId" | "stepId" | "bindingPackageId" | "bindingPackageVersion" | "selectedBindingId" | "bindingVersion" | "bindingActivationRef" | "bindingSnapshotRef" | "capabilityCallId" | "nerveBusEnvelopeId" | "sourceAbilityGroupId" | "sourceChildCapabilityId" | "sourceOwner" | "sourceProofRef" | "sourceRef" | "idempotencyKey" | "inputRef" | "outputRef" | "diagnosticPayloadRef" | "debugLogRef" | "structuredRuntimeEventRef">) {
  return {
    proofId: buildStableTextInputRef("text-input-proof", [input.attemptRef]),
    missionId: input.missionId,
    runId: input.runId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    stepId: input.stepId,
    bindingPackageId: input.bindingPackageId,
    bindingPackageVersion: input.bindingPackageVersion,
    selectedBindingId: input.selectedBindingId,
    bindingVersion: input.bindingVersion,
    bindingActivationRef: input.bindingActivationRef,
    bindingSnapshotRef: input.bindingSnapshotRef,
    capabilityCallId: input.capabilityCallId,
    nerveBusEnvelopeId: input.nerveBusEnvelopeId,
    abilityGroupId: "text-input",
    childCapabilityId: input.childCapabilityId,
    sourceAbilityGroupId: input.sourceAbilityGroupId,
    sourceChildCapabilityId: input.sourceChildCapabilityId,
    sourceOwner: input.sourceOwner,
    sourceProofRef: input.sourceProofRef,
    sourceRef: input.sourceRef,
    idempotencyKey: input.idempotencyKey,
    inputRef: input.inputRef,
    outputRef: input.outputRef,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
    debugLogRef: input.debugLogRef,
    structuredRuntimeEventRef: input.structuredRuntimeEventRef,
    attemptRef: input.attemptRef,
  };
}

export function buildTextInputRuntimeProofArtifactFields(input: Pick<TextInputRuntimeProofInput, "actionExecutionRef" | "primitiveExecutionRef" | "clearPrimitiveExecutionRef" | "writePrimitiveExecutionRef" | "operationRef" | "inputTextRef" | "inputTextHash" | "approvedTextRef" | "approvedTextHash" | "approvedTextSourceRef" | "approvedTextApprovalRef" | "typedTextHash" | "keySequenceHash" | "approvedCommitRef">) {
  return {
    actionExecutionRef: input.actionExecutionRef,
    primitiveExecutionRef: input.primitiveExecutionRef,
    clearPrimitiveExecutionRef: input.clearPrimitiveExecutionRef,
    writePrimitiveExecutionRef: input.writePrimitiveExecutionRef,
    operationRef: input.operationRef,
    inputTextRef: input.inputTextRef,
    inputTextHash: input.inputTextHash,
    approvedTextRef: input.approvedTextRef,
    approvedTextHash: input.approvedTextHash,
    approvedTextSourceRef: input.approvedTextSourceRef,
    approvedTextApprovalRef: input.approvedTextApprovalRef,
    typedTextHash: input.typedTextHash,
    keySequenceHash: input.keySequenceHash,
    approvedCommitRef: input.approvedCommitRef,
  };
}

export function buildTextInputRuntimeProofTargetFields(input: Pick<TextInputRuntimeProofInput, "inputTargetRef" | "targetRef" | "targetProofRef" | "targetProofOwner" | "focusProofRef" | "focusProofOwner" | "focusVerifiedAt" | "geometryGuardProofRef" | "mouseClickProofRef" | "postActionFocusVerificationRef" | "targetKind" | "targetEvidenceRefs">) {
  return {
    inputTargetRef: input.inputTargetRef,
    targetRef: input.targetRef,
    targetProofRef: input.targetProofRef,
    targetProofOwner: input.targetProofOwner,
    focusProofRef: input.focusProofRef,
    focusProofOwner: input.focusProofOwner,
    focusVerifiedAt: input.focusVerifiedAt,
    geometryGuardProofRef: input.geometryGuardProofRef,
    mouseClickProofRef: input.mouseClickProofRef,
    postActionFocusVerificationRef: input.postActionFocusVerificationRef,
    targetKind: input.targetKind,
    targetEvidenceRefs: input.targetEvidenceRefs,
  };
}

export function buildTextInputRuntimeProofPolicyFields(input: Pick<TextInputRuntimeProofInput, "actionKind" | "key" | "textLength" | "policyDecision" | "sensitiveTextDecision" | "redactionDecision" | "keyPolicyDecision" | "outputBoundaryDecision" | "clipboardDecision" | "clipboardSnapshotRef" | "clipboardProofRef" | "originalClipboardHash" | "restoredClipboardHash" | "commitPolicyRef">) {
  return {
    actionKind: input.actionKind,
    key: input.key,
    textLength: input.textLength,
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
  };
}

export function buildTextInputRuntimeProofLifecycleFields(input: Pick<TextInputRuntimeProofInput, "primitiveDecision" | "primitivePortKind" | "replaceWriteMode" | "primitiveStartedAt" | "primitiveEndedAt" | "maxDurationMs" | "primitiveTimeoutMs" | "postActionVerificationHandoffRef" | "startedAt" | "endedAt" | "durationMs" | "status" | "failureReason" | "reviewRequiredReason" | "dataQualityFlags">) {
  return {
    primitiveDecision: input.primitiveDecision,
    primitivePortKind: input.primitivePortKind,
    replaceWriteMode: input.replaceWriteMode,
    primitiveStartedAt: input.primitiveStartedAt,
    primitiveEndedAt: input.primitiveEndedAt,
    maxDurationMs: input.maxDurationMs,
    primitiveTimeoutMs: input.primitiveTimeoutMs,
    postActionVerificationRequired: true,
    postActionVerificationHandoffRef: input.postActionVerificationHandoffRef,
    verificationRefPolicy: "target_proof_ref+focus_proof_ref+approved_text_ref+action_execution_ref",
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    dataQualityFlags: input.dataQualityFlags,
  };
}

function buildTextInputRuntimeProofClock(clock: TextInputRuntimeProofInput["clock"]) {
  return {
    portKind: "system-monotonic-clock",
    startedMonotonicMs: clock.startedMonotonicMs,
    endedMonotonicMs: clock.endedMonotonicMs,
  };
}