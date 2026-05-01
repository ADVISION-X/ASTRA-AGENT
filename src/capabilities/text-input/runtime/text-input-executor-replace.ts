import { buildStableTextInputRef } from "../shared/text-input-types.js";
import type { TextInputExecutionSeed } from "./text-input-input-gate.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";
import {
  mergeFlags,
  type TextInputExecutionResultDraft,
  type TextInputRuntimeDecisionState,
} from "./text-input-execution-support.js";
import { runPrimitiveTextInput } from "./primitive-text-input-runner.js";

type PrimitiveTextInputRunResult = Awaited<ReturnType<typeof runPrimitiveTextInput>>;

function buildReplaceInputClearFailureDraft(input: {
  seed: TextInputExecutionSeed;
  actionExecutionRef: string;
  state: TextInputRuntimeDecisionState;
  clearResult: PrimitiveTextInputRunResult;
}) {
  return {
    seed: input.seed,
    refs: {
      actionExecutionRef: input.actionExecutionRef,
      primitiveExecutionRef: input.clearResult.primitiveExecutionRef,
      clearPrimitiveExecutionRef: input.clearResult.primitiveExecutionRef,
      writePrimitiveExecutionRef: null,
      operationRef: input.clearResult.operationRef,
    },
    status: {
      status: "failed" as const,
      failureReason: input.clearResult.failureReason ?? "primitive_failed",
      reviewRequiredReason: null,
      statusMessage: input.clearResult.statusMessage,
      policyDecision: input.state.policyDecision,
    },
    state: input.state,
    primitive: {
      primitiveDecision: input.clearResult.primitiveDecision,
      primitivePortKind: input.clearResult.primitivePortKind,
      primitiveStartedAt: input.clearResult.primitiveStartedAt,
      primitiveEndedAt: input.clearResult.primitiveEndedAt,
    },
    timing: {
      startedAt: input.clearResult.startedAt,
      endedAt: input.clearResult.endedAt,
      durationMs: input.clearResult.durationMs,
      clock: input.clearResult.clock,
    },
  } satisfies TextInputExecutionResultDraft;
}

function buildReplaceInputExecutionRefs(input: {
  actionExecutionRef: string;
  clearResult: PrimitiveTextInputRunResult;
  writeResult: PrimitiveTextInputRunResult;
  writeChildCapabilityId: "paste-text" | "type-text";
}) {
  const operationRef = buildStableTextInputRef("text-input-replace-operation", [
    input.clearResult.primitiveExecutionRef,
    input.writeResult.primitiveExecutionRef,
    input.writeChildCapabilityId,
  ]);
  const replacePrimitiveExecutionRef = input.writeResult.primitiveExecutionRef === null
    ? null
    : buildStableTextInputRef("text-input-replace-primitive", [input.clearResult.primitiveExecutionRef, input.writeResult.primitiveExecutionRef]);

  return {
    actionExecutionRef: input.actionExecutionRef,
    primitiveExecutionRef: replacePrimitiveExecutionRef,
    clearPrimitiveExecutionRef: input.clearResult.primitiveExecutionRef,
    writePrimitiveExecutionRef: input.writeResult.primitiveExecutionRef,
    operationRef,
  };
}

function buildReplaceInputExecutionStatus(input: {
  state: TextInputRuntimeDecisionState;
  writeResult: PrimitiveTextInputRunResult;
}) {
  return {
    status: input.writeResult.ok ? ("success" as const) : ("failed" as const),
    failureReason: input.writeResult.ok ? null : input.writeResult.failureReason ?? "primitive_failed",
    reviewRequiredReason: null,
    statusMessage: input.writeResult.ok
      ? "Text Input replace-input completed as clear followed by governed write."
      : input.writeResult.statusMessage,
    policyDecision: input.state.policyDecision,
  };
}

function buildReplaceInputExecutionPrimitive(input: {
  clearResult: PrimitiveTextInputRunResult;
  writeResult: PrimitiveTextInputRunResult;
}) {
  return {
    primitiveDecision: input.writeResult.primitiveDecision,
    primitivePortKind: input.writeResult.primitivePortKind,
    primitiveStartedAt: input.clearResult.primitiveStartedAt,
    primitiveEndedAt: input.writeResult.primitiveEndedAt,
  };
}

function buildReplaceInputExecutionTiming(input: {
  clearResult: PrimitiveTextInputRunResult;
  writeResult: PrimitiveTextInputRunResult;
}) {
  return {
    startedAt: input.clearResult.startedAt,
    endedAt: input.writeResult.endedAt,
    durationMs: input.clearResult.durationMs + input.writeResult.durationMs,
    clock: {
      startedMonotonicMs: input.clearResult.clock.startedMonotonicMs,
      endedMonotonicMs: input.writeResult.clock.endedMonotonicMs,
    },
  };
}

