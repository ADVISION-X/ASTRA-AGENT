import type { GeometryGuardBoundingBox, GeometryGuardCheckDecision, GeometryGuardPoint, GeometryGuardSize, ParsedGeometryGuardAbilityInput } from "../contract.js";
import { createGeometryFailure, type GeometryFailure } from "../shared/geometry-failure.js";
import { boxInsideBounds, isFiniteNumber, pointInsideBox, pointInsideBounds, toBounds } from "../shared/geometry-transform.js";

type BoundsGateOptions = {
  requireBBox: boolean;
  requireClickPoint: boolean;
  requireSourceBounds: boolean;
  requireTargetBounds: boolean;
};

export type BoundsGateResult = {
  boundsDecision: GeometryGuardCheckDecision;
  failure: GeometryFailure | null;
  bbox: GeometryGuardBoundingBox | null;
  clickPoint: GeometryGuardPoint | null;
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
};

function isValidSize(size: GeometryGuardSize | null): size is GeometryGuardSize {
  if (!size) {
    return false;
  }

  return isFiniteNumber(size.width) && isFiniteNumber(size.height) && size.width > 0 && size.height > 0;
}

function isValidBoundingBox(bbox: GeometryGuardBoundingBox | null): bbox is GeometryGuardBoundingBox {
  if (!bbox) {
    return false;
  }

  return isFiniteNumber(bbox.x)
    && isFiniteNumber(bbox.y)
    && isFiniteNumber(bbox.width)
    && isFiniteNumber(bbox.height)
    && bbox.width > 0
    && bbox.height > 0;
}

function isValidPoint(point: GeometryGuardPoint | null): point is GeometryGuardPoint {
  if (!point) {
    return false;
  }

  return isFiniteNumber(point.x) && isFiniteNumber(point.y);
}

function resolveTargetBounds(input: ParsedGeometryGuardAbilityInput): GeometryGuardBoundingBox | null {
  const targetSize = input.requestedExecutionSpace === "browserViewport" ? input.viewportSize : input.screenSize;
  return isValidSize(targetSize) ? toBounds(targetSize) : null;
}

function resolveSourceBounds(input: ParsedGeometryGuardAbilityInput): GeometryGuardBoundingBox | null {
  if (input.sourceCoordinateSpace === "browserViewport") {
    return isValidSize(input.viewportSize) ? toBounds(input.viewportSize) : null;
  }
  if (input.sourceCoordinateSpace === "desktopScreen") {
    return isValidSize(input.screenSize) ? toBounds(input.screenSize) : null;
  }
  return isValidSize(input.imageSize) ? toBounds(input.imageSize) : null;
}

function createBoundsFailureResult(input: {
  failureReason: Parameters<typeof createGeometryFailure>[0]["failureReason"];
  message: string;
  bbox: GeometryGuardBoundingBox | null;
  clickPoint: GeometryGuardPoint | null;
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
}): BoundsGateResult {
  return {
    boundsDecision: "failed",
    failure: createGeometryFailure({ status: "failed", failureReason: input.failureReason, message: input.message }),
    bbox: input.bbox,
    clickPoint: input.clickPoint,
    sourceBounds: input.sourceBounds,
    targetBounds: input.targetBounds,
  };
}

function validateRequiredBounds(input: {
  request: ParsedGeometryGuardAbilityInput;
  options: BoundsGateOptions;
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
}): BoundsGateResult | null {
  if (input.options.requireSourceBounds && !input.sourceBounds) {
    return createBoundsFailureResult({
      failureReason: "source_bounds_missing",
      message: "Geometry Guard requires source bounds before validation.",
      bbox: null,
      clickPoint: null,
      sourceBounds: null,
      targetBounds: input.targetBounds,
    });
  }

  return input.options.requireTargetBounds && !input.targetBounds
    ? createBoundsFailureResult({
        failureReason: "target_bounds_missing",
        message: `Geometry Guard requires ${input.request.requestedExecutionSpace} bounds before execution.`,
        bbox: null,
        clickPoint: null,
        sourceBounds: input.sourceBounds,
        targetBounds: null,
      })
    : null;
}

function validateBoundingBox(input: {
  request: ParsedGeometryGuardAbilityInput;
  options: BoundsGateOptions;
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
}): BoundsGateResult | { bbox: GeometryGuardBoundingBox | null } {
  if (input.options.requireBBox && !isValidBoundingBox(input.request.bbox)) {
    return createBoundsFailureResult({
      failureReason: input.request.bbox ? "invalid_bbox" : "missing_bbox",
      message: "Geometry Guard requires a finite positive bounding box.",
      bbox: null,
      clickPoint: null,
      sourceBounds: input.sourceBounds,
      targetBounds: input.targetBounds,
    });
  }

  const bbox = isValidBoundingBox(input.request.bbox) ? input.request.bbox : null;
  return bbox && input.sourceBounds && !boxInsideBounds(bbox, input.sourceBounds)
    ? createBoundsFailureResult({
        failureReason: "bbox_out_of_bounds",
        message: "Geometry Guard blocked a bounding box outside source bounds.",
        bbox,
        clickPoint: null,
        sourceBounds: input.sourceBounds,
        targetBounds: input.targetBounds,
      })
    : { bbox };
}

