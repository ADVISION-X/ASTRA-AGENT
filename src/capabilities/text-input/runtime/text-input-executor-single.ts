import type { TextInputExecutionSeed } from "./text-input-input-gate.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";
import {
  mergeFlags,
  type TextInputExecutionResultDraft,
  type TextInputRuntimeDecisionState,
} from "./text-input-execution-support.js";
import { runPrimitiveTextInput } from "./primitive-text-input-runner.js";

type PrimitiveTextInputRunResult = Awaited<ReturnType<typeof runPrimitiveTextInput>>;

function buildSinglePrimitiveExecutionDraft(input: {
  seed: TextInputExecutionSeed;
  actionExecutionRef: string;
  state: TextInputRuntimeDecisionState;
  primitiveResult: PrimitiveTextInputRunResult;
}) {
  return {
    seed: input.seed,
    refs: {
      actionExecutionRef: input.actionExecutionRef,
      primitiveExecutionRef: input.primitiveResult.primitiveExecutionRef,
      clearPrimitiveExecutionRef: null,
      writePrimitiveExecutionRef: null,
      operationRef: input.primitiveResult.operationRef,
    },
    status: {
      status: input.primitiveResult.ok ? ("success" as const) : ("failed" as const),
      failureReason: input.primitiveResult.ok ? null : input.primitiveResult.failureReason ?? "primitive_failed",
      reviewRequiredReason: null,
      statusMessage: input.primitiveResult.statusMessage,
      policyDecision: input.state.policyDecision,
    },
    state: input.state,
    primitive: {
      primitiveDecision: input.primitiveResult.primitiveDecision,
      primitivePortKind: input.primitiveResult.primitivePortKind,
      primitiveStartedAt: input.primitiveResult.primitiveStartedAt,
      primitiveEndedAt: input.primitiveResult.primitiveEndedAt,
    },
    timing: {
      startedAt: input.primitiveResult.startedAt,
      endedAt: input.primitiveResult.endedAt,
      durationMs: input.primitiveResult.durationMs,
      clock: input.primitiveResult.clock,
    },
  } satisfies TextInputExecutionResultDraft;
}

export async function executeSinglePrimitiveOperation(input: {
  context: TextInputRuntimeContext;
  seed: TextInputExecutionSeed;
  actionExecutionRef: string;
  state: TextInputRuntimeDecisionState;
}) {
  const primitiveResult = await runPrimitiveTextInput({
    context: input.context,
    attemptRef: input.seed.attemptRef,
    actionExecutionRef: input.actionExecutionRef,
    childCapabilityId: input.seed.childCapabilityId,
    targetRef: input.seed.targetRef,
    targetKind: input.seed.targetKind,
    inputText: input.seed.inputText,
    inputTextHash: input.seed.inputTextHash,
    key: input.seed.key,
    timeoutMs: input.seed.policy.primitiveTimeoutMs,
  });

  input.state.typedTextHash = primitiveResult.typedTextHash;
  input.state.keySequenceHash = primitiveResult.keySequenceHash;
  input.state.dataQualityFlags = mergeFlags(input.state.dataQualityFlags, primitiveResult.dataQualityFlags);

  return buildSinglePrimitiveExecutionDraft({
    seed: input.seed,
    actionExecutionRef: input.actionExecutionRef,
    state: input.state,
    primitiveResult,
  });
}