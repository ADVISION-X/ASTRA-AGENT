import { TextInputRuntimeProofSchema } from "../schema.js";
import { buildStableTextInputRef } from "../shared/text-input-types.js";

export function buildTextInputRuntimeProof(input: {
  attemptRef: string;
  childCapabilityId: "type-text" | "paste-text" | "clear-input" | "replace-input" | "press-key" | "commit-input" | null;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  sourceOwner: "commander-console" | "orchestration" | "ai" | "map-policy" | "human-approval" | null;
  sourceProofRef: string | null;
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
  typedTextHash: string | null;
  keySequenceHash: string | null;
  approvedCommitRef: string | null;
  targetRef: string | null;
  targetProofRef: string | null;
  targetProofOwner: "visual-target" | "geometry-guard" | "mouse-click" | "page-state" | "post-action-verification" | null;
  focusProofRef: string | null;
  focusProofOwner: "post-action-verification" | "page-state" | "mouse-click" | null;
  focusVerifiedAt: string | null;
  geometryGuardProofRef: string | null;
  mouseClickProofRef: string | null;
  postActionFocusVerificationRef: string | null;
  targetKind: "textField" | "searchField" | "commentComposer" | "editableArea" | null;
  targetEvidenceRefs: string[];
  actionKind: "type-text" | "paste-text" | "clear-input" | "replace-input" | "press-key" | "commit-input" | null;
  key: "Tab" | "Escape" | "Backspace" | "Delete" | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Enter" | null;
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
    proofId: buildStableTextInputRef("text-input-proof", [input.attemptRef, input.status]),
    runId: buildStableTextInputRef("text-input-run", [input.attemptRef]),
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    abilityGroupId: "text-input",
    childCapabilityId: input.childCapabilityId,
    sourceAbilityGroupId: input.sourceAbilityGroupId,
    sourceChildCapabilityId: input.sourceChildCapabilityId,
    sourceOwner: input.sourceOwner,
    sourceProofRef: input.sourceProofRef,
    inputRef: input.inputRef,
    outputRef: input.outputRef,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
    debugLogRef: input.debugLogRef,
    structuredRuntimeEventRef: input.structuredRuntimeEventRef,
    attemptRef: input.attemptRef,
    actionExecutionRef: input.actionExecutionRef,
    primitiveExecutionRef: input.primitiveExecutionRef,
    clearPrimitiveExecutionRef: input.clearPrimitiveExecutionRef,
    writePrimitiveExecutionRef: input.writePrimitiveExecutionRef,
    operationRef: input.operationRef,
    inputTextRef: input.inputTextRef,
    inputTextHash: input.inputTextHash,
    approvedTextRef: input.approvedTextRef,
    approvedTextHash: input.approvedTextHash,
    typedTextHash: input.typedTextHash,
    keySequenceHash: input.keySequenceHash,
    approvedCommitRef: input.approvedCommitRef,
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
    clock: {
      portKind: "system-monotonic-clock",
      startedMonotonicMs: input.clock.startedMonotonicMs,
      endedMonotonicMs: input.clock.endedMonotonicMs,
    },
  });
}