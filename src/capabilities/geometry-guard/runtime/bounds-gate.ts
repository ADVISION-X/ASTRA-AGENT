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

export function evaluateBounds(input: ParsedGeometryGuardAbilityInput, options: BoundsGateOptions): BoundsGateResult {
  const sourceBounds = resolveSourceBounds(input);
  const targetBounds = resolveTargetBounds(input);

  if (options.requireSourceBounds && !sourceBounds) {
    return {
      boundsDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: "source_bounds_missing", message: "Geometry Guard requires source bounds before validation." }),
      bbox: null,
      clickPoint: null,
      sourceBounds: null,
      targetBounds,
    };
  }

  if (options.requireTargetBounds && !targetBounds) {
    return {
      boundsDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: "target_bounds_missing", message: `Geometry Guard requires ${input.requestedExecutionSpace} bounds before execution.` }),
      bbox: null,
      clickPoint: null,
      sourceBounds,
      targetBounds: null,
    };
  }

  if (options.requireBBox && !isValidBoundingBox(input.bbox)) {
    return {
      boundsDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: input.bbox ? "invalid_bbox" : "missing_bbox", message: "Geometry Guard requires a finite positive bounding box." }),
      bbox: null,
      clickPoint: null,
      sourceBounds,
      targetBounds,
    };
  }

  const bbox = isValidBoundingBox(input.bbox) ? input.bbox : null;
  if (bbox && sourceBounds && !boxInsideBounds(bbox, sourceBounds)) {
    return {
      boundsDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: "bbox_out_of_bounds", message: "Geometry Guard blocked a bounding box outside source bounds." }),
      bbox,
      clickPoint: null,
      sourceBounds,
      targetBounds,
    };
  }

  if (options.requireClickPoint && !isValidPoint(input.clickPoint)) {
    return {
      boundsDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: input.clickPoint ? "invalid_click_point" : "missing_click_point", message: "Geometry Guard requires a finite click point." }),
      bbox,
      clickPoint: null,
      sourceBounds,
      targetBounds,
    };
  }

  const clickPoint = isValidPoint(input.clickPoint) ? input.clickPoint : null;
  if (bbox && clickPoint && !pointInsideBox(clickPoint, bbox)) {
    return {
      boundsDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: "click_point_outside_bbox", message: "Geometry Guard requires clickPoint inside bbox." }),
      bbox,
      clickPoint,
      sourceBounds,
      targetBounds,
    };
  }

  if (clickPoint && sourceBounds && !pointInsideBounds(clickPoint, sourceBounds)) {
    return {
      boundsDecision: "failed",
      failure: createGeometryFailure({ status: "failed", failureReason: "bbox_out_of_bounds", message: "Geometry Guard blocked a click point outside source bounds." }),
      bbox,
      clickPoint,
      sourceBounds,
      targetBounds,
    };
  }

  return {
    boundsDecision: "passed",
    failure: null,
    bbox,
    clickPoint,
    sourceBounds,
    targetBounds,
  };
}