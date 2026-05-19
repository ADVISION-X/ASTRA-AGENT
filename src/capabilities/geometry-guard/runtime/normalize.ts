import type {
  GeometryGuardBoundingBox,
  GeometryGuardPoint,
  GeometryGuardSize,
} from "../geometry-types.js";

// ── Grid cell / bbox normalization ────────────────────────────────────────────

export function projectBboxToViewport(input: {
  bbox: GeometryGuardBoundingBox;
  imageSize: GeometryGuardSize;
  viewportSize: GeometryGuardSize;
}): GeometryGuardBoundingBox {
  const scaleX = input.viewportSize.width / input.imageSize.width;
  const scaleY = input.viewportSize.height / input.imageSize.height;
  return {
    x: input.bbox.x * scaleX,
    y: input.bbox.y * scaleY,
    width: input.bbox.width * scaleX,
    height: input.bbox.height * scaleY,
  };
}

export function projectClickPointToViewport(input: {
  clickPoint: GeometryGuardPoint;
  imageSize: GeometryGuardSize;
  viewportSize: GeometryGuardSize;
}): GeometryGuardPoint {
  const scaleX = input.viewportSize.width / input.imageSize.width;
  const scaleY = input.viewportSize.height / input.imageSize.height;
  return {
    x: input.clickPoint.x * scaleX,
    y: input.clickPoint.y * scaleY,
  };
}

export function bboxCenter(bbox: GeometryGuardBoundingBox): GeometryGuardPoint {
  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
  };
}

export function roundPoint(point: GeometryGuardPoint): GeometryGuardPoint {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

export function roundBbox(bbox: GeometryGuardBoundingBox): GeometryGuardBoundingBox {
  return {
    x: Math.round(bbox.x),
    y: Math.round(bbox.y),
    width: Math.round(bbox.width),
    height: Math.round(bbox.height),
  };
}
