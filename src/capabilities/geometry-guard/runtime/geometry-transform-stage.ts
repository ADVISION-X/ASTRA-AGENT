import { buildGeometryChildOutput } from "./geometry-child-output.js";
import type {
  GeometryExecutionInput,
  GeometryResolvedState,
  GeometryStageResult,
  GeometryValidationState,
} from "./geometry-execution-types.js";
import { buildGeometryGuardResult } from "./geometry-result-builder.js";
import { buildGeometryStageFailureResult, getDurationMs } from "./geometry-stage-failure.js";
import { transformGeometry } from "./geometry-transformer.js";

export const runGeometryTransformStage = (
  input: GeometryExecutionInput,
  state: GeometryValidationState,
): GeometryStageResult<GeometryResolvedState> => {
  const transform = transformGeometry({
    request: input.request,
    bbox: state.boundsGate.bbox,
    clickPoint: state.boundsGate.clickPoint,
    targetBounds: state.boundsGate.targetBounds,
    scaleMapping: state.scaleGate.scaleMapping,
    requiresExecutableOutput: state.coordinateGate.childRoute.executableOutput,
  });
  return transform.failure
    ? {
        ok: false,
        result: buildGeometryStageFailureResult(input, {
          status: transform.failure.status,
          guardDecision: transform.failure.guardDecision,
          failureReason: transform.failure.failureReason,
          reviewRequiredReason: transform.failure.reviewRequiredReason,
          statusMessage: transform.failure.message,
          policyDecision: state.coordinateGate.coordinateDecision,
          boundsDecision: state.clickSafety.boundsDecision === "not_applicable" ? state.boundsGate.boundsDecision : state.clickSafety.boundsDecision,
          scaleDecision: state.scaleGate.scaleDecision,
          transformDecision: transform.failure.transformDecision,
          sourceBounds: state.boundsGate.sourceBounds,
          targetBounds: state.boundsGate.targetBounds,
          appliedScaleMapping: state.scaleGate.scaleMapping,
          dataQualityFlags: [...input.request.dataQualityFlags, ...transform.failure.dataQualityFlags],
        }),
      }
    : { ok: true, state: { ...state, transform } };
};

export const buildGeometrySuccessResult = (
  input: GeometryExecutionInput,
  state: GeometryResolvedState,
) => {
  const ended = input.context.clock.now();
  const output = buildGeometryChildOutput({
    request: input.request,
    sourceBounds: state.boundsGate.sourceBounds,
    targetBounds: state.boundsGate.targetBounds,
    appliedScaleMapping: state.transform.appliedScaleMapping,
    normalizedCoordinateSpace: state.transform.normalizedCoordinateSpace,
    normalizedClickPoint: state.transform.normalizedClickPoint,
    normalizedBbox: state.transform.normalizedBbox,
  });
  return buildGeometryGuardResult({
    request: input.request,
    status: "success",
    guardDecision: state.coordinateGate.childRoute.executableOutput ? "allow" : "review_required",
    output,
    normalizedCoordinateSpace: state.transform.normalizedCoordinateSpace,
    normalizedClickPoint: state.transform.normalizedClickPoint,
    normalizedBbox: state.transform.normalizedBbox,
    appliedScaleMapping: state.transform.appliedScaleMapping,
    failureReason: null,
    reviewRequiredReason: state.coordinateGate.childRoute.executableOutput ? null : "geometry_review_required",
    statusMessage: state.coordinateGate.childRoute.executableOutput
      ? `Geometry Guard approved ${input.request.childCapabilityId}.`
      : `Geometry Guard validated ${input.request.childCapabilityId} without issuing executable coordinates.`,
    policyDecision: state.coordinateGate.coordinateDecision,
    boundsDecision: state.clickSafety.boundsDecision === "not_applicable" ? state.boundsGate.boundsDecision : state.clickSafety.boundsDecision,
    scaleDecision: state.scaleGate.scaleDecision,
    transformDecision: state.transform.transformDecision,
    sourceBounds: state.boundsGate.sourceBounds,
    targetBounds: state.boundsGate.targetBounds,
    startedAt: input.started.iso,
    endedAt: ended.iso,
    durationMs: getDurationMs(input.started, ended),
    dataQualityFlags: [...input.request.dataQualityFlags],
  });
};