import type { MouseScrollAnchor, MouseScrollCoordinateSpace, MouseScrollDelta } from "../contract.js";
import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";
import {
  buildPrimitiveIterationProof,
  buildPrimitiveScrollFailureResult,
  buildPrimitiveScrollSuccessResult,
  type PrimitiveAbortDecision,
  type PrimitiveCircuitBreakerState,
  type PrimitiveIterationProof,
  type PrimitiveIterationStatus,
  type PrimitiveScrollFailureReason,
  type PrimitiveScrollResult,
  type PrimitiveTimeoutDecision,
} from "./primitive-scroll-runner-result.js";

const MAX_CONCURRENT_SCROLLS = 1;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5_000;

type PrimitiveRunnerState = {
  activeScrolls: number;
  consecutiveFailures: number;
  circuitOpenUntilMs: number;
};

type RunPrimitiveScrollInput = {
  context: MouseScrollExecutionContext;
  attemptRef: string;
  scrollExecutionRef: string;
  idempotencyKey: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  geometryGuardProofRef: string;
  sourceCoordinateProofRef: string;
  sourceTargetRef: string;
  operatorApprovalRef: string | null;
  targetLabel: string;
  coordinateSpace: MouseScrollCoordinateSpace;
  executableAnchor: MouseScrollAnchor;
  executableDelta: MouseScrollDelta;
  repeat: number;
  timeoutMs: number;
  maxDurationMs: number;
};

type PrimitiveClockSnapshot = ReturnType<MouseScrollExecutionContext["clock"]["now"]>;
type PrimitiveCallFrame = {
  startedSnapshot: PrimitiveClockSnapshot;
  primitiveCallId: string;
  primitiveStartedAt: string;
};
type PrimitiveExecutionStore = {
  primitiveExecutionRefs: string[];
  perIterationPrimitiveProofs: PrimitiveIterationProof[];
};
type PrimitivePortResult = Awaited<ReturnType<MouseScrollExecutionContext["primitivePort"]["scroll"]>>;

const primitiveRunnerState: PrimitiveRunnerState = {
  activeScrolls: 0,
  consecutiveFailures: 0,
  circuitOpenUntilMs: 0,
};

const closeCircuitIfExpired = (nowMs: number) => {
  if (primitiveRunnerState.circuitOpenUntilMs !== 0 && nowMs >= primitiveRunnerState.circuitOpenUntilMs) {
    primitiveRunnerState.circuitOpenUntilMs = 0;
    primitiveRunnerState.consecutiveFailures = 0;
  }
};

const recordFailure = (nowMs: number) => {
  primitiveRunnerState.consecutiveFailures += 1;
  if (primitiveRunnerState.consecutiveFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    primitiveRunnerState.circuitOpenUntilMs = nowMs + CIRCUIT_BREAKER_COOLDOWN_MS;
  }
};

const recordSuccess = () => {
  primitiveRunnerState.consecutiveFailures = 0;
  primitiveRunnerState.circuitOpenUntilMs = 0;
};

const getCircuitBreakerState = (nowMs: number): PrimitiveCircuitBreakerState => {
  return primitiveRunnerState.circuitOpenUntilMs > nowMs ? "open" : "closed";
};

const createPrimitiveCallFrame = (input: RunPrimitiveScrollInput): PrimitiveCallFrame => {
  const startedSnapshot = input.context.clock.now();
  return {
    startedSnapshot,
    primitiveCallId: buildStableMouseScrollRef("mouse-scroll-primitive-call", [
      input.scrollExecutionRef,
      startedSnapshot.isoTimestamp,
      startedSnapshot.monotonicMs,
    ]),
    primitiveStartedAt: startedSnapshot.isoTimestamp,
  };
};

const buildRunDurationMs = (frame: PrimitiveCallFrame, endedSnapshot: PrimitiveClockSnapshot) => {
  return Math.max(0, Math.round(endedSnapshot.monotonicMs - frame.startedSnapshot.monotonicMs));
};

