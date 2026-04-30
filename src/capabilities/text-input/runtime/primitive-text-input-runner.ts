import type { TextInputChildCapabilityId, TextInputCommitKey, TextInputKey, TextInputTargetKind } from "../contract.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";

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
  const abortController = new AbortController();
  let timedOut = false;
  let primitiveResult;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, input.timeoutMs);

  try {
    primitiveResult = await Promise.race([
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
    primitiveResult = {
      ok: false,
      primitiveExecutionRef: null,
      operationRef: null,
      typedTextHash: null,
      keySequenceHash: null,
      message: error instanceof Error ? error.message : "text input primitive failed",
      startedAt: startedSnapshot.isoTimestamp,
      endedAt: input.context.clock.now().isoTimestamp,
      portKind: "text-input-execution-port",
      failureReason: timedOut ? "primitive_timeout" : "primitive_aborted",
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
  const endedSnapshot = input.context.clock.now();

  return {
    ok: primitiveResult.ok,
    primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
    operationRef: primitiveResult.operationRef,
    typedTextHash: primitiveResult.typedTextHash,
    keySequenceHash: primitiveResult.keySequenceHash,
    statusMessage: primitiveResult.message,
    failureReason: primitiveResult.failureReason,
    primitiveDecision: primitiveResult.ok
      ? ("succeeded" as const)
      : primitiveResult.failureReason === "primitive_aborted"
        ? ("aborted" as const)
        : primitiveResult.failureReason === "primitive_timeout"
          ? ("timed_out" as const)
          : ("failed" as const),
    primitivePortKind: primitiveResult.portKind,
    primitiveStartedAt: primitiveResult.startedAt,
    primitiveEndedAt: primitiveResult.endedAt,
    startedAt: primitiveResult.startedAt ?? startedSnapshot.isoTimestamp,
    endedAt: primitiveResult.endedAt ?? endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: {
      startedMonotonicMs: startedSnapshot.monotonicMs,
      endedMonotonicMs: endedSnapshot.monotonicMs,
    },
    dataQualityFlags: primitiveResult.ok ? [] : [primitiveResult.failureReason ?? "primitive_failed"],
  };
}