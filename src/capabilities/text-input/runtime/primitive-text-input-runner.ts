import type { TextInputChildCapabilityId, TextInputCommitKey, TextInputKey, TextInputTargetKind } from "../contract.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";

function buildPrimitiveTextInputFailureResult(input: {
  startedAt: string;
  endedAt: string;
  timedOut: boolean;
  error: unknown;
}) {
  return {
    ok: false as const,
    primitiveExecutionRef: null,
    operationRef: null,
    typedTextHash: null,
    keySequenceHash: null,
    message: input.error instanceof Error ? input.error.message : "text input primitive failed",
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    portKind: "text-input-execution-port" as const,
    failureReason: input.timedOut ? ("primitive_timeout" as const) : ("primitive_aborted" as const),
  };
}

function mapPrimitiveDecision(ok: boolean, failureReason: string | null) {
  if (ok) {
    return "succeeded" as const;
  }

  if (failureReason === "primitive_aborted") {
    return "aborted" as const;
  }

  if (failureReason === "primitive_timeout") {
    return "timed_out" as const;
  }

  return "failed" as const;
}

function buildPrimitiveTimelineData(input: {
  startedSnapshot: { isoTimestamp: string; monotonicMs: number };
  endedSnapshot: { isoTimestamp: string; monotonicMs: number };
  primitiveResult: { startedAt?: string | null; endedAt?: string | null };
}) {
  return {
    startedAt: input.primitiveResult.startedAt ?? input.startedSnapshot.isoTimestamp,
    endedAt: input.primitiveResult.endedAt ?? input.endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(input.endedSnapshot.monotonicMs - input.startedSnapshot.monotonicMs)),
    clock: {
      startedMonotonicMs: input.startedSnapshot.monotonicMs,
      endedMonotonicMs: input.endedSnapshot.monotonicMs,
    },
  };
}

function buildPrimitiveTextInputResult(input: {
  startedSnapshot: { isoTimestamp: string; monotonicMs: number };
  endedSnapshot: { isoTimestamp: string; monotonicMs: number };
  primitiveResult: {
    ok: boolean;
    primitiveExecutionRef: string | null;
    operationRef: string | null;
    typedTextHash: string | null;
    keySequenceHash: string | null;
    message: string;
    failureReason: string | null;
    startedAt: string | null;
    endedAt: string | null;
    portKind: string;
  };
}) {
  const timelineData = buildPrimitiveTimelineData(input);

  return {
    ok: input.primitiveResult.ok,
    primitiveExecutionRef: input.primitiveResult.primitiveExecutionRef,
    operationRef: input.primitiveResult.operationRef,
    typedTextHash: input.primitiveResult.typedTextHash,
    keySequenceHash: input.primitiveResult.keySequenceHash,
    statusMessage: input.primitiveResult.message,
    failureReason: input.primitiveResult.failureReason,
    primitiveDecision: mapPrimitiveDecision(input.primitiveResult.ok, input.primitiveResult.failureReason),
    primitivePortKind: input.primitiveResult.portKind,
    primitiveStartedAt: input.primitiveResult.startedAt,
    primitiveEndedAt: input.primitiveResult.endedAt,
    ...timelineData,
    dataQualityFlags: input.primitiveResult.ok ? [] : [input.primitiveResult.failureReason ?? "primitive_failed"],
  };
}

async function executePrimitiveTextInputAttempt(input: {
  context: TextInputRuntimeContext;
  attemptRef: string;
  actionExecutionRef: string;
  childCapabilityId: TextInputChildCapabilityId;
  targetRef: string;
  targetKind: TextInputTargetKind;
  inputText: string | null;
  inputTextHash: string | null;
  key: TextInputKey | TextInputCommitKey | null;
  timeoutMs: number;
  startedSnapshot: { isoTimestamp: string; monotonicMs: number };
}) {
  const abortController = new AbortController();
  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, input.timeoutMs);

  try {
    return await Promise.race([
      input.context.executionPort.execute({
        attemptRef: input.attemptRef,
        actionExecutionRef: input.actionExecutionRef,
        childCapabilityId: input.childCapabilityId,
        targetRef: input.targetRef,
        targetKind: input.targetKind,
        targetLabel: `${input.targetKind}:${input.targetRef}`,
        inputText: input.inputText,
        inputTextHash: input.inputTextHash,
        key: input.key,
        timeoutMs: input.timeoutMs,
        abortSignal: abortController.signal,
      }),
      new Promise<never>((_, reject) => {
        abortController.signal.addEventListener("abort", () => {
          reject(new Error(timedOut ? "text input primitive timed out" : "text input primitive aborted"));
        }, { once: true });
      }),
    ]);
  } catch (error) {
    const endedSnapshot = input.context.clock.now();
    return buildPrimitiveTextInputFailureResult({
      startedAt: input.startedSnapshot.isoTimestamp,
      endedAt: endedSnapshot.isoTimestamp,
      timedOut,
      error,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function runPrimitiveTextInput(input: {
  context: TextInputRuntimeContext;
  attemptRef: string;
  actionExecutionRef: string;
  childCapabilityId: TextInputChildCapabilityId;
  targetRef: string;
  targetKind: TextInputTargetKind;
  inputText: string | null;
  inputTextHash: string | null;
  key: TextInputKey | TextInputCommitKey | null;
  timeoutMs: number;
}) {
  const startedSnapshot = input.context.clock.now();
  const primitiveResult = await executePrimitiveTextInputAttempt({
    ...input,
    startedSnapshot,
  });
  const endedSnapshot = input.context.clock.now();

  return buildPrimitiveTextInputResult({
    primitiveResult,
    startedSnapshot,
    endedSnapshot,
  });
}