import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";
import { buildRunDurationMs } from "./primitive-scroll-frame.js";
import { buildFailureResult } from "./primitive-scroll-failure-builder.js";
import { appendIterationProof, resolveExecutionRef } from "./primitive-scroll-iteration-proof.js";
import { runPrimitivePortCall } from "./primitive-scroll-port-call.js";
import type { PrimitiveAbortDecision, PrimitiveScrollFailureReason, PrimitiveScrollResult, PrimitiveTimeoutDecision } from "./primitive-scroll-runner-result.types.js";
import type { PrimitiveCallFrame, PrimitiveExecutionStore, RunPrimitiveScrollInput } from "./primitive-scroll-runner-types.js";
import { recordPrimitiveFailure } from "./primitive-scroll-runner-state.js";

const clearPrimitiveTimeout = (timeoutHandle: ReturnType<typeof setTimeout> | null) => {
  if (timeoutHandle !== null) {
    clearTimeout(timeoutHandle);
  }
};

const createIterationFrame = (frame: PrimitiveCallFrame, context: RunPrimitiveScrollInput["context"], iteration: number) => ({
  iterationStarted: context.clock.now(),
  iterationCallId: buildStableMouseScrollRef("mouse-scroll-primitive-iteration", [frame.primitiveCallId, iteration]),
});

const buildIterationFailure = (input: {
  frame: PrimitiveCallFrame;
  store: PrimitiveExecutionStore;
  endedSnapshot: ReturnType<RunPrimitiveScrollInput["context"]["clock"]["now"]>;
  primitiveExecutionRef: string | null;
  primitiveDecision: "failed" | "threw" | "aborted";
  failureReason: PrimitiveScrollFailureReason;
  statusMessage: string;
  timeoutDecision: PrimitiveTimeoutDecision;
  abortDecision: PrimitiveAbortDecision;
  portHangDetected: boolean;
  primitivePortKind: string;
  dataQualityFlags: string[];
}) => {
  recordPrimitiveFailure(input.endedSnapshot.monotonicMs);
  return buildFailureResult(input);
};

const appendPrimitiveIteration = (input: {
  store: PrimitiveExecutionStore;
  repeatIndex: number;
  primitiveCallId: string;
  primitiveExecutionRef: string | null;
  status: "failed" | "succeeded" | "threw" | "aborted";
  iterationStarted: ReturnType<RunPrimitiveScrollInput["context"]["clock"]["now"]>;
  iterationEnded: ReturnType<RunPrimitiveScrollInput["context"]["clock"]["now"]>;
  timeoutDecision: PrimitiveTimeoutDecision;
  abortDecision: PrimitiveAbortDecision;
  portHangDetected: boolean;
  primitivePortKind: string;
}) => {
  appendIterationProof(input);
};

const buildTimeoutMetadata = (timeoutTriggered: boolean) => ({
  timeoutDecision: timeoutTriggered ? "timed_out" : "within_limit" as PrimitiveTimeoutDecision,
  abortDecision: timeoutTriggered ? "timeout_abort_requested" : "not_requested" as PrimitiveAbortDecision,
});

const resolveThrownTimeoutDecision = (error: unknown): PrimitiveTimeoutDecision => {
  return error instanceof Error && error.message.includes("timed out") ? "timed_out" : "within_limit";
};

const resolveThrownFailureReason = (
  timeoutDecision: PrimitiveTimeoutDecision,
  error: unknown,
): PrimitiveScrollFailureReason => {
  if (timeoutDecision === "timed_out") {
    return "primitive_timeout";
  }

  return error instanceof Error && error.name === "AbortError"
    ? "primitive_aborted"
    : "primitive_threw";
};

const resolveThrownPrimitiveDecision = (
  failureReason: PrimitiveScrollFailureReason,
): "failed" | "threw" | "aborted" => {
  if (failureReason === "primitive_aborted") {
    return "aborted";
  }

  return failureReason === "primitive_threw" ? "threw" : "failed";
};

const resolveThrownDataQualityFlags = (
  timeoutDecision: PrimitiveTimeoutDecision,
  failureReason: PrimitiveScrollFailureReason,
) => {
  return timeoutDecision === "timed_out"
    ? ["primitive_timeout", "primitive_port_hang_detected"]
    : [failureReason];
};

const buildThrownFailureState = (error: unknown) => {
  const timeoutDecision = resolveThrownTimeoutDecision(error);
  const abortDecision: PrimitiveAbortDecision = timeoutDecision === "timed_out" ? "timeout_abort_requested" : "not_requested";
  const failureReason = resolveThrownFailureReason(timeoutDecision, error);

  return {
    timeoutDecision,
    abortDecision,
    failureReason,
    primitiveDecision: resolveThrownPrimitiveDecision(failureReason),
    statusMessage: error instanceof Error ? error.message : "Mouse Scroll primitive threw unexpectedly.",
    portHangDetected: timeoutDecision === "timed_out",
    dataQualityFlags: resolveThrownDataQualityFlags(timeoutDecision, failureReason),
  };
};

