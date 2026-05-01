import { buildStableTextInputRef } from "../shared/text-input-types.js";
import type { ParsedTextInputAbilityInput } from "../contract.js";
import { buildTextInputResult } from "./text-input-result-builder.js";
import type { TextInputExecutionSeed, TextInputResultSeed } from "./text-input-input-gate.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";

type ExecutionStatus = "success" | "failed" | "review_required";
type PolicyDecision = "allow" | "block" | "review_required";
type SensitiveTextDecision = "allowed" | "blocked" | "review_required";
type RedactionDecision = "masked" | "hash_only" | "none";
type KeyPolicyDecision = "allowed" | "blocked_enter" | "blocked_modifier" | "blocked_unknown";
type ClipboardDecision = "not_used" | "snapshot_captured" | "prepared" | "restored" | "cleared" | "failed";
type PrimitiveDecision = "not_run" | "started" | "succeeded" | "failed" | "aborted" | "timed_out";
type ClockSnapshot = { isoTimestamp: string; monotonicMs: number };

type ExecutionRefs = {
  actionExecutionRef: string | null;
  primitiveExecutionRef: string | null;
  clearPrimitiveExecutionRef: string | null;
  writePrimitiveExecutionRef: string | null;
  operationRef: string | null;
};

type ExecutionStatusFields = {
  status: ExecutionStatus;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: PolicyDecision;
};

type ExecutionPrimitiveFields = {
  primitiveDecision: PrimitiveDecision;
  primitivePortKind: string;
  primitiveStartedAt: string | null;
  primitiveEndedAt: string | null;
};

type ExecutionTimingFields = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
};

type TextInputRuntimeDecisionState = {
  policyDecision: PolicyDecision;
  sensitiveTextDecision: SensitiveTextDecision;
  redactionDecision: RedactionDecision;
  keyPolicyDecision: KeyPolicyDecision;
  clipboardDecision: ClipboardDecision;
  clipboardSnapshotRef: string | null;
  clipboardProofRef: string | null;
  originalClipboardHash: string | null;
  restoredClipboardHash: string | null;
  commitPolicyRef: string | null;
  typedTextHash: string | null;
  keySequenceHash: string | null;
  replaceWriteMode: "type-text" | "paste-text" | null;
  dataQualityFlags: string[];
};

type TextInputExecutionResultDraft = {
  seed: TextInputResultSeed;
  refs: ExecutionRefs;
  status: ExecutionStatusFields;
  state: TextInputRuntimeDecisionState;
  primitive: ExecutionPrimitiveFields;
  timing: ExecutionTimingFields;
};

function buildExecutionRefs(input: ExecutionRefs) {
  return {
    actionExecutionRef: input.actionExecutionRef,
    primitiveExecutionRef: input.primitiveExecutionRef,
    clearPrimitiveExecutionRef: input.clearPrimitiveExecutionRef,
    writePrimitiveExecutionRef: input.writePrimitiveExecutionRef,
    operationRef: input.operationRef,
  };
}

function buildExecutionStatus(input: ExecutionStatusFields) {
  return {
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    policyDecision: input.policyDecision,
  };
}

function buildExecutionState(input: TextInputRuntimeDecisionState) {
  return {
    sensitiveTextDecision: input.sensitiveTextDecision,
    redactionDecision: input.redactionDecision,
    keyPolicyDecision: input.keyPolicyDecision,
    clipboardDecision: input.clipboardDecision,
    clipboardSnapshotRef: input.clipboardSnapshotRef,
    clipboardProofRef: input.clipboardProofRef,
    originalClipboardHash: input.originalClipboardHash,
    restoredClipboardHash: input.restoredClipboardHash,
    commitPolicyRef: input.commitPolicyRef,
    typedTextHash: input.typedTextHash,
    keySequenceHash: input.keySequenceHash,
    replaceWriteMode: input.replaceWriteMode,
    dataQualityFlags: input.dataQualityFlags,
  };
}

function buildExecutionPrimitive(input: ExecutionPrimitiveFields) {
  return {
    primitiveDecision: input.primitiveDecision,
    primitivePortKind: input.primitivePortKind,
    primitiveStartedAt: input.primitiveStartedAt,
    primitiveEndedAt: input.primitiveEndedAt,
  };
}

function buildExecutionTiming(input: ExecutionTimingFields) {
  return {
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    clock: input.clock,
  };
}

function buildTextInputExecutionResult(input: TextInputExecutionResultDraft) {
  return buildTextInputResult({
    seed: input.seed,
    ...buildExecutionRefs(input.refs),
    ...buildExecutionStatus(input.status),
    ...buildExecutionState(input.state),
    ...buildExecutionPrimitive(input.primitive),
    ...buildExecutionTiming(input.timing),
  });
}

