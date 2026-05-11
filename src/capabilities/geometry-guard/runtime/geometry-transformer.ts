import type { GeometryGuardBoundingBox, GeometryGuardCheckDecision, GeometryGuardExecutionSpace, GeometryGuardPoint, GeometryGuardScaleMapping, ParsedGeometryGuardAbilityInput } from "../contract.js";
import { createGeometryFailure, type GeometryFailure } from "../shared/geometry-failure.js";
import { applyBoundingBoxMapping, applyPointMapping, applyRoundingToBoundingBox, applyRoundingToPoint, boxInsideBounds, pointInsideBounds } from "../shared/geometry-transform.js";

type GeometryTransformResult = {
  transformDecision: GeometryGuardCheckDecision;
  failure: GeometryFailure | null;
  normalizedCoordinateSpace: GeometryGuardExecutionSpace | null;
  normalizedBbox: GeometryGuardBoundingBox | null;
  normalizedClickPoint: GeometryGuardPoint | null;
  appliedScaleMapping: GeometryGuardScaleMapping | null;
};

type GeometryTransformInput = {
  request: ParsedGeometryGuardAbilityInput;
  bbox: GeometryGuardBoundingBox | null;
  clickPoint: GeometryGuardPoint | null;
  targetBounds: GeometryGuardBoundingBox | null;
  scaleMapping: GeometryGuardScaleMapping | null;
  requiresExecutableOutput: boolean;
};

function createTransformFailure(input: GeometryTransformInput, failureReason: "coordinate_transform_failed" | "bbox_out_of_bounds", message: string): GeometryTransformResult {
  return {
    transformDecision: "failed",
    failure: createGeometryFailure({ status: "failed", failureReason, message }),
    normalizedCoordinateSpace: null,
    normalizedBbox: null,
    normalizedClickPoint: null,
    appliedScaleMapping: input.scaleMapping,
  };
}

function resolveMappedGeometry(input: GeometryTransformInput) {
  const transformedBbox = input.scaleMapping ? applyBoundingBoxMapping(input.bbox!, input.scaleMapping) : input.bbox!;
  const transformedClickPoint = input.scaleMapping ? applyPointMapping(input.clickPoint!, input.scaleMapping) : input.clickPoint!;

  return {
    normalizedBbox: applyRoundingToBoundingBox(transformedBbox, input.request.safetyPolicy.roundingPolicy),
    normalizedClickPoint: applyRoundingToPoint(transformedClickPoint, input.request.safetyPolicy.roundingPolicy),
  };
}

function createNotApplicableTransformResult(input: GeometryTransformInput): GeometryTransformResult {
  return { transformDecision: "not_applicable", failure: null, normalizedCoordinateSpace: null, normalizedBbox: null, normalizedClickPoint: null, appliedScaleMapping: input.scaleMapping };
}

function hasTransformInputs(input: GeometryTransformInput): boolean {
  return Boolean(input.bbox && input.clickPoint && input.targetBounds);
}

function hasValidMappedGeometry(input: GeometryTransformInput, normalizedBbox: GeometryGuardBoundingBox, normalizedClickPoint: GeometryGuardPoint): boolean {
  return normalizedBbox.width > 0
    && normalizedBbox.height > 0
    && boxInsideBounds(normalizedBbox, input.targetBounds!)
    && pointInsideBounds(normalizedClickPoint, input.targetBounds!);
}

export function transformGeometry(input: GeometryTransformInput) {
  if (!input.requiresExecutableOutput) {
    return createNotApplicableTransformResult(input);
  }

  if (!hasTransformInputs(input)) {
    return createTransformFailure(input, "coordinate_transform_failed", "Geometry Guard requires bbox, clickPoint, and target bounds before transform.");
  }

  const { normalizedBbox, normalizedClickPoint } = resolveMappedGeometry(input);

  if (!hasValidMappedGeometry(input, normalizedBbox, normalizedClickPoint)) {
    if (normalizedBbox.width <= 0 || normalizedBbox.height <= 0) {
      return createTransformFailure(input, "coordinate_transform_failed", "Geometry Guard blocked mapped geometry that collapsed after rounding.");
    }

    return createTransformFailure(input, "bbox_out_of_bounds", "Geometry Guard blocked mapped geometry outside target bounds.");
  }

  return {
    transformDecision: "passed",
    failure: null,
    normalizedCoordinateSpace: input.request.requestedExecutionSpace,
    normalizedBbox,
    normalizedClickPoint,
    appliedScaleMapping: input.scaleMapping,
  };
}