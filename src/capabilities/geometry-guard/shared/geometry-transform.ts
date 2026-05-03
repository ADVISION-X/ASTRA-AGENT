import type {
  GeometryGuardBoundingBox,
  GeometryGuardPoint,
  GeometryGuardRoundingPolicy,
  GeometryGuardScaleMapping,
  GeometryGuardSize,
} from "../contract.js";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toBounds(size: GeometryGuardSize): GeometryGuardBoundingBox {
  return {
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
  };
}

function pointInsideBox(point: GeometryGuardPoint, bbox: GeometryGuardBoundingBox): boolean {
  return point.x >= bbox.x
    && point.y >= bbox.y
    && point.x <= bbox.x + bbox.width
    && point.y <= bbox.y + bbox.height;
}

function boxInsideBounds(bbox: GeometryGuardBoundingBox, bounds: GeometryGuardBoundingBox): boolean {
  return bbox.x >= bounds.x
    && bbox.y >= bounds.y
    && bbox.x + bbox.width <= bounds.x + bounds.width
    && bbox.y + bbox.height <= bounds.y + bounds.height;
}

function pointInsideBounds(point: GeometryGuardPoint, bounds: GeometryGuardBoundingBox): boolean {
  return point.x >= bounds.x
    && point.y >= bounds.y
    && point.x <= bounds.x + bounds.width
    && point.y <= bounds.y + bounds.height;
}

function applyPointMapping(point: GeometryGuardPoint, mapping: GeometryGuardScaleMapping): GeometryGuardPoint {
  return {
    x: mapping.cropOffsetX + point.x * mapping.scaleX,
    y: mapping.cropOffsetY + point.y * mapping.scaleY,
  };
}

function applyBoundingBoxMapping(bbox: GeometryGuardBoundingBox, mapping: GeometryGuardScaleMapping): GeometryGuardBoundingBox {
  return {
    x: mapping.cropOffsetX + bbox.x * mapping.scaleX,
    y: mapping.cropOffsetY + bbox.y * mapping.scaleY,
    width: bbox.width * mapping.scaleX,
    height: bbox.height * mapping.scaleY,
  };
}

function roundValue(value: number, policy: GeometryGuardRoundingPolicy): number {
  switch (policy) {
    case "nearest_pixel":
      return Math.round(value);
  }
}

function applyRoundingToPoint(point: GeometryGuardPoint, policy: GeometryGuardRoundingPolicy): GeometryGuardPoint {
  return {
    x: roundValue(point.x, policy),
    y: roundValue(point.y, policy),
  };
}

function applyRoundingToBoundingBox(bbox: GeometryGuardBoundingBox, policy: GeometryGuardRoundingPolicy): GeometryGuardBoundingBox {
  return {
    x: roundValue(bbox.x, policy),
    y: roundValue(bbox.y, policy),
    width: roundValue(bbox.width, policy),
    height: roundValue(bbox.height, policy),
  };
}

function createInnerSafetyBox(bbox: GeometryGuardBoundingBox, marginPx: number): GeometryGuardBoundingBox | null {
  const safeMargin = Math.max(0, marginPx);
  const width = bbox.width - safeMargin * 2;
  const height = bbox.height - safeMargin * 2;
  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    x: bbox.x + safeMargin,
    y: bbox.y + safeMargin,
    width,
    height,
  };
}

function sanitizeRefPart(value: string | null | undefined): string {
  if (!value) {
    return "none";
  }

  return value.replace(/[^a-zA-Z0-9:_-]+/g, "_");
}

function buildStableGeometryRef(parts: Array<string | null | undefined>): string {
  return parts.map((part) => sanitizeRefPart(part)).join(":");
}

export {
  applyBoundingBoxMapping,
  applyPointMapping,
  applyRoundingToBoundingBox,
  applyRoundingToPoint,
  boxInsideBounds,
  buildStableGeometryRef,
  createInnerSafetyBox,
  isFiniteNumber,
  pointInsideBounds,
  pointInsideBox,
  toBounds,
};