function createInitialDecisionState(request: ParsedTextInputAbilityInput): TextInputRuntimeDecisionState {
  return {
    policyDecision: "allow",
    sensitiveTextDecision: "allowed",
    redactionDecision: request.policy.redactionPolicy.mode === "hash_only"
      ? "hash_only"
      : request.policy.redactionPolicy.mode === "none"
        ? "none"
        : "masked",
    keyPolicyDecision: "allowed",
    clipboardDecision: "not_used",
    clipboardSnapshotRef: null,
    clipboardProofRef: null,
    originalClipboardHash: null,
    restoredClipboardHash: null,
    commitPolicyRef: null,
    typedTextHash: null,
    keySequenceHash: null,
    replaceWriteMode: request.childCapabilityId === "replace-input" ? request.policy.replacePolicy.writeMode : null,
    dataQualityFlags: [],
  };
}

function mergeFlags(...groups: string[][]): string[] {
  return [...new Set(groups.flat().filter((value) => value.length > 0))];
}

function createTextInputActionExecutionRef(seed: TextInputExecutionSeed) {
  return buildStableTextInputRef("text-input-action", [seed.attemptRef, seed.childCapabilityId]);
}

function buildRejectedTextInputResult(input: {
  seed: TextInputResultSeed;
  context: TextInputRuntimeContext;
  state: TextInputRuntimeDecisionState;
  status: "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: PolicyDecision;
  dataQualityFlags: string[];
}) {
  const startedSnapshot = input.context.clock.now();
  const endedSnapshot = input.context.clock.now();
  const resultState = {
    ...input.state,
    dataQualityFlags: input.dataQualityFlags,
  };

  return buildTextInputExecutionResult({
    seed: input.seed,
    refs: {
      actionExecutionRef: null,
      primitiveExecutionRef: null,
      clearPrimitiveExecutionRef: null,
      writePrimitiveExecutionRef: null,
      operationRef: null,
    },
    status: {
      status: input.status,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason,
      statusMessage: input.statusMessage,
      policyDecision: input.policyDecision,
    },
    state: resultState,
    primitive: {
      primitiveDecision: "not_run",
      primitivePortKind: "not-run",
      primitiveStartedAt: null,
      primitiveEndedAt: null,
    },
    timing: {
      startedAt: startedSnapshot.isoTimestamp,
      endedAt: endedSnapshot.isoTimestamp,
      durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
      clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    },
  });
}

function buildClipboardUnavailableFailureResult(input: {
  seed: TextInputResultSeed;
  context: TextInputRuntimeContext;
  state: TextInputRuntimeDecisionState;
  statusMessage: string;
  dataQualityFlags: string[];
}) {
  return buildRejectedTextInputResult({
    seed: input.seed,
    context: input.context,
    state: input.state,
    status: "failed",
    failureReason: "clipboard_unavailable",
    reviewRequiredReason: null,
    statusMessage: input.statusMessage,
    policyDecision: "block",
    dataQualityFlags: input.dataQualityFlags,
  });
}

export async function restoreClipboardAfterOperation(input: {
  context: TextInputRuntimeContext;
  request: ParsedTextInputAbilityInput;
  state: TextInputRuntimeDecisionState;
  backupText: string | null;
  backupExists: boolean;
}) {
  if (!input.backupExists) {
    return;
  }

  if (input.request.policy.clipboardPolicy.restoreStrategy === "clear_after_operation"
    || input.request.policy.clipboardPolicy.clearClipboardAfterOperation === true) {
    const clearResult = await input.context.clipboardPort.writeText("");
    input.state.clipboardDecision = clearResult.ok ? "cleared" : "failed";
    input.state.restoredClipboardHash = clearResult.textHash;
    if (!clearResult.ok) {
      input.state.dataQualityFlags = mergeFlags(input.state.dataQualityFlags, ["clipboard_restore_failed"]);
    }
    return;
  }

  const restoreResult = await input.context.clipboardPort.writeText(input.backupText ?? "");
  input.state.clipboardDecision = restoreResult.ok ? "restored" : "failed";
  input.state.restoredClipboardHash = restoreResult.textHash;
  if (!restoreResult.ok) {
    input.state.dataQualityFlags = mergeFlags(input.state.dataQualityFlags, ["clipboard_restore_failed"]);
  }
}


export { buildTextInputExecutionResult, createInitialDecisionState, mergeFlags, createTextInputActionExecutionRef, buildRejectedTextInputResult, buildClipboardUnavailableFailureResult };
export type { TextInputRuntimeDecisionState, TextInputExecutionResultDraft };
