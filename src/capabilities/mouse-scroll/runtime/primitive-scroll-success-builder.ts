import { buildRunDurationMs } from "./primitive-scroll-frame.js";
import { buildPrimitiveScrollSuccessResult } from "./primitive-scroll-runner-result.js";
import type { PrimitiveCallFrame, PrimitiveClockSnapshot, PrimitiveExecutionStore } from "./primitive-scroll-runner-types.js";
import { recordPrimitiveSuccess } from "./primitive-scroll-runner-state.js";

export const buildSuccessResult = (
  frame: PrimitiveCallFrame,
  endedSnapshot: PrimitiveClockSnapshot,
  store: PrimitiveExecutionStore,
) => {
  recordPrimitiveSuccess();
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