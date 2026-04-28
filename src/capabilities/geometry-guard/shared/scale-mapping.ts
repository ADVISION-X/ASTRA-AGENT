import type { GeometryGuardBoundingBox, GeometryGuardPoint, GeometryGuardScaleMapping } from "../contract.js";
import { isFiniteNumber } from "./bounds-utils.js";

export function isValidScaleMapping(mapping: GeometryGuardScaleMapping | null): mapping is GeometryGuardScaleMapping {
  if (!mapping) {
    return false;
  }

  return isFiniteNumber(mapping.cropOffsetX)
    && isFiniteNumber(mapping.cropOffsetY)
    && isFiniteNumber(mapping.scaleX)
    && isFiniteNumber(mapping.scaleY)
    && isFiniteNumber(mapping.targetWidth)
    && isFiniteNumber(mapping.targetHeight)
    && mapping.scaleX > 0
    && mapping.scaleY > 0
    && mapping.targetWidth > 0
    && mapping.targetHeight > 0;
}

export function mapPointToExecutionSpace(point: GeometryGuardPoint, mapping: GeometryGuardScaleMapping): GeometryGuardPoint {
  return {
    x: mapping.cropOffsetX + point.x * mapping.scaleX,
    y: mapping.cropOffsetY + point.y * mapping.scaleY,
  };
}

export function mapBoundingBoxToExecutionSpace(bbox: GeometryGuardBoundingBox, mapping: GeometryGuardScaleMapping): GeometryGuardBoundingBox {
  return {
    x: mapping.cropOffsetX + bbox.x * mapping.scaleX,
    y: mapping.cropOffsetY + bbox.y * mapping.scaleY,
    width: bbox.width * mapping.scaleX,
    height: bbox.height * mapping.scaleY,
  };
}