import { buildPrimitiveFailureResult, type PrimitiveClickFailureResult } from "./primitive-click-runner-result.js";
import { type PrimitiveCallFrame } from "./primitive-click-runner-frame.js";
import {
  closePrimitiveCircuitIfExpired,
  getPrimitiveCircuitOpenUntilMs,
  hasPrimitiveExecutionCapacity,
  isPrimitiveCircuitOpen,
} from "./primitive-click-runner-state.js";

const buildImmediateFailure = (input: {
  frame: PrimitiveCallFrame;
  failureReason: PrimitiveClickFailureResult["failureReason"];
  statusMessage: string;
  dataQualityFlags: string[];
}): PrimitiveClickFailureResult => {
  return buildPrimitiveFailureResult({
    startedSnapshot: input.frame.startedSnapshot,
    endedSnapshot: input.frame.startedSnapshot,
    primitiveCallId: input.frame.primitiveCallId,
    primitiveStartedAt: input.frame.primitiveStartedAt,
    primitiveExecutionRef: null,
    primitivePortKind: "browser-controller",
    failureReason: input.failureReason,
    primitiveDecision: "failed",
    statusMessage: input.statusMessage,
    dataQualityFlags: input.dataQualityFlags,
    timeoutTriggered: false,
    circuitOpenUntilMs: getPrimitiveCircuitOpenUntilMs(),
  });
};

export const getImmediateRejection = (frame: PrimitiveCallFrame): PrimitiveClickFailureResult | null => {
  closePrimitiveCircuitIfExpired(frame.startedSnapshot.monotonicMs);
  if (isPrimitiveCircuitOpen(frame.startedSnapshot.monotonicMs)) {
    return buildImmediateFailure({
      frame,
      failureReason: "primitive_circuit_open",
      statusMessage: "Mouse Click primitive circuit breaker is open.",
      dataQualityFlags: ["primitive_circuit_open"],
    });
  }
  if (!hasPrimitiveExecutionCapacity()) {
    return buildImmediateFailure({
      frame,
      failureReason: "primitive_concurrency_guard",
      statusMessage: "Mouse Click primitive concurrency guard rejected the call.",
      dataQualityFlags: ["primitive_concurrency_guard"],
    });
  }
  return null;
};