function buildReplaceInputSuccessDraft(input: {
  seed: TextInputExecutionSeed;
  actionExecutionRef: string;
  state: TextInputRuntimeDecisionState;
  clearResult: PrimitiveTextInputRunResult;
  writeResult: PrimitiveTextInputRunResult;
  writeChildCapabilityId: "paste-text" | "type-text";
}) {
  const refs = buildReplaceInputExecutionRefs({
    actionExecutionRef: input.actionExecutionRef,
    clearResult: input.clearResult,
    writeResult: input.writeResult,
    writeChildCapabilityId: input.writeChildCapabilityId,
  });
  const status = buildReplaceInputExecutionStatus({ state: input.state, writeResult: input.writeResult });
  const primitive = buildReplaceInputExecutionPrimitive({ clearResult: input.clearResult, writeResult: input.writeResult });
  const timing = buildReplaceInputExecutionTiming({ clearResult: input.clearResult, writeResult: input.writeResult });

  return {
    seed: input.seed,
    refs,
    status,
    state: input.state,
    primitive,
    timing,
  } satisfies TextInputExecutionResultDraft;
}

async function runReplaceInputClearStep(input: {
  context: TextInputRuntimeContext;
  seed: TextInputExecutionSeed;
  actionExecutionRef: string;
  state: TextInputRuntimeDecisionState;
}) {
  const clearResult = await runPrimitiveTextInput({
    context: input.context,
    attemptRef: input.seed.attemptRef,
    actionExecutionRef: input.actionExecutionRef,
    childCapabilityId: "clear-input",
    targetRef: input.seed.targetRef,
    targetKind: input.seed.targetKind,
    inputText: null,
    inputTextHash: null,
    key: null,
    timeoutMs: input.seed.policy.primitiveTimeoutMs,
  });

  if (clearResult.ok) {
    return {
      ok: true as const,
      clearResult,
    };
  }

  input.state.dataQualityFlags = mergeFlags(input.state.dataQualityFlags, clearResult.dataQualityFlags);
  return {
    ok: false as const,
    draft: buildReplaceInputClearFailureDraft({
      seed: input.seed,
      actionExecutionRef: input.actionExecutionRef,
      state: input.state,
      clearResult,
    }),
  };
}

async function runReplaceInputWriteStep(input: {
  context: TextInputRuntimeContext;
  seed: TextInputExecutionSeed;
  actionExecutionRef: string;
  state: TextInputRuntimeDecisionState;
  clearResult: PrimitiveTextInputRunResult;
}) {
  const writeChildCapabilityId = input.seed.policy.replacePolicy.writeMode === "paste-text" ? "paste-text" : "type-text";
  const writeResult = await runPrimitiveTextInput({
    context: input.context,
    attemptRef: input.seed.attemptRef,
    actionExecutionRef: input.actionExecutionRef,
    childCapabilityId: writeChildCapabilityId,
    targetRef: input.seed.targetRef,
    targetKind: input.seed.targetKind,
    inputText: input.seed.inputText,
    inputTextHash: input.seed.inputTextHash,
    key: null,
    timeoutMs: input.seed.policy.primitiveTimeoutMs,
  });

  input.state.typedTextHash = writeResult.typedTextHash;
  input.state.keySequenceHash = writeResult.keySequenceHash;
  input.state.dataQualityFlags = mergeFlags(
    input.state.dataQualityFlags,
    input.clearResult.dataQualityFlags,
    writeResult.dataQualityFlags,
    ["replace_input_composed_clear_then_write"],
  );

  return buildReplaceInputSuccessDraft({
    seed: input.seed,
    actionExecutionRef: input.actionExecutionRef,
    state: input.state,
    clearResult: input.clearResult,
    writeResult,
    writeChildCapabilityId,
  });
}

export async function executeReplaceInputOperation(input: {
  context: TextInputRuntimeContext;
  seed: TextInputExecutionSeed;
  actionExecutionRef: string;
  state: TextInputRuntimeDecisionState;
}) {
  const clearStep = await runReplaceInputClearStep(input);
  if (!clearStep.ok) {
    return clearStep.draft;
  }

  return runReplaceInputWriteStep({
    seed: input.seed,
    actionExecutionRef: input.actionExecutionRef,
    state: input.state,
    context: input.context,
    clearResult: clearStep.clearResult,
  });
}