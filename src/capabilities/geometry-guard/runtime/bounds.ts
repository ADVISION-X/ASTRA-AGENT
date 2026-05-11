import type { GeometryGuardPoint, GeometryGuardBoundingBox, GeometryGuardSize, GeometryGuardSafetyPolicy } from "../contract.js";

// ── Bounds validation ─────────────────────────────────────────────────────────

export type BoundsCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateSizeProvided(size: GeometryGuardSize | null | undefined): BoundsCheckResult {
  if (!size || size.width <= 0 || size.height <= 0) {
    return { ok: false, reason: "viewport_size_missing_or_zero" };
  }
  return { ok: true };
}

export function validatePointInsideViewport(
  point: GeometryGuardPoint,
  viewportSize: GeometryGuardSize,
  safetyPolicy: GeometryGuardSafetyPolicy,
): BoundsCheckResult {
  const margin = safetyPolicy.minDistanceFromViewportEdge;
  if (
    point.x < margin ||
    point.y < margin ||
    point.x > viewportSize.width - margin ||
    point.y > viewportSize.height - margin
  ) {
    return {
      ok: false,
      reason: `click_point_outside_viewport_with_margin_${margin}px`,
    };
  }
  return { ok: true };
}

export function validateBboxInsideViewport(
  bbox: GeometryGuardBoundingBox,
  viewportSize: GeometryGuardSize,
  safetyPolicy: GeometryGuardSafetyPolicy,
): BoundsCheckResult {
  if (bbox.width <= 0 || bbox.height <= 0) {
    return { ok: false, reason: "bbox_zero_or_negative_size" };
  }
  const margin = safetyPolicy.minDistanceFromViewportEdge;
  if (
    bbox.x < -margin ||
    bbox.y < -margin ||
    bbox.x + bbox.width > viewportSize.width + margin ||
    bbox.y + bbox.height > viewportSize.height + margin
  ) {
    return { ok: false, reason: "bbox_outside_viewport_bounds" };
  }
  const areaRatio =
    (bbox.width * bbox.height) /
    (viewportSize.width * viewportSize.height);
  if (areaRatio > safetyPolicy.maxBboxAreaRatio) {
    return { ok: false, reason: "bbox_exceeds_max_area_ratio" };
  }
  return { ok: true };
}
