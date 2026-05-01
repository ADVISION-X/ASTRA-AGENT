import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";
import { buildRunDurationMs } from "./primitive-scroll-frame.js";
import { buildFailureResult } from "./primitive-scroll-failure-builder.js";
import { appendIterationProof, resolveExecutionRef } from "./primitive-scroll-iteration-proof.js";
import { runPrimitivePortCall } from "./primitive-scroll-port-call.js";
import type { PrimitiveAbortDecision, PrimitiveScrollFailureReason, PrimitiveScrollResult, PrimitiveTimeoutDecision } from "./primitive-scroll-runner-result.js";
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
      setTimeoutHandle: (handle) => { timeoutHandle = handle; },
      markTimeoutTriggered: () => { timeoutTriggered = true; },
    });
    clearPrimitiveTimeout(timeoutHandle);
    const iterationEnded = input.context.clock.now();
    const { timeoutDecision, abortDecision } = buildTimeoutMetadata(timeoutTriggered);
    const executionRef = resolveExecutionRef(primitiveResult.primitiveExecutionRef);

    if (executionRef === null) {
      appendPrimitiveIteration({ store, repeatIndex: iteration, primitiveCallId: iterationCallId, primitiveExecutionRef: null, status: "failed", iterationStarted, iterationEnded, timeoutDecision, abortDecision, portHangDetected: timeoutTriggered, primitivePortKind: primitiveResult.portKind });
      return buildIterationFailure({ frame, store, endedSnapshot: iterationEnded, primitiveExecutionRef: null, primitiveDecision: "failed", failureReason: "primitive_execution_ref_missing", statusMessage: "Mouse Scroll primitive returned no primitiveExecutionRef.", timeoutDecision, abortDecision, portHangDetected: timeoutTriggered, primitivePortKind: primitiveResult.portKind, dataQualityFlags: ["primitive_execution_ref_missing"] });
    }

    store.primitiveExecutionRefs.push(executionRef);
    appendPrimitiveIteration({ store, repeatIndex: iteration, primitiveCallId: iterationCallId, primitiveExecutionRef: executionRef, status: primitiveResult.ok ? "succeeded" : "failed", iterationStarted, iterationEnded, timeoutDecision, abortDecision, portHangDetected: timeoutTriggered, primitivePortKind: primitiveResult.portKind });
    if (!primitiveResult.ok) {
      return buildIterationFailure({ frame, store, endedSnapshot: iterationEnded, primitiveExecutionRef: executionRef, primitiveDecision: "failed", failureReason: "primitive_failed", statusMessage: primitiveResult.message, timeoutDecision, abortDecision, portHangDetected: timeoutTriggered, primitivePortKind: primitiveResult.portKind, dataQualityFlags: ["primitive_failed"] });
    }

    if (buildRunDurationMs(frame, iterationEnded) > input.maxDurationMs) {
      return buildIterationFailure({ frame, store, endedSnapshot: iterationEnded, primitiveExecutionRef: executionRef, primitiveDecision: "failed", failureReason: "primitive_timeout", statusMessage: `Mouse Scroll primitive exceeded maxDurationMs ${input.maxDurationMs}.`, timeoutDecision: "timed_out", abortDecision, portHangDetected: timeoutTriggered, primitivePortKind: primitiveResult.portKind, dataQualityFlags: ["primitive_timeout"] });
    }

    return null;
  } catch (error) {
    clearPrimitiveTimeout(timeoutHandle);
    const iterationEnded = input.context.clock.now();
    const thrownFailure = buildThrownFailureState(error);
    appendPrimitiveIteration({ store, repeatIndex: iteration, primitiveCallId: iterationCallId, primitiveExecutionRef: null, status: thrownFailure.primitiveDecision, iterationStarted, iterationEnded, timeoutDecision: thrownFailure.timeoutDecision, abortDecision: thrownFailure.abortDecision, portHangDetected: thrownFailure.portHangDetected, primitivePortKind: "browser-controller" });
    return buildIterationFailure({ frame, store, endedSnapshot: iterationEnded, primitiveExecutionRef: null, primitiveDecision: thrownFailure.primitiveDecision, failureReason: thrownFailure.failureReason, statusMessage: thrownFailure.statusMessage, timeoutDecision: thrownFailure.timeoutDecision, abortDecision: thrownFailure.abortDecision, portHangDetected: thrownFailure.portHangDetected, primitivePortKind: "browser-controller", dataQualityFlags: thrownFailure.dataQualityFlags });
  }
};
