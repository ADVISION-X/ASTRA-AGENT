import type { MouseClickAbilityContext, MouseClickCoordinateSpace, MouseClickButton, MouseClickCount } from "../contract.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";
import { buildPrimitiveFailureResult, buildPrimitiveSuccessResult, type PrimitiveClickFailureResult, type PrimitiveClickResult } from "./primitive-click-runner-result.js";

const MAX_CONCURRENT_CLICKS = 1;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5_000;

type PrimitiveRunnerState = {
  activeClicks: number;
  consecutiveFailures: number;
  circuitOpenUntilMs: number;
};

const primitiveRunnerState: PrimitiveRunnerState = {
  activeClicks: 0,
  consecutiveFailures: 0,
  circuitOpenUntilMs: 0,
};

function closeCircuitIfExpired(nowMs: number) {
  if (primitiveRunnerState.circuitOpenUntilMs !== 0 && nowMs >= primitiveRunnerState.circuitOpenUntilMs) {
    primitiveRunnerState.circuitOpenUntilMs = 0;
    primitiveRunnerState.consecutiveFailures = 0;
  }
}

function recordFailure(nowMs: number) {
  primitiveRunnerState.consecutiveFailures += 1;
  if (primitiveRunnerState.consecutiveFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    primitiveRunnerState.circuitOpenUntilMs = nowMs + CIRCUIT_BREAKER_COOLDOWN_MS;
  }
}

function recordSuccess() {
  primitiveRunnerState.consecutiveFailures = 0;
  primitiveRunnerState.circuitOpenUntilMs = 0;
}

type RunPrimitiveClickInput = {
  context: MouseClickAbilityContext;
  attemptRef: string;
  actionExecutionRef: string;
  idempotencyKey: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  geometryGuardProofRef: string;
  sourceCoordinateProofRef: string;
  sourceTargetRef: string;
  operatorApprovalRef: string | null;
  targetLabel: string;
  coordinateSpace: MouseClickCoordinateSpace;
  executableCoordinate: { x: number; y: number };
  button: MouseClickButton;
  clickCount: MouseClickCount;
  timeoutMs: number;
  maxDurationMs: number;
};

type PrimitiveClockSnapshot = ReturnType<MouseClickAbilityContext["clock"]["now"]>;
type PrimitivePortResult = Awaited<ReturnType<MouseClickAbilityContext["primitivePort"]["click"]>>;

const buildImmediateFailure = (input: {
  startedSnapshot: PrimitiveClockSnapshot;
  primitiveCallId: string;
  primitiveStartedAt: string;
  failureReason: PrimitiveClickFailureResult["failureReason"];
  statusMessage: string;
  dataQualityFlags: string[];
}): PrimitiveClickFailureResult => {
  const endedSnapshot = input.startedSnapshot;
  return buildPrimitiveFailureResult({
    startedSnapshot: input.startedSnapshot,
    endedSnapshot,
    primitiveCallId: input.primitiveCallId,
    primitiveStartedAt: input.primitiveStartedAt,
    primitiveExecutionRef: null,
    primitivePortKind: "browser-controller",
    failureReason: input.failureReason,
    primitiveDecision: "failed",
    statusMessage: input.statusMessage,
    dataQualityFlags: input.dataQualityFlags,
    timeoutTriggered: false,
    circuitOpenUntilMs: primitiveRunnerState.circuitOpenUntilMs,
  });
};

const getImmediateRejection = (startedSnapshot: PrimitiveClockSnapshot, primitiveCallId: string, primitiveStartedAt: string): PrimitiveClickFailureResult | null => {
  closeCircuitIfExpired(startedSnapshot.monotonicMs);
  if (primitiveRunnerState.circuitOpenUntilMs > startedSnapshot.monotonicMs) {
    return buildImmediateFailure({
      startedSnapshot,
      primitiveCallId,
      primitiveStartedAt,
      failureReason: "primitive_circuit_open",
      statusMessage: "Mouse Click primitive circuit breaker is open.",
      dataQualityFlags: ["primitive_circuit_open"],
    });
  }
  if (primitiveRunnerState.activeClicks >= MAX_CONCURRENT_CLICKS) {
    return buildImmediateFailure({
      startedSnapshot,
      primitiveCallId,
      primitiveStartedAt,
      failureReason: "primitive_concurrency_guard",
      statusMessage: "Mouse Click primitive concurrency guard rejected the call.",
      dataQualityFlags: ["primitive_concurrency_guard"],
    });
  }
  return null;
};

