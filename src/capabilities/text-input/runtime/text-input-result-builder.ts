import { TextInputAbilityResultSchema } from "../schema.js";
import { buildStableTextInputRef } from "../shared/text-input-types.js";
import type { TextInputResultSeed } from "./text-input-input-gate.js";
import { buildTextInputDebugBundle } from "./text-input-debug-events.js";
import { validateTextInputOutputBoundary } from "./text-input-output-boundary-gate.js";
import { buildTextInputRuntimeProof } from "./text-input-proof-builder.js";

export function buildTextInputResult(input: {
  seed: TextInputResultSeed;
  actionExecutionRef: string | null;
  primitiveExecutionRef: string | null;
  clearPrimitiveExecutionRef: string | null;
  writePrimitiveExecutionRef: string | null;
  operationRef: string | null;
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
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
  typedTextHash: string | null;
  keySequenceHash: string | null;
  primitiveDecision: "not_run" | "started" | "succeeded" | "failed" | "aborted" | "timed_out";
  primitivePortKind: string;
  replaceWriteMode: "type-text" | "paste-text" | null;
  primitiveStartedAt: string | null;
  primitiveEndedAt: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
  dataQualityFlags: string[];
}) {
  const postActionVerificationRequired = input.status === "success";
  const postActionVerificationHandoffRef = postActionVerificationRequired && input.actionExecutionRef && input.primitiveExecutionRef
    ? buildStableTextInputRef("text-input-post-action-verification", [input.actionExecutionRef, input.primitiveExecutionRef])
    : null;
  const candidateOutput = input.status === "success"
    && input.actionExecutionRef
    && input.primitiveExecutionRef
    && postActionVerificationHandoffRef !== null
    && input.seed.childCapabilityId !== null
    ? {
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
      }
    : null;

  const outputBoundary = validateTextInputOutputBoundary({
    requestedStatus: input.status,
    candidateOutput,
    failureReason: input.failureReason as never,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    dataQualityFlags: input.dataQualityFlags,
  });
  const debugBundle = buildTextInputDebugBundle({
    seed: input.seed,
    status: outputBoundary.status,
    clipboardDecision: input.clipboardDecision,
    dataQualityFlags: outputBoundary.dataQualityFlags,
  });
  const diagnosticPayloadRef = debugBundle.diagnosticPayloadRef;
  const outputRef = outputBoundary.status === "success"
    ? buildStableTextInputRef("text-input-output", [input.seed.attemptRef, outputBoundary.status])
    : null;

  const runtimeProof = buildTextInputRuntimeProof({
    attemptRef: input.seed.attemptRef,
    childCapabilityId: input.seed.childCapabilityId,
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    sourceAbilityGroupId: input.seed.sourceAbilityGroupId,
    sourceChildCapabilityId: input.seed.sourceChildCapabilityId,
    sourceOwner: input.seed.sourceOwner,
    sourceProofRef: input.seed.sourceProofRef,
    inputRef: input.seed.inputRef,
    outputRef,
    diagnosticPayloadRef,
    debugLogRef: debugBundle.debugLogRef,
    structuredRuntimeEventRef: debugBundle.structuredRuntimeEventRef,
    actionExecutionRef: input.actionExecutionRef,
    primitiveExecutionRef: input.primitiveExecutionRef,
    clearPrimitiveExecutionRef: input.clearPrimitiveExecutionRef,
    writePrimitiveExecutionRef: input.writePrimitiveExecutionRef,
    operationRef: input.operationRef,
    inputTextRef: input.seed.inputTextRef,
    inputTextHash: input.seed.inputTextHash,
    approvedTextRef: input.seed.approvedTextRef,
    approvedTextHash: input.seed.approvedTextHash,
    typedTextHash: input.typedTextHash,
    keySequenceHash: input.keySequenceHash,
    approvedCommitRef: input.seed.approvedCommitRef,
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
    actionKind: input.seed.childCapabilityId,
    key: input.seed.key,
    textLength: input.seed.inputText?.length ?? input.seed.approvedText?.length ?? 0,
    policyDecision: input.policyDecision,
    sensitiveTextDecision: input.sensitiveTextDecision,
    redactionDecision: input.redactionDecision,
    keyPolicyDecision: input.keyPolicyDecision,
    outputBoundaryDecision: outputBoundary.outputBoundaryDecision,
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
    maxDurationMs: input.seed.policy.maxDurationMs,
    primitiveTimeoutMs: input.seed.policy.primitiveTimeoutMs,
    postActionVerificationHandoffRef,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: outputBoundary.status,
    failureReason: outputBoundary.failureReason,
    reviewRequiredReason: outputBoundary.reviewRequiredReason,
    dataQualityFlags: outputBoundary.dataQualityFlags,
    clock: input.clock,
  });

  return TextInputAbilityResultSchema.parse({
    abilityGroupId: "text-input",
    childCapabilityId: input.seed.childCapabilityId,
    status: outputBoundary.status,
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    attemptRef: input.seed.attemptRef,
    output: outputBoundary.output,
    diagnosticPayloadRef,
    failureReason: outputBoundary.failureReason,
    reviewRequiredReason: outputBoundary.reviewRequiredReason,
    statusMessage: outputBoundary.statusMessage,
    policyDecision: input.policyDecision,
    debugLogRef: debugBundle.debugLogRef,
    structuredRuntimeEventRef: debugBundle.structuredRuntimeEventRef,
    dataQualityFlags: outputBoundary.dataQualityFlags,
    runtimeProof,
  });
}