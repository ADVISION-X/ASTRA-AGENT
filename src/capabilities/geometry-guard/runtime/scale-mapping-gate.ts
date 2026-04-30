import type { GeometryGuardCheckDecision, GeometryGuardScaleMapping, ParsedGeometryGuardAbilityInput } from "../contract.js";
import { createGeometryFailure, type GeometryFailure } from "../shared/geometry-failure.js";
import { isFiniteNumber } from "../shared/geometry-transform.js";

export type ScaleMappingGateResult = {
  scaleDecision: GeometryGuardCheckDecision;
  failure: GeometryFailure | null;
  scaleMapping: GeometryGuardScaleMapping | null;
};

type ScaleMappingDimensions = {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
};

function createScaleMappingFailure(input: {
  scaleDecision: GeometryGuardCheckDecision;
  failureStatus: GeometryFailure["status"];
  failureReason: GeometryFailure["failureReason"];
  message: string;
}): ScaleMappingGateResult {
  return {
    scaleDecision: input.scaleDecision,
    failure: createGeometryFailure({
      status: input.failureStatus,
      failureReason: input.failureReason,
      message: input.message,
    }),
    scaleMapping: null,
  };
}

function validateMappingPresence(input: {
  request: ParsedGeometryGuardAbilityInput;
  requiresScaleMapping: boolean;
}): ScaleMappingGateResult | { scaleMapping: GeometryGuardScaleMapping } {
  if (!input.requiresScaleMapping) {
    return { scaleDecision: "not_applicable", failure: null, scaleMapping: null };
  }

  if (input.request.scaleMapping) {
    return { scaleMapping: input.request.scaleMapping };
  }

  const failureReason = input.request.sourceCoordinateSpace === "aiInput"
    ? "ai_input_mapping_required"
    : input.request.sourceCoordinateSpace === "regionCrop"
      ? "region_mapping_required"
      : "missing_scale_mapping";
  const scaleDecision = input.request.safetyPolicy.allowReviewRequired ? "review_required" : "failed";
  return createScaleMappingFailure({
    scaleDecision,
    failureStatus: scaleDecision,
    failureReason,
    message: `Geometry Guard requires scaleMapping for ${input.request.sourceCoordinateSpace}.`,
  });
}

function validateMappingSpaces(input: {
  request: ParsedGeometryGuardAbilityInput;
  scaleMapping: GeometryGuardScaleMapping;
}): ScaleMappingGateResult | null {
  return input.scaleMapping.sourceCoordinateSpace === input.request.sourceCoordinateSpace
    && input.scaleMapping.targetCoordinateSpace === input.request.requestedExecutionSpace
    ? null
    : createScaleMappingFailure({
        scaleDecision: "failed",
        failureStatus: "failed",
        failureReason: "source_coordinate_space_mismatch",
        message: "Geometry Guard scaleMapping must match the governed source and target coordinate spaces.",
      });
}

function resolveSourceDimensions(input: {
  request: ParsedGeometryGuardAbilityInput;
  scaleMapping: GeometryGuardScaleMapping;
}): { sourceWidth: number | null; sourceHeight: number | null } {
  return {
    sourceWidth: input.scaleMapping.sourceWidth ?? input.request.imageSize?.width ?? null,
    sourceHeight: input.scaleMapping.sourceHeight ?? input.request.imageSize?.height ?? null,
  };
}

function resolveTargetDimensions(input: {
  request: ParsedGeometryGuardAbilityInput;
  scaleMapping: GeometryGuardScaleMapping;
}): { targetWidth: number | null; targetHeight: number | null } {
  return {
    targetWidth: input.scaleMapping.targetWidth ?? (input.request.requestedExecutionSpace === "browserViewport" ? input.request.viewportSize?.width : input.request.screenSize?.width) ?? null,
    targetHeight: input.scaleMapping.targetHeight ?? (input.request.requestedExecutionSpace === "browserViewport" ? input.request.viewportSize?.height : input.request.screenSize?.height) ?? null,
  };
}

function validateResolvedDimensions(input: {
  sourceWidth: number | null;
  sourceHeight: number | null;
  targetWidth: number | null;
  targetHeight: number | null;
}): ScaleMappingGateResult | null {
  return !isFiniteNumber(input.sourceWidth) || !isFiniteNumber(input.sourceHeight) || input.sourceWidth <= 0 || input.sourceHeight <= 0 || !isFiniteNumber(input.targetWidth) || !isFiniteNumber(input.targetHeight) || input.targetWidth <= 0 || input.targetHeight <= 0
    ? createScaleMappingFailure({
        scaleDecision: "failed",
        failureStatus: "failed",
        failureReason: "invalid_scale_mapping",
        message: "Geometry Guard scaleMapping requires finite source and target bounds.",
      })
    : null;
}

function resolveMappingDimensions(input: {
  request: ParsedGeometryGuardAbilityInput;
  scaleMapping: GeometryGuardScaleMapping;
}): ScaleMappingGateResult | ScaleMappingDimensions {
  const sourceDimensions = resolveSourceDimensions(input);
  const targetDimensions = resolveTargetDimensions(input);
  const dimensionFailure = validateResolvedDimensions({
    sourceWidth: sourceDimensions.sourceWidth,
    sourceHeight: sourceDimensions.sourceHeight,
    targetWidth: targetDimensions.targetWidth,
    targetHeight: targetDimensions.targetHeight,
  });
  return dimensionFailure
    ? dimensionFailure
    : {
        sourceWidth: sourceDimensions.sourceWidth,
        sourceHeight: sourceDimensions.sourceHeight,
        targetWidth: targetDimensions.targetWidth,
        targetHeight: targetDimensions.targetHeight,
      };
}

function validateCropOffsets(scaleMapping: GeometryGuardScaleMapping): ScaleMappingGateResult | null {
  return isFiniteNumber(scaleMapping.cropOffsetX) && isFiniteNumber(scaleMapping.cropOffsetY) && scaleMapping.cropOffsetX >= 0 && scaleMapping.cropOffsetY >= 0
    ? null
    : createScaleMappingFailure({
        scaleDecision: "failed",
        failureStatus: "failed",
        failureReason: "invalid_scale_mapping",
        message: "Geometry Guard scaleMapping crop offset must be finite and non-negative.",
      });
}

export function evaluateScaleMapping(input: ParsedGeometryGuardAbilityInput, requiresScaleMapping: boolean): ScaleMappingGateResult {
  const presenceResult = validateMappingPresence({ request: input, requiresScaleMapping });
  if ("scaleDecision" in presenceResult) {
    return presenceResult;
  }

  const spaceFailure = validateMappingSpaces({ request: input, scaleMapping: presenceResult.scaleMapping });
  if (spaceFailure) {
    return spaceFailure;
  }

  const dimensionResult = resolveMappingDimensions({ request: input, scaleMapping: presenceResult.scaleMapping });
  if ("scaleDecision" in dimensionResult) {
    return dimensionResult;
  }

  const cropOffsetFailure = validateCropOffsets(presenceResult.scaleMapping);
  if (cropOffsetFailure) {
    return cropOffsetFailure;
  }

  return {
    scaleDecision: "passed",
    failure: null,
    scaleMapping: { ...presenceResult.scaleMapping, ...dimensionResult },
  };
}