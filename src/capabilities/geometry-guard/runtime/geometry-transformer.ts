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

export function transformGeometry(input: {
  request: ParsedGeometryGuardAbilityInput;
  bbox: GeometryGuardBoundingBox | null;
  clickPoint: GeometryGuardPoint | null;
  targetBounds: GeometryGuardBoundingBox | null;
  scaleMapping: GeometryGuardScaleMapping | null;
  requiresExecutableOutput: boolean;
}): GeometryTransformResult {
  if (!input.requiresExecutableOutput) {
    return { transformDecision: "not_applicable", failure: null, normalizedCoordinateSpace: null, normalizedBbox: null, normalizedClickPoint: null, appliedScaleMapping: input.scaleMapping };
  }

  if (!input.bbox || !input.clickPoint || !input.targetBounds) {
    return {
      transformDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: "coordinate_transform_failed", message: "Geometry Guard requires bbox, clickPoint, and target bounds before transform." }),
      normalizedCoordinateSpace: null,
      normalizedBbox: null,
      normalizedClickPoint: null,
      appliedScaleMapping: input.scaleMapping,
    };
  }

  const transformedBbox = input.scaleMapping ? applyBoundingBoxMapping(input.bbox, input.scaleMapping) : input.bbox;
  const transformedClickPoint = input.scaleMapping ? applyPointMapping(input.clickPoint, input.scaleMapping) : input.clickPoint;
  const normalizedBbox = applyRoundingToBoundingBox(transformedBbox, input.request.safetyPolicy.roundingPolicy);
  const normalizedClickPoint = applyRoundingToPoint(transformedClickPoint, input.request.safetyPolicy.roundingPolicy);

  if (!boxInsideBounds(normalizedBbox, input.targetBounds) || !pointInsideBounds(normalizedClickPoint, input.targetBounds)) {
    return {
      transformDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: "bbox_out_of_bounds", message: "Geometry Guard blocked mapped geometry outside target bounds." }),
      normalizedCoordinateSpace: null,
      normalizedBbox: null,
      normalizedClickPoint: null,
      appliedScaleMapping: input.scaleMapping,
    };
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