const runPrimitivePortCall = async (
  input: RunPrimitiveClickInput,
  abortController: AbortController,
  setTimeoutHandle: (handle: ReturnType<typeof setTimeout>) => void,
  markTimeoutTriggered: () => void,
): Promise<PrimitivePortResult> => {
  return Promise.race([
    input.context.primitivePort.click({
      attemptRef: input.attemptRef,
      actionExecutionRef: input.actionExecutionRef,
      idempotencyKey: input.idempotencyKey,
      sessionId: input.sessionId,
      roundId: input.roundId,
      videoVisitId: input.videoVisitId,
      geometryGuardProofRef: input.geometryGuardProofRef,
      sourceCoordinateProofRef: input.sourceCoordinateProofRef,
      sourceTargetRef: input.sourceTargetRef,
      coordinateSpace: input.coordinateSpace,
      executableCoordinate: input.executableCoordinate,
      button: input.button,
      clickCount: input.clickCount,
      targetLabel: input.targetLabel,
      timeoutMs: input.timeoutMs,
      postActionVerificationRequired: true,
      operatorApprovalRef: input.operatorApprovalRef,
      abortSignal: abortController.signal,
    }),
    new Promise<never>((_, reject) => {
      const timeoutHandle = setTimeout(() => {
        markTimeoutTriggered();
        abortController.abort();
        reject(new Error("Mouse Click primitive timed out before completion."));
      }, input.timeoutMs);
      setTimeoutHandle(timeoutHandle);
    }),
  ]);
};

const resolvePrimitivePortResult = (input: {
  primitiveResult: PrimitivePortResult;
  startedSnapshot: PrimitiveClockSnapshot;
  endedSnapshot: PrimitiveClockSnapshot;
  primitiveCallId: string;
  primitiveStartedAt: string;
  timeoutTriggered: boolean;
  maxDurationMs: number;
}): PrimitiveClickResult => {
  const frame = {
    startedSnapshot: input.startedSnapshot,
    endedSnapshot: input.endedSnapshot,
    primitiveCallId: input.primitiveCallId,
    primitiveStartedAt: input.primitiveStartedAt,
    primitivePortKind: input.primitiveResult.portKind,
  };
  const durationMs = Math.max(0, Math.round(input.endedSnapshot.monotonicMs - input.startedSnapshot.monotonicMs));
  if (durationMs > input.maxDurationMs) {
    recordFailure(input.endedSnapshot.monotonicMs);
    return buildPrimitiveFailureResult({
      ...frame,
      primitiveExecutionRef: input.primitiveResult.primitiveExecutionRef,
      failureReason: "primitive_timeout",
      primitiveDecision: "failed",
      statusMessage: `Mouse Click primitive exceeded maxDurationMs ${input.maxDurationMs}.`,
      dataQualityFlags: ["primitive_duration_exceeded"],
      timeoutTriggered: true,
      circuitOpenUntilMs: primitiveRunnerState.circuitOpenUntilMs,
    });
  }
  if (!input.primitiveResult.ok) {
    recordFailure(input.endedSnapshot.monotonicMs);
    return buildPrimitiveFailureResult({
      ...frame,
      primitiveExecutionRef: input.primitiveResult.primitiveExecutionRef,
      failureReason: "primitive_failed",
      primitiveDecision: "failed",
      statusMessage: input.primitiveResult.message,
      dataQualityFlags: ["primitive_failed"],
      timeoutTriggered: input.timeoutTriggered,
      circuitOpenUntilMs: primitiveRunnerState.circuitOpenUntilMs,
    });
  }
  if (!input.primitiveResult.primitiveExecutionRef) {
    recordFailure(input.endedSnapshot.monotonicMs);
    return buildPrimitiveFailureResult({
      ...frame,
      primitiveExecutionRef: null,
      failureReason: "primitive_execution_ref_missing",
      primitiveDecision: "failed",
      statusMessage: "Mouse Click primitive returned success without primitiveExecutionRef.",
      dataQualityFlags: ["primitive_execution_ref_missing"],
      timeoutTriggered: input.timeoutTriggered,
      circuitOpenUntilMs: primitiveRunnerState.circuitOpenUntilMs,
    });
  }

  recordSuccess();
  return buildPrimitiveSuccessResult({
    ...frame,
    primitiveExecutionRef: input.primitiveResult.primitiveExecutionRef,
    statusMessage: input.primitiveResult.message,
  });
};

