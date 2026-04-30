import type { GeometryGuardBoundingBox, GeometryGuardCheckDecision, GeometryGuardExecutionSpace, GeometryGuardPoint, GeometryGuardScaleMapping, ParsedGeometryGuardAbilityInput } from "../contract.js";
import { createGeometryFailure, type GeometryFailure } from "../shared/geometry-failure.js";
import { applyBoundingBoxMapping, applyPointMapping, applyRoundingToBoundingBox, applyRoundingToPoint, boxInsideBounds, pointInsideBounds } from "../shared/geometry-transform.js";

export type GeometryTransformResult = {
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

export function transformGeometry(input: GeometryTransformInput): GeometryTransformResult {
  if (!input.requiresExecutableOutput) {
    return { transformDecision: "not_applicable", failure: null, normalizedCoordinateSpace: null, normalizedBbox: null, normalizedClickPoint: null, appliedScaleMapping: input.scaleMapping };
  }

  if (!input.bbox || !input.clickPoint || !input.targetBounds) {
    return createTransformFailure(input, "coordinate_transform_failed", "Geometry Guard requires bbox, clickPoint, and target bounds before transform.");
  }

  const { normalizedBbox, normalizedClickPoint } = resolveMappedGeometry(input);

  if (!boxInsideBounds(normalizedBbox, input.targetBounds) || !pointInsideBounds(normalizedClickPoint, input.targetBounds)) {
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