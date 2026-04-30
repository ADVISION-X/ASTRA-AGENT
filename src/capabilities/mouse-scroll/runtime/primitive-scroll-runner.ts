import type { MouseScrollAnchor, MouseScrollCoordinateSpace, MouseScrollDelta } from "../contract.js";
import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";

const MAX_CONCURRENT_SCROLLS = 1;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5_000;

type PrimitiveRunnerState = {
  activeScrolls: number;
  consecutiveFailures: number;
  circuitOpenUntilMs: number;
};

const primitiveRunnerState: PrimitiveRunnerState = {
  activeScrolls: 0,
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

export async function runPrimitiveScroll(input: {
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
}): Promise<
  | {
      ok: true;
      primitiveExecutionRefs: string[];
      primitiveDecision: "succeeded";
      statusMessage: string;
      startedAt: string;
      endedAt: string;
      durationMs: number;
      clock: { startedMonotonicMs: number; endedMonotonicMs: number };
      dataQualityFlags: string[];
      primitiveCallId: string;
      primitiveStartedAt: string;
      primitiveEndedAt: string;
      timeoutDecision: "within_limit";
      abortDecision: "not_requested";
      circuitBreakerState: "closed";
      portHangDetected: false;
      primitivePortKind: string;
      perIterationPrimitiveProofs: Array<{
        repeatIndex: number;
        primitiveCallId: string;
        primitiveExecutionRef: string | null;
        status: "succeeded";
        startedAt: string;
        endedAt: string;
        durationMs: number;
        timeoutDecision: "within_limit";
        abortDecision: "not_requested";
        portHangDetected: false;
        primitivePortKind: string;
      }>;
    }
  | {
      ok: false;
      primitiveExecutionRefs: string[];
      primitiveExecutionRef: string | null;
      primitiveDecision: "failed" | "threw" | "aborted";
      failureReason: "primitive_failed" | "primitive_threw" | "primitive_timeout" | "primitive_execution_ref_missing" | "primitive_circuit_open" | "primitive_concurrency_guard" | "primitive_aborted";
      statusMessage: string;
      startedAt: string;
      endedAt: string;
      durationMs: number;
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
      perIterationPrimitiveProofs: Array<{
        repeatIndex: number;
        primitiveCallId: string;
        primitiveExecutionRef: string | null;
        status: "failed" | "threw" | "aborted" | "succeeded";
        startedAt: string;
        endedAt: string;
        durationMs: number;
        timeoutDecision: "within_limit" | "timed_out";
        abortDecision: "not_requested" | "timeout_abort_requested";
        portHangDetected: boolean;
        primitivePortKind: string;
      }>;
    }
> {
  const startedSnapshot = input.context.clock.now();
  const primitiveCallId = buildStableMouseScrollRef("mouse-scroll-primitive-call", [
    input.scrollExecutionRef,
    startedSnapshot.isoTimestamp,
    startedSnapshot.monotonicMs,
  ]);
  const primitiveStartedAt = startedSnapshot.isoTimestamp;
  const primitiveExecutionRefs: string[] = [];
  const perIterationPrimitiveProofs: Array<{
    repeatIndex: number;
    primitiveCallId: string;
    primitiveExecutionRef: string | null;
    status: "failed" | "threw" | "aborted" | "succeeded";
    startedAt: string;
    endedAt: string;
    durationMs: number;
    timeoutDecision: "within_limit" | "timed_out";
    abortDecision: "not_requested" | "timeout_abort_requested";
    portHangDetected: boolean;
    primitivePortKind: string;
  }> = [];

  closeCircuitIfExpired(startedSnapshot.monotonicMs);
  if (primitiveRunnerState.circuitOpenUntilMs > startedSnapshot.monotonicMs) {
    const endedSnapshot = input.context.clock.now();
    return {
      ok: false,
      primitiveExecutionRefs,
      primitiveExecutionRef: null,
      primitiveDecision: "failed",
      failureReason: "primitive_circuit_open",
      statusMessage: "Mouse Scroll primitive circuit breaker is open.",
      startedAt: primitiveStartedAt,
      endedAt: endedSnapshot.isoTimestamp,
      durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
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
      perIterationPrimitiveProofs,
    };
  }

  if (primitiveRunnerState.activeScrolls >= MAX_CONCURRENT_SCROLLS) {
    const endedSnapshot = input.context.clock.now();
    return {
      ok: false,
      primitiveExecutionRefs,
      primitiveExecutionRef: null,
      primitiveDecision: "failed",
      failureReason: "primitive_concurrency_guard",
      statusMessage: "Mouse Scroll primitive concurrency guard rejected the call.",
      startedAt: primitiveStartedAt,
      endedAt: endedSnapshot.isoTimestamp,
      durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
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
      perIterationPrimitiveProofs,
    };
  }

  primitiveRunnerState.activeScrolls += 1;

  try {
    for (let iteration = 1; iteration <= input.repeat; iteration += 1) {
      const iterationStarted = input.context.clock.now();
      const iterationCallId = buildStableMouseScrollRef("mouse-scroll-primitive-iteration", [primitiveCallId, iteration]);
      const abortController = new AbortController();
      let timeoutTriggered = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      try {
        const primitiveResult = await Promise.race([
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
            timeoutHandle = setTimeout(() => {
              timeoutTriggered = true;
              abortController.abort();
              reject(new Error("Mouse Scroll primitive timed out before completion."));
            }, input.timeoutMs);
          }),
        ]);
        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);
        }

        const iterationEnded = input.context.clock.now();
        const durationMs = Math.max(0, Math.round(iterationEnded.monotonicMs - iterationStarted.monotonicMs));
        const executionRef = primitiveResult.primitiveExecutionRef.trim().length > 0 ? primitiveResult.primitiveExecutionRef : null;

        if (executionRef === null) {
          recordFailure(iterationEnded.monotonicMs);
          perIterationPrimitiveProofs.push({
            repeatIndex: iteration,
            primitiveCallId: iterationCallId,
            primitiveExecutionRef: null,
            status: "failed",
            startedAt: iterationStarted.isoTimestamp,
            endedAt: iterationEnded.isoTimestamp,
            durationMs,
            timeoutDecision: timeoutTriggered ? "timed_out" : "within_limit",
            abortDecision: timeoutTriggered ? "timeout_abort_requested" : "not_requested",
            portHangDetected: timeoutTriggered,
            primitivePortKind: primitiveResult.portKind,
          });
          return {
            ok: false,
            primitiveExecutionRefs,
            primitiveExecutionRef: null,
            primitiveDecision: "failed",
            failureReason: "primitive_execution_ref_missing",
            statusMessage: "Mouse Scroll primitive returned no primitiveExecutionRef.",
            startedAt: primitiveStartedAt,
            endedAt: iterationEnded.isoTimestamp,
            durationMs: Math.max(0, Math.round(iterationEnded.monotonicMs - startedSnapshot.monotonicMs)),
            clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: iterationEnded.monotonicMs },
            dataQualityFlags: ["primitive_execution_ref_missing"],
            primitiveCallId,
            primitiveStartedAt,
            primitiveEndedAt: iterationEnded.isoTimestamp,
            timeoutDecision: timeoutTriggered ? "timed_out" : "within_limit",
            abortDecision: timeoutTriggered ? "timeout_abort_requested" : "not_requested",
            circuitBreakerState: primitiveRunnerState.circuitOpenUntilMs > iterationEnded.monotonicMs ? "open" : "closed",
            portHangDetected: timeoutTriggered,
            primitivePortKind: primitiveResult.portKind,
            perIterationPrimitiveProofs,
          };
        }

        primitiveExecutionRefs.push(executionRef);
        perIterationPrimitiveProofs.push({
          repeatIndex: iteration,
          primitiveCallId: iterationCallId,
          primitiveExecutionRef: executionRef,
          status: primitiveResult.ok ? "succeeded" : "failed",
          startedAt: iterationStarted.isoTimestamp,
          endedAt: iterationEnded.isoTimestamp,
          durationMs,
          timeoutDecision: timeoutTriggered ? "timed_out" : "within_limit",
          abortDecision: timeoutTriggered ? "timeout_abort_requested" : "not_requested",
          portHangDetected: timeoutTriggered,
          primitivePortKind: primitiveResult.portKind,
        });

        if (!primitiveResult.ok) {
          recordFailure(iterationEnded.monotonicMs);
          return {
            ok: false,
            primitiveExecutionRefs,
            primitiveExecutionRef: executionRef,
            primitiveDecision: "failed",
            failureReason: "primitive_failed",
            statusMessage: primitiveResult.message,
            startedAt: primitiveStartedAt,
            endedAt: iterationEnded.isoTimestamp,
            durationMs: Math.max(0, Math.round(iterationEnded.monotonicMs - startedSnapshot.monotonicMs)),
            clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: iterationEnded.monotonicMs },
            dataQualityFlags: ["primitive_failed"],
            primitiveCallId,
            primitiveStartedAt,
            primitiveEndedAt: iterationEnded.isoTimestamp,
            timeoutDecision: timeoutTriggered ? "timed_out" : "within_limit",
            abortDecision: timeoutTriggered ? "timeout_abort_requested" : "not_requested",
            circuitBreakerState: primitiveRunnerState.circuitOpenUntilMs > iterationEnded.monotonicMs ? "open" : "closed",
            portHangDetected: timeoutTriggered,
            primitivePortKind: primitiveResult.portKind,
            perIterationPrimitiveProofs,
          };
        }

        if (Math.max(0, Math.round(iterationEnded.monotonicMs - startedSnapshot.monotonicMs)) > input.maxDurationMs) {
          recordFailure(iterationEnded.monotonicMs);
          return {
            ok: false,
            primitiveExecutionRefs,
            primitiveExecutionRef: executionRef,
            primitiveDecision: "failed",
            failureReason: "primitive_timeout",
            statusMessage: `Mouse Scroll primitive exceeded maxDurationMs ${input.maxDurationMs}.`,
            startedAt: primitiveStartedAt,
            endedAt: iterationEnded.isoTimestamp,
            durationMs: Math.max(0, Math.round(iterationEnded.monotonicMs - startedSnapshot.monotonicMs)),
            clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: iterationEnded.monotonicMs },
            dataQualityFlags: ["primitive_timeout"],
            primitiveCallId,
            primitiveStartedAt,
            primitiveEndedAt: iterationEnded.isoTimestamp,
            timeoutDecision: "timed_out",
            abortDecision: timeoutTriggered ? "timeout_abort_requested" : "not_requested",
            circuitBreakerState: primitiveRunnerState.circuitOpenUntilMs > iterationEnded.monotonicMs ? "open" : "closed",
            portHangDetected: timeoutTriggered,
            primitivePortKind: primitiveResult.portKind,
            perIterationPrimitiveProofs,
          };
        }
      } catch (error) {
        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);
        }
        const iterationEnded = input.context.clock.now();
        const durationMs = Math.max(0, Math.round(iterationEnded.monotonicMs - iterationStarted.monotonicMs));
        const timeoutDecision = error instanceof Error && error.message.includes("timed out") ? "timed_out" : "within_limit";
        const abortDecision = timeoutDecision === "timed_out" ? "timeout_abort_requested" : "not_requested";
        const failureReason = timeoutDecision === "timed_out"
          ? "primitive_timeout"
          : error instanceof Error && error.name === "AbortError"
            ? "primitive_aborted"
            : "primitive_threw";
        const primitiveDecision = failureReason === "primitive_aborted" ? "aborted" : failureReason === "primitive_threw" ? "threw" : "failed";

        recordFailure(iterationEnded.monotonicMs);
        perIterationPrimitiveProofs.push({
          repeatIndex: iteration,
          primitiveCallId: iterationCallId,
          primitiveExecutionRef: null,
          status: primitiveDecision,
          startedAt: iterationStarted.isoTimestamp,
          endedAt: iterationEnded.isoTimestamp,
          durationMs,
          timeoutDecision,
          abortDecision,
          portHangDetected: timeoutDecision === "timed_out",
          primitivePortKind: "browser-controller",
        });
        return {
          ok: false,
          primitiveExecutionRefs,
          primitiveExecutionRef: null,
          primitiveDecision,
          failureReason,
          statusMessage: error instanceof Error ? error.message : "Mouse Scroll primitive threw unexpectedly.",
          startedAt: primitiveStartedAt,
          endedAt: iterationEnded.isoTimestamp,
          durationMs: Math.max(0, Math.round(iterationEnded.monotonicMs - startedSnapshot.monotonicMs)),
          clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: iterationEnded.monotonicMs },
          dataQualityFlags: timeoutDecision === "timed_out" ? ["primitive_timeout", "primitive_port_hang_detected"] : [failureReason],
          primitiveCallId,
          primitiveStartedAt,
          primitiveEndedAt: iterationEnded.isoTimestamp,
          timeoutDecision,
          abortDecision,
          circuitBreakerState: primitiveRunnerState.circuitOpenUntilMs > iterationEnded.monotonicMs ? "open" : "closed",
          portHangDetected: timeoutDecision === "timed_out",
          primitivePortKind: "browser-controller",
          perIterationPrimitiveProofs,
        };
      }
    }

    const endedSnapshot = input.context.clock.now();
    recordSuccess();
    return {
      ok: true,
      primitiveExecutionRefs,
      primitiveDecision: "succeeded",
      statusMessage: "Mouse Scroll executed governed primitive sequence.",
      startedAt: primitiveStartedAt,
      endedAt: endedSnapshot.isoTimestamp,
      durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
      clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
      dataQualityFlags: [],
      primitiveCallId,
      primitiveStartedAt,
      primitiveEndedAt: endedSnapshot.isoTimestamp,
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      circuitBreakerState: "closed",
      portHangDetected: false,
      primitivePortKind: perIterationPrimitiveProofs.at(-1)?.primitivePortKind ?? "browser-controller",
      perIterationPrimitiveProofs: perIterationPrimitiveProofs as Array<{
        repeatIndex: number;
        primitiveCallId: string;
        primitiveExecutionRef: string | null;
        status: "succeeded";
        startedAt: string;
        endedAt: string;
        durationMs: number;
        timeoutDecision: "within_limit";
        abortDecision: "not_requested";
        portHangDetected: false;
        primitivePortKind: string;
      }>,
    };
  } finally {
    primitiveRunnerState.activeScrolls = Math.max(0, primitiveRunnerState.activeScrolls - 1);
  }
}