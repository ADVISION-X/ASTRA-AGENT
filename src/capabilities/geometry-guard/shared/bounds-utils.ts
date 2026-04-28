import type { GeometryGuardBoundingBox, GeometryGuardPoint, GeometryGuardSize } from "../contract.js";

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidSize(value: GeometryGuardSize | null): value is GeometryGuardSize {
  if (!value) {
    return false;
  }

  return isFiniteNumber(value.width)
    && isFiniteNumber(value.height)
    && value.width > 0
    && value.height > 0;
}

export function isValidBoundingBox(value: GeometryGuardBoundingBox | null): value is GeometryGuardBoundingBox {
  if (!value) {
    return false;
  }

  return isFiniteNumber(value.x)
    && isFiniteNumber(value.y)
    && isFiniteNumber(value.width)
    && isFiniteNumber(value.height)
    && value.width > 0
    && value.height > 0;
}

export function isValidPoint(value: GeometryGuardPoint | null): value is GeometryGuardPoint {
  if (!value) {
    return false;
  }

  return isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

export function isPointInsideBoundingBox(point: GeometryGuardPoint, bbox: GeometryGuardBoundingBox): boolean {
  return point.x >= bbox.x
    && point.y >= bbox.y
    && point.x <= bbox.x + bbox.width
    && point.y <= bbox.y + bbox.height;
}

export function isBoundingBoxWithinSize(bbox: GeometryGuardBoundingBox, size: GeometryGuardSize): boolean {
  return bbox.x >= 0
    && bbox.y >= 0
    && bbox.x + bbox.width <= size.width
    && bbox.y + bbox.height <= size.height;
}

export function isPointWithinSize(point: GeometryGuardPoint, size: GeometryGuardSize): boolean {
  return point.x >= 0 && point.y >= 0 && point.x <= size.width && point.y <= size.height;
}