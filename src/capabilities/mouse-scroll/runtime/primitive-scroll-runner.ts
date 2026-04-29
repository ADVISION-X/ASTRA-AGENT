import type { MouseScrollAbilityContext, MouseScrollAnchor, MouseScrollCoordinateSpace, MouseScrollDelta } from "../contract.js";

export async function runPrimitiveScroll(input: {
  context: MouseScrollAbilityContext;
  scrollExecutionRef: string;
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
    }
  | {
      ok: false;
      primitiveExecutionRefs: string[];
      primitiveExecutionRef: string | null;
      primitiveDecision: "failed" | "threw";
      failureReason: "primitive_failed" | "primitive_threw" | "primitive_duration_limit_exceeded" | "primitive_execution_ref_missing";
      statusMessage: string;
      startedAt: string;
      endedAt: string;
      durationMs: number;
      clock: { startedMonotonicMs: number; endedMonotonicMs: number };
      dataQualityFlags: string[];
    }
> {
  const startedSnapshot = input.context.clock.now();
  const primitiveExecutionRefs: string[] = [];
  let lastExecutionRef: string | null = null;

  for (let iteration = 1; iteration <= input.repeat; iteration += 1) {
    try {
      const primitiveResult = await input.context.primitivePort.scroll({
        coordinateSpace: input.coordinateSpace,
        anchorPoint: input.executableAnchor,
        deltaX: input.executableDelta.deltaX,
        deltaY: input.executableDelta.deltaY,
        targetLabel: `${input.targetLabel}:${iteration}`,
        timeoutMs: input.timeoutMs,
      });
      const endedSnapshot = input.context.clock.now();
      const durationMs = Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs));
      lastExecutionRef = primitiveResult.primitiveExecutionRef && primitiveResult.primitiveExecutionRef.trim().length > 0
        ? primitiveResult.primitiveExecutionRef
        : null;

      if (lastExecutionRef === null) {
        return {
          ok: false,
          primitiveExecutionRefs,
          primitiveExecutionRef: null,
          primitiveDecision: "failed",
          failureReason: "primitive_execution_ref_missing",
          statusMessage: "Mouse Scroll primitive returned no primitiveExecutionRef.",
          startedAt: startedSnapshot.isoTimestamp,
          endedAt: endedSnapshot.isoTimestamp,
          durationMs,
          clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
          dataQualityFlags: ["primitive_execution_ref_missing"],
        };
      }

      primitiveExecutionRefs.push(lastExecutionRef);
      if (!primitiveResult.ok) {
        return {
          ok: false,
          primitiveExecutionRefs,
          primitiveExecutionRef: lastExecutionRef,
          primitiveDecision: "failed",
          failureReason: "primitive_failed",
          statusMessage: primitiveResult.message,
          startedAt: startedSnapshot.isoTimestamp,
          endedAt: endedSnapshot.isoTimestamp,
          durationMs,
          clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
          dataQualityFlags: ["primitive_failed"],
        };
      }
      if (durationMs > input.maxDurationMs) {
        return {
          ok: false,
          primitiveExecutionRefs,
          primitiveExecutionRef: lastExecutionRef,
          primitiveDecision: "failed",
          failureReason: "primitive_duration_limit_exceeded",
          statusMessage: `Mouse Scroll primitive exceeded maxDurationMs ${input.maxDurationMs}.`,
          startedAt: startedSnapshot.isoTimestamp,
          endedAt: endedSnapshot.isoTimestamp,
          durationMs,
          clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
          dataQualityFlags: ["primitive_duration_limit_exceeded"],
        };
      }

      if (iteration === input.repeat) {
        return {
          ok: true,
          primitiveExecutionRefs,
          primitiveDecision: "succeeded",
          statusMessage: "Mouse Scroll executed governed primitive sequence.",
          startedAt: startedSnapshot.isoTimestamp,
          endedAt: endedSnapshot.isoTimestamp,
          durationMs,
          clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
          dataQualityFlags: [],
        };
      }
    } catch (error) {
      const endedSnapshot = input.context.clock.now();
      return {
        ok: false,
        primitiveExecutionRefs,
        primitiveExecutionRef: lastExecutionRef,
        primitiveDecision: "threw",
        failureReason: "primitive_threw",
        statusMessage: error instanceof Error ? error.message : "Mouse Scroll primitive threw unexpectedly.",
        startedAt: startedSnapshot.isoTimestamp,
        endedAt: endedSnapshot.isoTimestamp,
        durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
        clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
        dataQualityFlags: ["primitive_threw"],
      };
    }
  }

  const endedSnapshot = input.context.clock.now();
  return {
    ok: false,
    primitiveExecutionRefs,
    primitiveExecutionRef: lastExecutionRef,
    primitiveDecision: "failed",
    failureReason: "primitive_failed",
    statusMessage: "Mouse Scroll primitive loop terminated without an execution result.",
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    dataQualityFlags: ["primitive_failed"],
  };
}