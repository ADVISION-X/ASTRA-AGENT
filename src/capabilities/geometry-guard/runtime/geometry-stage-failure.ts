import { buildGeometryGuardResult } from "./geometry-result-builder.js";
import type {
  GeometryExecutionInput,
  GeometryClockReading,
  GeometryStageFailure,
} from "./geometry-execution-types.js";

const getDurationMs = (started: GeometryClockReading, ended: GeometryClockReading): number =>
  Math.max(0, ended.epochMs - started.epochMs);

export const buildGeometryStageFailureResult = (
  input: GeometryExecutionInput,
  failure: GeometryStageFailure,
) => {
  const ended = input.context.clock.now();
  return buildGeometryGuardResult({
    request: input.request,
    status: failure.status,
    guardDecision: failure.guardDecision,
    output: null,
    normalizedCoordinateSpace: null,
    normalizedClickPoint: null,
    normalizedBbox: null,
    appliedScaleMapping: failure.appliedScaleMapping,
    failureReason: failure.failureReason,
    reviewRequiredReason: failure.reviewRequiredReason,
    statusMessage: failure.statusMessage,
    policyDecision: failure.policyDecision,
    boundsDecision: failure.boundsDecision,
    scaleDecision: failure.scaleDecision,
    transformDecision: failure.transformDecision,
    sourceBounds: failure.sourceBounds,
    targetBounds: failure.targetBounds,
    startedAt: input.started.iso,
    endedAt: ended.iso,
    durationMs: getDurationMs(input.started, ended),
    dataQualityFlags: failure.dataQualityFlags,
  });
};

export { getDurationMs };