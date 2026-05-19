import type {
  GeometryGuardBoundingBox,
  GeometryGuardPoint,
  GeometryGuardSize,
} from "../geometry-types.js";
import type {
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import {
  bboxCenter,
  projectBboxToViewport,
  projectClickPointToViewport,
  roundBbox,
  roundPoint,
} from "./normalize.js";

export interface NormalizedGeometry {
  normalizedClickPoint: GeometryGuardPoint;
  normalizedBbox: GeometryGuardBoundingBox;
}

function hasUsableImageSize(
  imageSize: GeometryGuardSize | null | undefined,
): imageSize is GeometryGuardSize {
  return Boolean(imageSize && imageSize.width > 0 && imageSize.height > 0);
}

export function normalizeBboxGridRegion(
  input: ParsedGeometryGuardAbilityInput,
  viewportSize: GeometryGuardSize,
): NormalizedGeometry {
  const sourceBbox = input.bbox!;
  const projectedBbox = hasUsableImageSize(input.imageSize)
    ? projectBboxToViewport({ bbox: sourceBbox, imageSize: input.imageSize, viewportSize })
    : sourceBbox;
  const normalizedBbox = roundBbox(projectedBbox);
  const clickPoint = input.clickPoint
    ? scaleBboxRegionClick(input.clickPoint, input, viewportSize)
    : bboxCenter(normalizedBbox);
  return { normalizedBbox, normalizedClickPoint: roundPoint(clickPoint) };
}

export function normalizeClickGridCell(
  input: ParsedGeometryGuardAbilityInput,
  viewportSize: GeometryGuardSize,
): NormalizedGeometry {
  const sourceBbox = input.bbox!;
  if (!hasUsableImageSize(input.imageSize)) {
    return {
      normalizedBbox: roundBbox(sourceBbox),
      normalizedClickPoint: roundPoint(input.clickPoint ?? bboxCenter(sourceBbox)),
    };
  }
  const normalizedBbox = projectBboxToViewport({
    bbox: sourceBbox,
    imageSize: input.imageSize,
    viewportSize,
  });
  const clickPoint = input.clickPoint
    ? projectClickPointToViewport({ clickPoint: input.clickPoint, imageSize: input.imageSize, viewportSize })
    : bboxCenter(normalizedBbox);
  return { normalizedBbox: roundBbox(normalizedBbox), normalizedClickPoint: roundPoint(clickPoint) };
}

function scaleBboxRegionClick(
  clickPoint: GeometryGuardPoint,
  input: ParsedGeometryGuardAbilityInput,
  viewportSize: GeometryGuardSize,
): GeometryGuardPoint {
  const imageSize = input.imageSize;
  if (!hasUsableImageSize(imageSize)) {
    return clickPoint;
  }
  return {
    x: clickPoint.x * (viewportSize.width / imageSize.width),
    y: clickPoint.y * (viewportSize.height / imageSize.height),
  };
}
