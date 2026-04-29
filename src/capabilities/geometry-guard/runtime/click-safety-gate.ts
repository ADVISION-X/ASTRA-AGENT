import type { GeometryGuardBoundingBox, GeometryGuardCheckDecision, GeometryGuardPoint, ParsedGeometryGuardAbilityInput } from "../contract.js";
import { createGeometryFailure, type GeometryFailure } from "../shared/geometry-failure.js";
import { resolveClickSafetyMarginPx } from "../shared/geometry-policy.js";
import { createInnerSafetyBox, pointInsideBox } from "../shared/geometry-transform.js";

export type ClickSafetyGateResult = {
  boundsDecision: GeometryGuardCheckDecision;
  failure: GeometryFailure | null;
};

export function evaluateClickSafety(input: ParsedGeometryGuardAbilityInput, bbox: GeometryGuardBoundingBox | null, clickPoint: GeometryGuardPoint | null, requiresExecutableOutput: boolean): ClickSafetyGateResult {
  if (!requiresExecutableOutput || !bbox || !clickPoint) {
    return { boundsDecision: "not_applicable", failure: null };
  }

  const innerSafetyBox = createInnerSafetyBox(bbox, resolveClickSafetyMarginPx(input.safetyPolicy));
  if (!innerSafetyBox || !pointInsideBox(clickPoint, innerSafetyBox)) {
    return {
      boundsDecision: input.safetyPolicy.allowReviewRequired ? "review_required" : "failed",
      failure: createGeometryFailure({ status: input.safetyPolicy.allowReviewRequired ? "review_required" : "failed", failureReason: "click_point_in_safety_margin", message: "Geometry Guard blocked a click point too close to the bounding-box edge." }),
    };
  }

  return { boundsDecision: "passed", failure: null };
}