function resolveClickPoint(input: {
  request: ParsedGeometryGuardAbilityInput;
  options: BoundsGateOptions;
  bbox: GeometryGuardBoundingBox | null;
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
}): BoundsGateResult | { clickPoint: GeometryGuardPoint | null } {
  if (input.options.requireClickPoint && !isValidPoint(input.request.clickPoint)) {
    return createBoundsFailureResult({
      failureReason: input.request.clickPoint ? "invalid_click_point" : "missing_click_point",
      message: "Geometry Guard requires a finite click point.",
      bbox: input.bbox,
      clickPoint: null,
      sourceBounds: input.sourceBounds,
      targetBounds: input.targetBounds,
    });
  }

  return { clickPoint: isValidPoint(input.request.clickPoint) ? input.request.clickPoint : null };
}

function validateClickPointLocation(input: {
  bbox: GeometryGuardBoundingBox | null;
  clickPoint: GeometryGuardPoint | null;
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
}): BoundsGateResult | null {
  if (input.bbox && input.clickPoint && !pointInsideBox(input.clickPoint, input.bbox)) {
    return createBoundsFailureResult({
      failureReason: "click_point_outside_bbox",
      message: "Geometry Guard requires clickPoint inside bbox.",
      bbox: input.bbox,
      clickPoint: input.clickPoint,
      sourceBounds: input.sourceBounds,
      targetBounds: input.targetBounds,
    });
  }

  return input.clickPoint && input.sourceBounds && !pointInsideBounds(input.clickPoint, input.sourceBounds)
    ? createBoundsFailureResult({
        failureReason: "bbox_out_of_bounds",
        message: "Geometry Guard blocked a click point outside source bounds.",
        bbox: input.bbox,
        clickPoint: input.clickPoint,
        sourceBounds: input.sourceBounds,
        targetBounds: input.targetBounds,
      })
    : null;
}

function validateClickPoint(input: {
  request: ParsedGeometryGuardAbilityInput;
  options: BoundsGateOptions;
  bbox: GeometryGuardBoundingBox | null;
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
}): BoundsGateResult | { clickPoint: GeometryGuardPoint | null } {
  const clickPointResult = resolveClickPoint(input);
  if ("boundsDecision" in clickPointResult) {
    return clickPointResult;
  }

  const clickPointFailure = validateClickPointLocation({
    bbox: input.bbox,
    clickPoint: clickPointResult.clickPoint,
    sourceBounds: input.sourceBounds,
    targetBounds: input.targetBounds,
  });
  return clickPointFailure ?? clickPointResult;
}

function validateResolvedBounds(input: {
  request: ParsedGeometryGuardAbilityInput;
  options: BoundsGateOptions;
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
}): BoundsGateResult | { bbox: GeometryGuardBoundingBox | null; clickPoint: GeometryGuardPoint | null } {
  const requiredBoundsFailure = validateRequiredBounds(input);
  if (requiredBoundsFailure) {
    return requiredBoundsFailure;
  }

  const bboxResult = validateBoundingBox(input);
  if ("boundsDecision" in bboxResult) {
    return bboxResult;
  }

  const clickPointResult = validateClickPoint({
    request: input.request,
    options: input.options,
    bbox: bboxResult.bbox,
    sourceBounds: input.sourceBounds,
    targetBounds: input.targetBounds,
  });
  return "boundsDecision" in clickPointResult
    ? clickPointResult
    : { bbox: bboxResult.bbox, clickPoint: clickPointResult.clickPoint };
}

export function evaluateBounds(input: ParsedGeometryGuardAbilityInput, options: BoundsGateOptions): BoundsGateResult {
  const sourceBounds = resolveSourceBounds(input);
  const targetBounds = resolveTargetBounds(input);
  const boundsResult = validateResolvedBounds({
    request: input,
    options,
    sourceBounds,
    targetBounds,
  });
  if ("boundsDecision" in boundsResult) {
    return boundsResult;
  }

  return {
    boundsDecision: "passed",
    failure: null,
    bbox: boundsResult.bbox,
    clickPoint: boundsResult.clickPoint,
    sourceBounds,
    targetBounds,
  };
}