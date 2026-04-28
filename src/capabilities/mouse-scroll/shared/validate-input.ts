import type { MouseScrollChildCapabilityId, NormalizedMouseScrollAbilityInput } from "../contract.js";
import {
  isFiniteNumber,
  isPointInsideRegion,
  isPointWithinBounds,
  isRegionWithinBounds,
  isValidBounds,
  isValidPoint,
  isValidRegion,
} from "./coordinate.js";
import { MOUSE_SCROLL_COORDINATE_SPACES } from "./coordinate.js";
import type { MouseScrollFailureReason } from "./scroll-failure.js";
import { GLOBAL_MOUSE_SCROLL_MAX_REPEAT, MOUSE_SCROLL_DIRECTIONS, MOUSE_SCROLL_MAGNITUDES } from "./scroll-magnitude.js";

type ValidationFailure = {
  ok: false;
  decision: "failed" | "review_required";
  failureReason: MouseScrollFailureReason;
  statusMessage: string;
};

type ValidationSuccess = {
  ok: true;
};

function fail(failureReason: MouseScrollFailureReason, statusMessage: string): ValidationFailure {
  return { ok: false, decision: "failed", failureReason, statusMessage };
}

function review(failureReason: MouseScrollFailureReason, statusMessage: string): ValidationFailure {
  return { ok: false, decision: "review_required", failureReason, statusMessage };
}

function hasSourceRef(input: NormalizedMouseScrollAbilityInput): boolean {
  return Boolean(input.sourceEvidenceRef || input.sourceTargetRef || input.regionRef);
}

function validateCustomDelta(input: NormalizedMouseScrollAbilityInput): ValidationFailure | null {
  if (input.magnitude !== "customDelta") {
    return null;
  }

  if (!input.customDelta || !isFiniteNumber(input.customDelta.deltaX) || !isFiniteNumber(input.customDelta.deltaY)) {
    return fail("invalid_custom_delta", "customDelta magnitude requires finite deltaX and deltaY values");
  }

  if (Math.abs(input.customDelta.deltaX) > input.safetyPolicy.maxDeltaAbs || Math.abs(input.customDelta.deltaY) > input.safetyPolicy.maxDeltaAbs) {
    return fail("delta_limit_exceeded", "customDelta magnitude exceeds Mouse Scroll maxDeltaAbs policy");
  }

  return null;
}

export function validateMouseScrollAbilityInput(
  input: NormalizedMouseScrollAbilityInput,
  childCapabilityId: MouseScrollChildCapabilityId,
): ValidationSuccess | ValidationFailure {
  if (!input.requestedBy.trim()) {
    return fail("missing_requested_by", "Mouse Scroll requestedBy is required");
  }

  if (!input.purpose.trim()) {
    return fail("missing_purpose", "Mouse Scroll purpose is required");
  }

  if (input.safetyPolicy.requireGeometryGuard && !input.geometryGuardRef.trim()) {
    return fail("missing_geometry_guard_ref", "Mouse Scroll requires geometryGuardRef before execution");
  }

  if (input.guardDecision !== "allow") {
    return fail("guard_not_allowed", "Mouse Scroll executes only on Geometry Guard allow decisions");
  }

  if (!MOUSE_SCROLL_COORDINATE_SPACES.includes(input.coordinateSpace)) {
    return fail("invalid_coordinate_space", "Mouse Scroll executes only in browserViewport or desktopScreen space");
  }

  if (!MOUSE_SCROLL_DIRECTIONS.includes(input.direction)) {
    return fail("invalid_direction", "Mouse Scroll direction is invalid");
  }

  if (!MOUSE_SCROLL_MAGNITUDES.includes(input.magnitude)) {
    return fail("invalid_magnitude", "Mouse Scroll magnitude is invalid");
  }

  if (!Number.isInteger(input.repeat) || input.repeat < 1) {
    return fail("invalid_repeat", "Mouse Scroll repeat must be a positive integer");
  }

  if (input.repeat > input.safetyPolicy.maxRepeat || input.repeat > GLOBAL_MOUSE_SCROLL_MAX_REPEAT) {
    return fail("repeat_limit_exceeded", "Mouse Scroll repeat exceeds policy limits");
  }

  if (!Number.isInteger(input.safetyPolicy.maxDurationMs) || input.safetyPolicy.maxDurationMs <= 0) {
    return fail("invalid_duration_limit", "Mouse Scroll maxDurationMs must be a positive integer");
  }

  if (!isValidBounds(input.bounds)) {
    return fail("invalid_bounds", "Mouse Scroll bounds must be finite positive dimensions");
  }

  if (!isValidPoint(input.anchorPoint)) {
    return fail("invalid_anchor_point", "Mouse Scroll anchorPoint must be finite coordinates");
  }

  if (input.safetyPolicy.blockIfOutOfBounds && !isPointWithinBounds(input.anchorPoint, input.bounds)) {
    return fail("invalid_anchor_point", "Mouse Scroll anchorPoint must stay within approved bounds");
  }

  if (childCapabilityId === "scroll-region") {
    if (!input.regionRef) {
      return fail("missing_region_ref", "Mouse Scroll region execution requires regionRef");
    }

    if (!isValidRegion(input.region)) {
      return fail("invalid_region", "Mouse Scroll region execution requires finite positive region bounds");
    }

    if (input.safetyPolicy.blockIfOutOfBounds && !isRegionWithinBounds(input.region, input.bounds)) {
      return fail("invalid_region", "Mouse Scroll region must stay within approved bounds");
    }

    if (!isPointInsideRegion(input.anchorPoint, input.region)) {
      return fail("invalid_anchor_point", "Mouse Scroll region anchorPoint must stay inside approved region");
    }
  }

  if (input.safetyPolicy.blockIfNoSourceRef && !hasSourceRef(input)) {
    if (input.safetyPolicy.allowOperatorManual) {
      return input.safetyPolicy.operatorManualApprovalRef
        ? { ok: true }
        : review("operator_manual_approval_required", "Mouse Scroll requires operatorManualApprovalRef when source refs are absent");
    }

    return fail("missing_source_ref", "Mouse Scroll requires sourceEvidenceRef, sourceTargetRef, or regionRef");
  }

  const customDeltaFailure = validateCustomDelta(input);
  if (customDeltaFailure) {
    return customDeltaFailure;
  }

  return { ok: true };
}