import type { GeometryGuardCheckDecision, GeometryGuardScaleMapping, ParsedGeometryGuardAbilityInput } from "../contract.js";
import { createGeometryFailure, type GeometryFailure } from "../shared/geometry-failure.js";
import { isFiniteNumber } from "../shared/geometry-transform.js";

export type ScaleMappingGateResult = {
  scaleDecision: GeometryGuardCheckDecision;
  failure: GeometryFailure | null;
  scaleMapping: GeometryGuardScaleMapping | null;
};

export function evaluateScaleMapping(input: ParsedGeometryGuardAbilityInput, requiresScaleMapping: boolean): ScaleMappingGateResult {
  if (!requiresScaleMapping) {
    return { scaleDecision: "not_applicable", failure: null, scaleMapping: null };
  }

  if (!input.scaleMapping) {
    const failureReason = input.sourceCoordinateSpace === "aiInput"
      ? "ai_input_mapping_required"
      : input.sourceCoordinateSpace === "regionCrop"
        ? "region_mapping_required"
        : "missing_scale_mapping";
    return {
      scaleDecision: input.safetyPolicy.allowReviewRequired ? "review_required" : "failed",
      failure: createGeometryFailure({ status: input.safetyPolicy.allowReviewRequired ? "review_required" : "failed", failureReason, message: `Geometry Guard requires scaleMapping for ${input.sourceCoordinateSpace}.` }),
      scaleMapping: null,
    };
  }

  if (input.scaleMapping.sourceCoordinateSpace !== input.sourceCoordinateSpace || input.scaleMapping.targetCoordinateSpace !== input.requestedExecutionSpace) {
    return {
      scaleDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: "source_coordinate_space_mismatch", message: "Geometry Guard scaleMapping must match the governed source and target coordinate spaces." }),
      scaleMapping: null,
    };
  }

  const sourceWidth = input.scaleMapping.sourceWidth ?? input.imageSize?.width ?? null;
  const sourceHeight = input.scaleMapping.sourceHeight ?? input.imageSize?.height ?? null;
  const targetWidth = input.scaleMapping.targetWidth ?? (input.requestedExecutionSpace === "browserViewport" ? input.viewportSize?.width : input.screenSize?.width) ?? null;
  const targetHeight = input.scaleMapping.targetHeight ?? (input.requestedExecutionSpace === "browserViewport" ? input.viewportSize?.height : input.screenSize?.height) ?? null;

  if (!isFiniteNumber(sourceWidth) || !isFiniteNumber(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0 || !isFiniteNumber(targetWidth) || !isFiniteNumber(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
    return {
      scaleDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: "invalid_scale_mapping", message: "Geometry Guard scaleMapping requires finite source and target bounds." }),
      scaleMapping: null,
    };
  }

  if (!isFiniteNumber(input.scaleMapping.cropOffsetX) || !isFiniteNumber(input.scaleMapping.cropOffsetY) || input.scaleMapping.cropOffsetX < 0 || input.scaleMapping.cropOffsetY < 0) {
    return {
      scaleDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: "invalid_scale_mapping", message: "Geometry Guard scaleMapping crop offset must be finite and non-negative." }),
      scaleMapping: null,
    };
  }

  return {
    scaleDecision: "passed",
    failure: null,
    scaleMapping: { ...input.scaleMapping, sourceWidth, sourceHeight, targetWidth, targetHeight },
  };
}