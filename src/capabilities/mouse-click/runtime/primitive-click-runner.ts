import type { MouseClickAbilityContext, MouseClickCoordinateSpace, MouseClickButton, MouseClickCount } from "../contract.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";

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

export async function runPrimitiveClick(input: {
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
}): Promise<
  | {
      ok: true;
      primitiveExecutionRef: string;
      primitiveDecision: "succeeded";
      startedAt: string;
      endedAt: string;
      durationMs: number;
      statusMessage: string;
      clock: { startedMonotonicMs: number; endedMonotonicMs: number };
      primitiveCallId: string;
      primitiveStartedAt: string;
      primitiveEndedAt: string;
      timeoutDecision: "within_limit";
      abortDecision: "not_requested";
      circuitBreakerState: "closed";
      portHangDetected: false;
      primitivePortKind: string;
    }
  | {
      ok: false;
      failureReason: "primitive_failed" | "primitive_timeout" | "primitive_execution_ref_missing" | "primitive_threw" | "primitive_circuit_open" | "primitive_concurrency_guard" | "primitive_aborted";
      primitiveDecision: "failed" | "threw" | "aborted";
      primitiveExecutionRef: string | null;
      startedAt: string;
      endedAt: string;
      durationMs: number;
      statusMessage: string;
      clock: { startedMonotonicMs: number; endedMonotonicMs: number };
      dataQualityFlags: string[];
      primitiveCallId: string;
      primitiveStartedAt: string;
      primitiveEndedAt: string;
      timeoutDecision: "within_limit" | "timed_out";
      abortDecision: "not_requested" | "timeout_abort_requested";
      circuitBreakerState: "closed" | "open";
      portHangDetected: boolean;
      primitivePortKind: string;
    }
