import type { MouseClickAbilityContext, MouseClickCoordinateSpace, MouseClickButton, MouseClickCount } from "../contract.js";

export async function runPrimitiveClick(input: {
  context: MouseClickAbilityContext;
  actionExecutionRef: string;
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
    }
  | {
      ok: false;
      failureReason: "primitive_failed" | "primitive_timeout" | "primitive_execution_ref_missing" | "primitive_threw";
      primitiveDecision: "failed" | "threw";
      primitiveExecutionRef: string | null;
      startedAt: string;
      endedAt: string;
      durationMs: number;
      statusMessage: string;
      clock: { startedMonotonicMs: number; endedMonotonicMs: number };
      dataQualityFlags: string[];
    }
> {
  const startedSnapshot = input.context.clock.now();

  try {
    const primitiveResult = await input.context.primitivePort.click({
      actionExecutionRef: input.actionExecutionRef,
      x: input.executableCoordinate.x,
      y: input.executableCoordinate.y,
      coordinateSpace: input.coordinateSpace,
      button: input.button,
      clickCount: input.clickCount,
      targetLabel: input.targetLabel,
      timeoutMs: input.timeoutMs,
    });
    const endedSnapshot = input.context.clock.now();
    const durationMs = Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs));

    if (durationMs > input.maxDurationMs) {
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
      };
    }
    if (!primitiveResult.ok) {
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
      };
    }
    if (!primitiveResult.primitiveExecutionRef) {
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
      };
    }

    return {
      ok: true,
      primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
      primitiveDecision: "succeeded",
      startedAt: startedSnapshot.isoTimestamp,
      endedAt: endedSnapshot.isoTimestamp,
      durationMs,
      statusMessage: primitiveResult.message,
      clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    };
  } catch (error) {
    const endedSnapshot = input.context.clock.now();
    const durationMs = Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs));
    return {
      ok: false,
      failureReason: "primitive_threw",
      primitiveDecision: "threw",
      primitiveExecutionRef: null,
      startedAt: startedSnapshot.isoTimestamp,
      endedAt: endedSnapshot.isoTimestamp,
      durationMs,
      statusMessage: error instanceof Error ? error.message : "Mouse Click primitive threw an unknown error.",
      clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
      dataQualityFlags: ["primitive_threw"],
    };
  }
}