const handlePrimitivePortResult = (input: {
  input: RunPrimitiveScrollInput;
  frame: PrimitiveCallFrame;
  store: PrimitiveExecutionStore;
  iteration: number;
  iterationCallId: string;
  iterationStarted: ReturnType<RunPrimitiveScrollInput["context"]["clock"]["now"]>;
  timeoutTriggered: boolean;
  primitiveResult: Awaited<ReturnType<typeof runPrimitivePortCall>>;
}): PrimitiveScrollResult | null => {
  const iterationEnded = input.input.context.clock.now();
  const { timeoutDecision, abortDecision } = buildTimeoutMetadata(input.timeoutTriggered);
  const executionRef = resolveExecutionRef(input.primitiveResult.primitiveExecutionRef);

  if (executionRef === null) {
    appendPrimitiveIteration({ store: input.store, repeatIndex: input.iteration, primitiveCallId: input.iterationCallId, primitiveExecutionRef: null, status: "failed", iterationStarted: input.iterationStarted, iterationEnded, timeoutDecision, abortDecision, portHangDetected: input.timeoutTriggered, primitivePortKind: input.primitiveResult.portKind });
    return buildIterationFailure({ frame: input.frame, store: input.store, endedSnapshot: iterationEnded, primitiveExecutionRef: null, primitiveDecision: "failed", failureReason: "primitive_execution_ref_missing", statusMessage: "Mouse Scroll primitive returned no primitiveExecutionRef.", timeoutDecision, abortDecision, portHangDetected: input.timeoutTriggered, primitivePortKind: input.primitiveResult.portKind, dataQualityFlags: ["primitive_execution_ref_missing"] });
  }

  input.store.primitiveExecutionRefs.push(executionRef);
  appendPrimitiveIteration({ store: input.store, repeatIndex: input.iteration, primitiveCallId: input.iterationCallId, primitiveExecutionRef: executionRef, status: input.primitiveResult.ok ? "succeeded" : "failed", iterationStarted: input.iterationStarted, iterationEnded, timeoutDecision, abortDecision, portHangDetected: input.timeoutTriggered, primitivePortKind: input.primitiveResult.portKind });
  if (!input.primitiveResult.ok) {
    return buildIterationFailure({ frame: input.frame, store: input.store, endedSnapshot: iterationEnded, primitiveExecutionRef: executionRef, primitiveDecision: "failed", failureReason: "primitive_failed", statusMessage: input.primitiveResult.message, timeoutDecision, abortDecision, portHangDetected: input.timeoutTriggered, primitivePortKind: input.primitiveResult.portKind, dataQualityFlags: ["primitive_failed"] });
  }

  if (buildRunDurationMs(input.frame, iterationEnded) > input.input.maxDurationMs) {
    return buildIterationFailure({ frame: input.frame, store: input.store, endedSnapshot: iterationEnded, primitiveExecutionRef: executionRef, primitiveDecision: "failed", failureReason: "primitive_timeout", statusMessage: `Mouse Scroll primitive exceeded maxDurationMs ${input.input.maxDurationMs}.`, timeoutDecision: "timed_out", abortDecision, portHangDetected: input.timeoutTriggered, primitivePortKind: input.primitiveResult.portKind, dataQualityFlags: ["primitive_timeout"] });
  }

  return null;
};

const handleThrownIterationFailure = (input: {
  error: unknown;
  input: RunPrimitiveScrollInput;
  frame: PrimitiveCallFrame;
  store: PrimitiveExecutionStore;
  iteration: number;
  iterationCallId: string;
  iterationStarted: ReturnType<RunPrimitiveScrollInput["context"]["clock"]["now"]>;
}): PrimitiveScrollResult => {
  const iterationEnded = input.input.context.clock.now();
  const thrownFailure = buildThrownFailureState(input.error);
  appendPrimitiveIteration({ store: input.store, repeatIndex: input.iteration, primitiveCallId: input.iterationCallId, primitiveExecutionRef: null, status: thrownFailure.primitiveDecision, iterationStarted: input.iterationStarted, iterationEnded, timeoutDecision: thrownFailure.timeoutDecision, abortDecision: thrownFailure.abortDecision, portHangDetected: thrownFailure.portHangDetected, primitivePortKind: "browser-controller" });
  return buildIterationFailure({ frame: input.frame, store: input.store, endedSnapshot: iterationEnded, primitiveExecutionRef: null, primitiveDecision: thrownFailure.primitiveDecision, failureReason: thrownFailure.failureReason, statusMessage: thrownFailure.statusMessage, timeoutDecision: thrownFailure.timeoutDecision, abortDecision: thrownFailure.abortDecision, portHangDetected: thrownFailure.portHangDetected, primitivePortKind: "browser-controller", dataQualityFlags: thrownFailure.dataQualityFlags });
};

export const runScrollIteration = async (
  input: RunPrimitiveScrollInput,
  frame: PrimitiveCallFrame,
  store: PrimitiveExecutionStore,
  iteration: number,
): Promise<PrimitiveScrollResult | null> => {
  const { iterationStarted, iterationCallId } = createIterationFrame(frame, input.context, iteration);
  const abortController = new AbortController();
  let timeoutTriggered = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    const primitiveResult = await runPrimitivePortCall({
      input,
      iteration,
      abortController,
      setTimeoutHandle: (handle: ReturnType<typeof setTimeout>) => { timeoutHandle = handle; },
      markTimeoutTriggered: () => { timeoutTriggered = true; },
    });
    clearPrimitiveTimeout(timeoutHandle);
    return handlePrimitivePortResult({ input, frame, store, iteration, iterationCallId, iterationStarted, timeoutTriggered, primitiveResult });
  } catch (error) {
    clearPrimitiveTimeout(timeoutHandle);
    return handleThrownIterationFailure({ error, input, frame, store, iteration, iterationCallId, iterationStarted });
  }
};
