import type { TextInputChildCapabilityId } from "../contract.js";
import { buildTextInputResult } from "./text-input-result-builder.js";
import { resolveTextInputFailureSeed } from "./text-input-input-gate.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";

export function dispatchTextInputFailure(input: {
  rawInput: unknown;
  context: TextInputRuntimeContext;
  childCapabilityId?: TextInputChildCapabilityId;
  failureReason: "input_schema_invalid" | "unknown_child_capability" | "child_execution_failed";
  statusMessage: string;
}) {
  const seed = resolveTextInputFailureSeed(input.rawInput, input.childCapabilityId);
  const startedSnapshot = input.context.clock.now();
  const endedSnapshot = input.context.clock.now();

  return buildTextInputResult({
    seed: {
      ...seed,
      childCapabilityId: input.childCapabilityId ?? seed.childCapabilityId,
    },
    actionExecutionRef: null,
    primitiveExecutionRef: null,
    clearPrimitiveExecutionRef: null,
    writePrimitiveExecutionRef: null,
    operationRef: null,
    status: "failed",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    statusMessage: input.statusMessage,
    policyDecision: "block",
    sensitiveTextDecision: "allowed",
    redactionDecision: "masked",
    keyPolicyDecision: "allowed",
    clipboardDecision: "not_used",
    clipboardSnapshotRef: null,
    clipboardProofRef: null,
    originalClipboardHash: null,
    restoredClipboardHash: null,
    commitPolicyRef: null,
    typedTextHash: null,
    keySequenceHash: null,
    primitiveDecision: "not_run",
    primitivePortKind: "not-run",
    replaceWriteMode: null,
    primitiveStartedAt: null,
    primitiveEndedAt: null,
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    dataQualityFlags: [input.failureReason],
  });
}