> {
  const startedSnapshot = input.context.clock.now();
  const primitiveCallId = buildStableMouseClickRef("mouse-click-primitive-call", [
    input.actionExecutionRef,
    startedSnapshot.isoTimestamp,
    startedSnapshot.monotonicMs,
  ]);
  const primitiveStartedAt = startedSnapshot.isoTimestamp;
  closeCircuitIfExpired(startedSnapshot.monotonicMs);

  if (primitiveRunnerState.circuitOpenUntilMs > startedSnapshot.monotonicMs) {
    const endedSnapshot = input.context.clock.now();
    return {
      ok: false,
      failureReason: "primitive_circuit_open",
      primitiveDecision: "failed",
      primitiveExecutionRef: null,
      startedAt: primitiveStartedAt,
      endedAt: endedSnapshot.isoTimestamp,
      durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
      statusMessage: "Mouse Click primitive circuit breaker is open.",
      clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
      dataQualityFlags: ["primitive_circuit_open"],
      primitiveCallId,
      primitiveStartedAt,
      primitiveEndedAt: endedSnapshot.isoTimestamp,
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      circuitBreakerState: "open",
      portHangDetected: false,
      primitivePortKind: "browser-controller",
    };
  }

  if (primitiveRunnerState.activeClicks >= MAX_CONCURRENT_CLICKS) {
    const endedSnapshot = input.context.clock.now();
    return {
      ok: false,
      failureReason: "primitive_concurrency_guard",
      primitiveDecision: "failed",
      primitiveExecutionRef: null,
      startedAt: primitiveStartedAt,
      endedAt: endedSnapshot.isoTimestamp,
      durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
      statusMessage: "Mouse Click primitive concurrency guard rejected the call.",
      clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
      dataQualityFlags: ["primitive_concurrency_guard"],
      primitiveCallId,
      primitiveStartedAt,
      primitiveEndedAt: endedSnapshot.isoTimestamp,
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      circuitBreakerState: "closed",
      portHangDetected: false,
      primitivePortKind: "browser-controller",
    };
  }

  primitiveRunnerState.activeClicks += 1;
  const abortController = new AbortController();
  let timeoutTriggered = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const primitiveResult = await Promise.race([
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
        timeoutHandle = setTimeout(() => {
          timeoutTriggered = true;
          abortController.abort();
          reject(new Error("Mouse Click primitive timed out before completion."));
        }, input.timeoutMs);
      }),
    ]);
    const endedSnapshot = input.context.clock.now();
    const durationMs = Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs));

    if (durationMs > input.maxDurationMs) {
      recordFailure(endedSnapshot.monotonicMs);
      return {
        ok: false,
        failureReason: "primitive_timeout",
        primitiveDecision: "failed",
        primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: endedSnapshot.isoTimestamp,
        durationMs,
        statusMessage: `Mouse Click primitive exceeded maxDurationMs ${input.maxDurationMs}.`,
        clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
        dataQualityFlags: ["primitive_duration_exceeded"],
        primitiveCallId,
        primitiveStartedAt,
        primitiveEndedAt: endedSnapshot.isoTimestamp,
        timeoutDecision: "timed_out",
        abortDecision: timeoutTriggered ? "timeout_abort_requested" : "not_requested",
        circuitBreakerState: primitiveRunnerState.circuitOpenUntilMs > endedSnapshot.monotonicMs ? "open" : "closed",
        portHangDetected: timeoutTriggered,
        primitivePortKind: primitiveResult.portKind,
      };
    }
    if (!primitiveResult.ok) {
      recordFailure(endedSnapshot.monotonicMs);
      return {
        ok: false,
        failureReason: "primitive_failed",
        primitiveDecision: "failed",
        primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: endedSnapshot.isoTimestamp,
        durationMs,
        statusMessage: primitiveResult.message,
        clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
        dataQualityFlags: ["primitive_failed"],
        primitiveCallId,
        primitiveStartedAt,
        primitiveEndedAt: endedSnapshot.isoTimestamp,
        timeoutDecision: timeoutTriggered ? "timed_out" : "within_limit",
        abortDecision: timeoutTriggered ? "timeout_abort_requested" : "not_requested",
        circuitBreakerState: primitiveRunnerState.circuitOpenUntilMs > endedSnapshot.monotonicMs ? "open" : "closed",
        portHangDetected: timeoutTriggered,
        primitivePortKind: primitiveResult.portKind,
      };
    }
    if (!primitiveResult.primitiveExecutionRef) {
      recordFailure(endedSnapshot.monotonicMs);
      return {
        ok: false,
        failureReason: "primitive_execution_ref_missing",
        primitiveDecision: "failed",
        primitiveExecutionRef: null,
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: endedSnapshot.isoTimestamp,
        durationMs,
        statusMessage: "Mouse Click primitive returned success without primitiveExecutionRef.",
        clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
        dataQualityFlags: ["primitive_execution_ref_missing"],
        primitiveCallId,
        primitiveStartedAt,
        primitiveEndedAt: endedSnapshot.isoTimestamp,
        timeoutDecision: timeoutTriggered ? "timed_out" : "within_limit",
        abortDecision: timeoutTriggered ? "timeout_abort_requested" : "not_requested",
        circuitBreakerState: primitiveRunnerState.circuitOpenUntilMs > endedSnapshot.monotonicMs ? "open" : "closed",
        portHangDetected: timeoutTriggered,
        primitivePortKind: primitiveResult.portKind,
      };
    }

    recordSuccess();

    return {
      ok: true,
      primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
      primitiveDecision: "succeeded",
      startedAt: startedSnapshot.isoTimestamp,
      endedAt: endedSnapshot.isoTimestamp,
      durationMs,
      statusMessage: primitiveResult.message,
      clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
      primitiveCallId,
      primitiveStartedAt,
      primitiveEndedAt: endedSnapshot.isoTimestamp,
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      circuitBreakerState: "closed",
      portHangDetected: false,
      primitivePortKind: primitiveResult.portKind,
    };
  } catch (error) {
    const endedSnapshot = input.context.clock.now();
    const durationMs = Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs));
    recordFailure(endedSnapshot.monotonicMs);
    return {
      ok: false,
      failureReason: timeoutTriggered ? "primitive_timeout" : abortController.signal.aborted ? "primitive_aborted" : "primitive_threw",
      primitiveDecision: timeoutTriggered ? "failed" : abortController.signal.aborted ? "aborted" : "threw",
      primitiveExecutionRef: null,
      startedAt: primitiveStartedAt,
      endedAt: endedSnapshot.isoTimestamp,
      durationMs,
      statusMessage: timeoutTriggered
        ? "Mouse Click primitive timed out before completion."
        : error instanceof Error
          ? error.message
          : "Mouse Click primitive threw an unknown error.",
      clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
      dataQualityFlags: timeoutTriggered ? ["primitive_timeout", "primitive_port_hang_detected"] : ["primitive_threw"],
      primitiveCallId,
      primitiveStartedAt,
      primitiveEndedAt: endedSnapshot.isoTimestamp,
      timeoutDecision: timeoutTriggered ? "timed_out" : "within_limit",
      abortDecision: timeoutTriggered ? "timeout_abort_requested" : "not_requested",
      circuitBreakerState: primitiveRunnerState.circuitOpenUntilMs > endedSnapshot.monotonicMs ? "open" : "closed",
      portHangDetected: timeoutTriggered,
      primitivePortKind: "browser-controller",
    };
  } finally {
    primitiveRunnerState.activeClicks = Math.max(0, primitiveRunnerState.activeClicks - 1);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}