const buildFailureResult = (input: {
  frame: PrimitiveCallFrame;
  endedSnapshot: PrimitiveClockSnapshot;
  store: PrimitiveExecutionStore;
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
  return buildPrimitiveScrollFailureResult({
    ok: false,
    primitiveExecutionRefs: input.store.primitiveExecutionRefs,
    primitiveExecutionRef: input.primitiveExecutionRef,
    primitiveDecision: input.primitiveDecision,
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
    startedAt: input.frame.primitiveStartedAt,
    endedAt: input.endedSnapshot.isoTimestamp,
    durationMs: buildRunDurationMs(input.frame, input.endedSnapshot),
    clock: {
      startedMonotonicMs: input.frame.startedSnapshot.monotonicMs,
      endedMonotonicMs: input.endedSnapshot.monotonicMs,
    },
    dataQualityFlags: input.dataQualityFlags,
    primitiveCallId: input.frame.primitiveCallId,
    primitiveStartedAt: input.frame.primitiveStartedAt,
    primitiveEndedAt: input.endedSnapshot.isoTimestamp,
    timeoutDecision: input.timeoutDecision,
    abortDecision: input.abortDecision,
    circuitBreakerState: getCircuitBreakerState(input.endedSnapshot.monotonicMs),
    portHangDetected: input.portHangDetected,
    primitivePortKind: input.primitivePortKind,
    perIterationPrimitiveProofs: input.store.perIterationPrimitiveProofs,
  });
};

const buildSuccessResult = (frame: PrimitiveCallFrame, endedSnapshot: PrimitiveClockSnapshot, store: PrimitiveExecutionStore) => {
  recordSuccess();
  return buildPrimitiveScrollSuccessResult({
    ok: true,
    primitiveExecutionRefs: store.primitiveExecutionRefs,
    primitiveDecision: "succeeded",
    statusMessage: "Mouse Scroll executed governed primitive sequence.",
    startedAt: frame.primitiveStartedAt,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: buildRunDurationMs(frame, endedSnapshot),
    clock: {
      startedMonotonicMs: frame.startedSnapshot.monotonicMs,
      endedMonotonicMs: endedSnapshot.monotonicMs,
    },
    primitiveCallId: frame.primitiveCallId,
    primitiveStartedAt: frame.primitiveStartedAt,
    primitiveEndedAt: endedSnapshot.isoTimestamp,
    timeoutDecision: "within_limit",
    abortDecision: "not_requested",
    circuitBreakerState: "closed",
    portHangDetected: false,
    primitivePortKind: store.perIterationPrimitiveProofs.at(-1)?.primitivePortKind ?? "browser-controller",
    perIterationPrimitiveProofs: store.perIterationPrimitiveProofs,
    dataQualityFlags: [],
  });
};

const buildImmediateRejection = (frame: PrimitiveCallFrame, context: MouseScrollExecutionContext): PrimitiveScrollResult | null => {
  closeCircuitIfExpired(frame.startedSnapshot.monotonicMs);
  if (primitiveRunnerState.circuitOpenUntilMs > frame.startedSnapshot.monotonicMs) {
    return buildFailureResult({
      frame,
      endedSnapshot: context.clock.now(),
      store: { primitiveExecutionRefs: [], perIterationPrimitiveProofs: [] },
      primitiveExecutionRef: null,
      primitiveDecision: "failed",
      failureReason: "primitive_circuit_open",
      statusMessage: "Mouse Scroll primitive circuit breaker is open.",
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      portHangDetected: false,
      primitivePortKind: "browser-controller",
      dataQualityFlags: ["primitive_circuit_open"],
    });
  }
  if (primitiveRunnerState.activeScrolls >= MAX_CONCURRENT_SCROLLS) {
    return buildFailureResult({
      frame,
      endedSnapshot: context.clock.now(),
      store: { primitiveExecutionRefs: [], perIterationPrimitiveProofs: [] },
      primitiveExecutionRef: null,
      primitiveDecision: "failed",
      failureReason: "primitive_concurrency_guard",
      statusMessage: "Mouse Scroll primitive concurrency guard rejected the call.",
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      portHangDetected: false,
      primitivePortKind: "browser-controller",
      dataQualityFlags: ["primitive_concurrency_guard"],
    });
  }
  return null;
};

const appendIterationProof = (
  store: PrimitiveExecutionStore,
  repeatIndex: number,
  primitiveCallId: string,
  primitiveExecutionRef: string | null,
  status: PrimitiveIterationStatus,
  iterationStarted: PrimitiveClockSnapshot,
  iterationEnded: PrimitiveClockSnapshot,
  timeoutDecision: PrimitiveTimeoutDecision,
  abortDecision: PrimitiveAbortDecision,
  portHangDetected: boolean,
  primitivePortKind: string,
) => {
  store.perIterationPrimitiveProofs.push(buildPrimitiveIterationProof({
    repeatIndex,
    primitiveCallId,
    primitiveExecutionRef,
    status,
    startedAt: iterationStarted.isoTimestamp,
    endedAt: iterationEnded.isoTimestamp,
    durationMs: Math.max(0, Math.round(iterationEnded.monotonicMs - iterationStarted.monotonicMs)),
    timeoutDecision,
    abortDecision,
    portHangDetected,
    primitivePortKind,
  }));
};

const resolveExecutionRef = (primitiveExecutionRef: string) => {
  return primitiveExecutionRef.trim().length > 0 ? primitiveExecutionRef : null;
};

const runPrimitivePortCall = async (
  input: RunPrimitiveScrollInput,
  iteration: number,
  abortController: AbortController,
  setTimeoutHandle: (handle: ReturnType<typeof setTimeout>) => void,
  markTimeoutTriggered: () => void,
): Promise<PrimitivePortResult> => {
  return Promise.race([
    input.context.primitivePort.scroll({
      attemptRef: input.attemptRef,
      scrollExecutionRef: input.scrollExecutionRef,
      idempotencyKey: input.idempotencyKey,
      sessionId: input.sessionId,
      roundId: input.roundId,
      videoVisitId: input.videoVisitId,
      geometryGuardProofRef: input.geometryGuardProofRef,
      sourceCoordinateProofRef: input.sourceCoordinateProofRef,
      sourceTargetRef: input.sourceTargetRef,
      coordinateSpace: input.coordinateSpace,
      anchorPoint: input.executableAnchor,
      deltaX: input.executableDelta.deltaX,
      deltaY: input.executableDelta.deltaY,
      repeatIndex: iteration,
      repeatTotal: input.repeat,
      targetLabel: `${input.targetLabel}:${iteration}`,
      timeoutMs: input.timeoutMs,
      postActionVerificationRequired: true,
      operatorApprovalRef: input.operatorApprovalRef,
      abortSignal: abortController.signal,
    }),
    new Promise<never>((_, reject) => {
      const timeoutHandle = setTimeout(() => {
        markTimeoutTriggered();
        abortController.abort();
        reject(new Error("Mouse Scroll primitive timed out before completion."));
      }, input.timeoutMs);
      setTimeoutHandle(timeoutHandle);
    }),
  ]);
};

const runScrollIteration = async (
  input: RunPrimitiveScrollInput,
  frame: PrimitiveCallFrame,
  store: PrimitiveExecutionStore,
  iteration: number,
): Promise<PrimitiveScrollResult | null> => {
  const iterationStarted = input.context.clock.now();
  const iterationCallId = buildStableMouseScrollRef("mouse-scroll-primitive-iteration", [frame.primitiveCallId, iteration]);
  const abortController = new AbortController();
  let timeoutTriggered = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    const primitiveResult = await runPrimitivePortCall(
      input,
      iteration,
      abortController,
      (handle) => { timeoutHandle = handle; },
      () => { timeoutTriggered = true; },
    );
    const iterationEnded = input.context.clock.now();
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }

    const timeoutDecision: PrimitiveTimeoutDecision = timeoutTriggered ? "timed_out" : "within_limit";
    const abortDecision: PrimitiveAbortDecision = timeoutTriggered ? "timeout_abort_requested" : "not_requested";
    const executionRef = resolveExecutionRef(primitiveResult.primitiveExecutionRef);
    if (executionRef === null) {
      recordFailure(iterationEnded.monotonicMs);
      appendIterationProof(store, iteration, iterationCallId, null, "failed", iterationStarted, iterationEnded, timeoutDecision, abortDecision, timeoutTriggered, primitiveResult.portKind);
      return buildFailureResult({
        frame,
        endedSnapshot: iterationEnded,
        store,
        primitiveExecutionRef: null,
        primitiveDecision: "failed",
        failureReason: "primitive_execution_ref_missing",
        statusMessage: "Mouse Scroll primitive returned no primitiveExecutionRef.",
        timeoutDecision,
        abortDecision,
        portHangDetected: timeoutTriggered,
        primitivePortKind: primitiveResult.portKind,
        dataQualityFlags: ["primitive_execution_ref_missing"],
      });
    }

    store.primitiveExecutionRefs.push(executionRef);
    appendIterationProof(store, iteration, iterationCallId, executionRef, primitiveResult.ok ? "succeeded" : "failed", iterationStarted, iterationEnded, timeoutDecision, abortDecision, timeoutTriggered, primitiveResult.portKind);
    if (!primitiveResult.ok) {
      recordFailure(iterationEnded.monotonicMs);
      return buildFailureResult({
        frame,
        endedSnapshot: iterationEnded,
        store,
        primitiveExecutionRef: executionRef,
        primitiveDecision: "failed",
        failureReason: "primitive_failed",
        statusMessage: primitiveResult.message,
        timeoutDecision,
        abortDecision,
        portHangDetected: timeoutTriggered,
        primitivePortKind: primitiveResult.portKind,
        dataQualityFlags: ["primitive_failed"],
      });
    }

    if (buildRunDurationMs(frame, iterationEnded) > input.maxDurationMs) {
      recordFailure(iterationEnded.monotonicMs);
      return buildFailureResult({
        frame,
        endedSnapshot: iterationEnded,
        store,
        primitiveExecutionRef: executionRef,
        primitiveDecision: "failed",
        failureReason: "primitive_timeout",
        statusMessage: `Mouse Scroll primitive exceeded maxDurationMs ${input.maxDurationMs}.`,
        timeoutDecision: "timed_out",
        abortDecision,
        portHangDetected: timeoutTriggered,
        primitivePortKind: primitiveResult.portKind,
        dataQualityFlags: ["primitive_timeout"],
      });
    }

    return null;
  } catch (error) {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
    const iterationEnded = input.context.clock.now();
    const timeoutDecision: PrimitiveTimeoutDecision = error instanceof Error && error.message.includes("timed out") ? "timed_out" : "within_limit";
    const abortDecision: PrimitiveAbortDecision = timeoutDecision === "timed_out" ? "timeout_abort_requested" : "not_requested";
    const failureReason: PrimitiveScrollFailureReason = timeoutDecision === "timed_out"
      ? "primitive_timeout"
      : error instanceof Error && error.name === "AbortError"
        ? "primitive_aborted"
        : "primitive_threw";
    const primitiveDecision = failureReason === "primitive_aborted" ? "aborted" : failureReason === "primitive_threw" ? "threw" : "failed";
    recordFailure(iterationEnded.monotonicMs);
    appendIterationProof(store, iteration, iterationCallId, null, primitiveDecision, iterationStarted, iterationEnded, timeoutDecision, abortDecision, timeoutDecision === "timed_out", "browser-controller");
    return buildFailureResult({
      frame,
      endedSnapshot: iterationEnded,
      store,
      primitiveExecutionRef: null,
      primitiveDecision,
      failureReason,
      statusMessage: error instanceof Error ? error.message : "Mouse Scroll primitive threw unexpectedly.",
      timeoutDecision,
      abortDecision,
      portHangDetected: timeoutDecision === "timed_out",
      primitivePortKind: "browser-controller",
      dataQualityFlags: timeoutDecision === "timed_out" ? ["primitive_timeout", "primitive_port_hang_detected"] : [failureReason],
    });
  }
};

export async function runPrimitiveScroll(input: RunPrimitiveScrollInput): Promise<PrimitiveScrollResult> {
  const frame = createPrimitiveCallFrame(input);
  const immediateRejection = buildImmediateRejection(frame, input.context);
  if (immediateRejection) {
    return immediateRejection;
  }

  const store: PrimitiveExecutionStore = { primitiveExecutionRefs: [], perIterationPrimitiveProofs: [] };
  primitiveRunnerState.activeScrolls += 1;
  try {
    for (let iteration = 1; iteration <= input.repeat; iteration += 1) {
      const failedResult = await runScrollIteration(input, frame, store, iteration);
      if (failedResult) {
        return failedResult;
      }
    }

    return buildSuccessResult(frame, input.context.clock.now(), store);
  } finally {
    primitiveRunnerState.activeScrolls = Math.max(0, primitiveRunnerState.activeScrolls - 1);
  }
}