const resolveThrownPrimitiveFailure = (input: {
  error: unknown;
  startedSnapshot: PrimitiveClockSnapshot;
  endedSnapshot: PrimitiveClockSnapshot;
  primitiveCallId: string;
  primitiveStartedAt: string;
  timeoutTriggered: boolean;
  aborted: boolean;
}): PrimitiveClickFailureResult => {
  recordFailure(input.endedSnapshot.monotonicMs);
  return buildPrimitiveFailureResult({
    startedSnapshot: input.startedSnapshot,
    endedSnapshot: input.endedSnapshot,
    primitiveCallId: input.primitiveCallId,
    primitiveStartedAt: input.primitiveStartedAt,
    primitiveExecutionRef: null,
    primitivePortKind: "browser-controller",
    failureReason: input.timeoutTriggered ? "primitive_timeout" : input.aborted ? "primitive_aborted" : "primitive_threw",
    primitiveDecision: input.timeoutTriggered ? "failed" : input.aborted ? "aborted" : "threw",
    statusMessage: input.timeoutTriggered
      ? "Mouse Click primitive timed out before completion."
      : input.error instanceof Error
        ? input.error.message
        : "Mouse Click primitive threw an unknown error.",
    dataQualityFlags: input.timeoutTriggered ? ["primitive_timeout", "primitive_port_hang_detected"] : ["primitive_threw"],
    timeoutTriggered: input.timeoutTriggered,
    circuitOpenUntilMs: primitiveRunnerState.circuitOpenUntilMs,
  });
};

export async function runPrimitiveClick(input: RunPrimitiveClickInput): Promise<PrimitiveClickResult> {
  const startedSnapshot = input.context.clock.now();
  const primitiveCallId = buildStableMouseClickRef("mouse-click-primitive-call", [
    input.actionExecutionRef,
    startedSnapshot.isoTimestamp,
    startedSnapshot.monotonicMs,
  ]);
  const primitiveStartedAt = startedSnapshot.isoTimestamp;
  const immediateRejection = getImmediateRejection(startedSnapshot, primitiveCallId, primitiveStartedAt);
  if (immediateRejection) {
    return immediateRejection;
  }

  primitiveRunnerState.activeClicks += 1;
  const abortController = new AbortController();
  let timeoutTriggered = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const primitiveResult = await runPrimitivePortCall(
      input,
      abortController,
      (handle) => { timeoutHandle = handle; },
      () => { timeoutTriggered = true; },
    );
    const endedSnapshot = input.context.clock.now();
    return resolvePrimitivePortResult({
      primitiveResult,
      startedSnapshot,
      endedSnapshot,
      primitiveCallId,
      primitiveStartedAt,
      timeoutTriggered,
      maxDurationMs: input.maxDurationMs,
    });
  } catch (error) {
    const endedSnapshot = input.context.clock.now();
    return resolveThrownPrimitiveFailure({
      error,
      startedSnapshot,
      endedSnapshot,
      primitiveCallId,
      primitiveStartedAt,
      timeoutTriggered,
      aborted: abortController.signal.aborted,
    });
  } finally {
    primitiveRunnerState.activeClicks = Math.max(0, primitiveRunnerState.activeClicks - 1);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}