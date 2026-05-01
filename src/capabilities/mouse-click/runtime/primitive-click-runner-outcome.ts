import type { MouseClickAbilityContext } from "../contract.js";
import {
  buildPrimitiveFailureResult,
  buildPrimitiveSuccessResult,
  type PrimitiveClickFailureResult,
  type PrimitiveClickResult,
} from "./primitive-click-runner-result.js";
import type { PrimitiveCallFrame } from "./primitive-click-runner-frame.js";
import {
  getPrimitiveCircuitOpenUntilMs,
  recordPrimitiveFailure,
  recordPrimitiveSuccess,
} from "./primitive-click-runner-state.js";

type PrimitiveClockSnapshot = ReturnType<MouseClickAbilityContext["clock"]["now"]>;
type PrimitivePortResult = Awaited<ReturnType<MouseClickAbilityContext["primitivePort"]["click"]>>;

const buildPrimitiveResultFrame = (
  frame: PrimitiveCallFrame,
  endedSnapshot: PrimitiveClockSnapshot,
  primitivePortKind: PrimitivePortResult["portKind"],
) => ({
  startedSnapshot: frame.startedSnapshot,
  endedSnapshot,
  primitiveCallId: frame.primitiveCallId,
  primitiveStartedAt: frame.primitiveStartedAt,
  primitivePortKind,
});

const buildDurationFailure = (input: {
  frame: PrimitiveCallFrame;
  endedSnapshot: PrimitiveClockSnapshot;
  primitiveExecutionRef: string | null;
  maxDurationMs: number;
}): PrimitiveClickFailureResult => {
  recordPrimitiveFailure(input.endedSnapshot.monotonicMs);
  return buildPrimitiveFailureResult({
    ...buildPrimitiveResultFrame(input.frame, input.endedSnapshot, "browser-controller"),
    primitiveExecutionRef: input.primitiveExecutionRef,
    failureReason: "primitive_timeout",
    primitiveDecision: "failed",
    statusMessage: `Mouse Click primitive exceeded maxDurationMs ${input.maxDurationMs}.`,
    dataQualityFlags: ["primitive_duration_exceeded"],
    timeoutTriggered: true,
    circuitOpenUntilMs: getPrimitiveCircuitOpenUntilMs(),
  });
};

const buildRejectedPrimitiveResult = (input: {
  frame: PrimitiveCallFrame;
  endedSnapshot: PrimitiveClockSnapshot;
  primitiveResult: PrimitivePortResult;
  timeoutTriggered: boolean;
}): PrimitiveClickFailureResult => {
  recordPrimitiveFailure(input.endedSnapshot.monotonicMs);
  return buildPrimitiveFailureResult({
    ...buildPrimitiveResultFrame(input.frame, input.endedSnapshot, input.primitiveResult.portKind),
    primitiveExecutionRef: input.primitiveResult.primitiveExecutionRef,
    failureReason: "primitive_failed",
    primitiveDecision: "failed",
    statusMessage: input.primitiveResult.message,
    dataQualityFlags: ["primitive_failed"],
    timeoutTriggered: input.timeoutTriggered,
    circuitOpenUntilMs: getPrimitiveCircuitOpenUntilMs(),
  });
};

const buildMissingExecutionRefFailure = (input: {
  frame: PrimitiveCallFrame;
  endedSnapshot: PrimitiveClockSnapshot;
  timeoutTriggered: boolean;
}): PrimitiveClickFailureResult => {
  recordPrimitiveFailure(input.endedSnapshot.monotonicMs);
  return buildPrimitiveFailureResult({
    ...buildPrimitiveResultFrame(input.frame, input.endedSnapshot, "browser-controller"),
    primitiveExecutionRef: null,
    failureReason: "primitive_execution_ref_missing",
    primitiveDecision: "failed",
    statusMessage: "Mouse Click primitive returned success without primitiveExecutionRef.",
    dataQualityFlags: ["primitive_execution_ref_missing"],
    timeoutTriggered: input.timeoutTriggered,
    circuitOpenUntilMs: getPrimitiveCircuitOpenUntilMs(),
  });
};

const buildSuccessfulPrimitiveResult = (input: {
  frame: PrimitiveCallFrame;
  endedSnapshot: PrimitiveClockSnapshot;
  primitiveExecutionRef: string;
  primitivePortKind: PrimitivePortResult["portKind"];
  statusMessage: string;
}): PrimitiveClickResult => {
  recordPrimitiveSuccess();
  return buildPrimitiveSuccessResult({
    ...buildPrimitiveResultFrame(input.frame, input.endedSnapshot, input.primitivePortKind),
    primitiveExecutionRef: input.primitiveExecutionRef,
    statusMessage: input.statusMessage,
  });
};

export const resolvePrimitivePortResult = (input: {
  frame: PrimitiveCallFrame;
  primitiveResult: PrimitivePortResult;
  endedSnapshot: PrimitiveClockSnapshot;
  timeoutTriggered: boolean;
  maxDurationMs: number;
}): PrimitiveClickResult => {
  const durationMs = Math.max(0, Math.round(input.endedSnapshot.monotonicMs - input.frame.startedSnapshot.monotonicMs));
  if (durationMs > input.maxDurationMs) {
    return buildDurationFailure({ frame: input.frame, endedSnapshot: input.endedSnapshot, primitiveExecutionRef: input.primitiveResult.primitiveExecutionRef, maxDurationMs: input.maxDurationMs });
  }
  if (!input.primitiveResult.ok) {
    return buildRejectedPrimitiveResult(input);
  }
  if (!input.primitiveResult.primitiveExecutionRef) {
    return buildMissingExecutionRefFailure(input);
  }
  return buildSuccessfulPrimitiveResult({
    frame: input.frame,
    endedSnapshot: input.endedSnapshot,
    primitiveExecutionRef: input.primitiveResult.primitiveExecutionRef,
    primitivePortKind: input.primitiveResult.portKind,
    statusMessage: input.primitiveResult.message,
  });
};

export const resolveThrownPrimitiveFailure = (input: {
  frame: PrimitiveCallFrame;
  endedSnapshot: PrimitiveClockSnapshot;
  error: unknown;
  timeoutTriggered: boolean;
  aborted: boolean;
}): PrimitiveClickFailureResult => {
  recordPrimitiveFailure(input.endedSnapshot.monotonicMs);
  return buildPrimitiveFailureResult({
    ...buildPrimitiveResultFrame(input.frame, input.endedSnapshot, "browser-controller"),
    primitiveExecutionRef: null,
    failureReason: input.timeoutTriggered ? "primitive_timeout" : input.aborted ? "primitive_aborted" : "primitive_threw",
    primitiveDecision: input.timeoutTriggered ? "failed" : input.aborted ? "aborted" : "threw",
    statusMessage: input.timeoutTriggered
      ? "Mouse Click primitive timed out before completion."
      : input.error instanceof Error
        ? input.error.message
        : "Mouse Click primitive threw an unknown error.",
    dataQualityFlags: input.timeoutTriggered ? ["primitive_timeout", "primitive_port_hang_detected"] : ["primitive_threw"],
    timeoutTriggered: input.timeoutTriggered,
    circuitOpenUntilMs: getPrimitiveCircuitOpenUntilMs(),
  });
};
