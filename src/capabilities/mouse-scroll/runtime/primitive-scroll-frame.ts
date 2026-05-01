import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";
import type { PrimitiveCallFrame, PrimitiveClockSnapshot, RunPrimitiveScrollInput } from "./primitive-scroll-runner-types.js";

export const createPrimitiveCallFrame = (input: RunPrimitiveScrollInput): PrimitiveCallFrame => {
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

export const buildRunDurationMs = (frame: PrimitiveCallFrame, endedSnapshot: PrimitiveClockSnapshot) => {
  return Math.max(0, Math.round(endedSnapshot.monotonicMs - frame.startedSnapshot.monotonicMs));
};