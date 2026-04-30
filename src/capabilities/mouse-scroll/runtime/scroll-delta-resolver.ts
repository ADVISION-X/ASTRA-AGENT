import type { MouseScrollCoordinateSpace, MouseScrollDelta, MouseScrollDirection, MouseScrollMagnitude, MouseScrollRegion, ParsedMouseScrollAbilityInput } from "../contract.js";
import {
  MOUSE_SCROLL_HALF_PAGE_RATIO,
  MOUSE_SCROLL_ONE_PAGE_RATIO,
  MOUSE_SCROLL_SMALL_PIXELS,
  MOUSE_SCROLL_TWO_PAGES_RATIO,
} from "../shared/scroll-magnitude.js";

type DeltaResolutionInput = {
  request: ParsedMouseScrollAbilityInput;
  coordinateSpace: MouseScrollCoordinateSpace;
  direction: MouseScrollDirection;
  magnitude: MouseScrollMagnitude;
  bounds: { width: number; height: number };
  region: MouseScrollRegion | null;
};

function isVertical(direction: MouseScrollDirection): boolean {
  return direction === "up" || direction === "down";
}

function toSignedDelta(direction: MouseScrollDirection, magnitude: number): MouseScrollDelta {
  if (direction === "up") {
    return { deltaX: 0, deltaY: -magnitude };
  }
  if (direction === "down") {
    return { deltaX: 0, deltaY: magnitude };
  }
  if (direction === "left") {
    return { deltaX: -magnitude, deltaY: 0 };
  }
  return { deltaX: magnitude, deltaY: 0 };
}

function normalizeCustomDelta(direction: MouseScrollDirection, delta: MouseScrollDelta): MouseScrollDelta | null {
  const normalized = {
    deltaX: Math.round(delta.deltaX),
    deltaY: Math.round(delta.deltaY),
  };
  if (normalized.deltaX === 0 && normalized.deltaY === 0) {
    return null;
  }
  if (isVertical(direction) && (normalized.deltaX !== 0 || normalized.deltaY === 0)) {
    return null;
  }
  if (!isVertical(direction) && (normalized.deltaY !== 0 || normalized.deltaX === 0)) {
    return null;
  }
  if (direction === "up" && normalized.deltaY >= 0) {
    return null;
  }
  if (direction === "down" && normalized.deltaY <= 0) {
    return null;
  }
  if (direction === "left" && normalized.deltaX >= 0) {
    return null;
  }
  if (direction === "right" && normalized.deltaX <= 0) {
    return null;
  }
  return normalized;
}

function resolveAxisMagnitude(input: {
  direction: MouseScrollDirection;
  magnitude: Exclude<MouseScrollMagnitude, "customDelta">;
  bounds: { width: number; height: number };
  region: MouseScrollRegion | null;
  coordinateSpace: MouseScrollCoordinateSpace;
  maxDeltaAbs: number;
}): { requestedAxisDelta: number; executableAxisDelta: number; deltaResolutionDecision: string; deltaCapDecision: string; dataQualityFlags: string[] } {
  const axis = isVertical(input.direction)
    ? Math.round((input.region?.height ?? input.bounds.height))
    : Math.round((input.region?.width ?? input.bounds.width));
  const requestedAxisDelta =
    input.magnitude === "small"
      ? MOUSE_SCROLL_SMALL_PIXELS
      : input.magnitude === "halfPage"
        ? Math.max(1, Math.round(axis * MOUSE_SCROLL_HALF_PAGE_RATIO))
        : input.magnitude === "onePage"
          ? Math.max(1, Math.round(axis * MOUSE_SCROLL_ONE_PAGE_RATIO))
          : Math.max(1, Math.round(axis * MOUSE_SCROLL_TWO_PAGES_RATIO));
  const effectiveLimit = input.maxDeltaAbs;
  const executableAxisDelta = Math.min(requestedAxisDelta, effectiveLimit);
  return {
    requestedAxisDelta,
    executableAxisDelta,
    deltaResolutionDecision: input.magnitude === "small" ? "magnitude_small_pixels" : "magnitude_ratio_resolved",
    deltaCapDecision: requestedAxisDelta !== executableAxisDelta ? "capped_to_max_delta" : "not_capped",
    dataQualityFlags: requestedAxisDelta !== executableAxisDelta ? ["delta_capped"] : [],
  };
}

export function resolveScrollDelta(input: DeltaResolutionInput):
  | {
      ok: true;
      requestedDelta: MouseScrollDelta;
      executableDelta: MouseScrollDelta;
      deltaResolutionDecision: string;
      deltaCapDecision: string;
      dataQualityFlags: string[];
    }
  | {
      ok: false;
      failureReason: "invalid_custom_delta" | "delta_limit_exceeded" | "zero_delta";
      statusMessage: string;
      dataQualityFlags: string[];
    } {
  const requestedMagnitude = input.request.magnitude;
  if (requestedMagnitude === "customDelta") {
    if (input.request.customDelta === null) {
      return {
        ok: false,
        failureReason: "invalid_custom_delta",
        statusMessage: "Mouse Scroll customDelta magnitude requires a finite customDelta payload.",
        dataQualityFlags: ["custom_delta_missing"],
      };
    }
    const normalized = normalizeCustomDelta(input.direction, input.request.customDelta);
    if (normalized === null) {
      return {
        ok: false,
        failureReason: "invalid_custom_delta",
        statusMessage: "Mouse Scroll customDelta must match direction and cannot fall back to zero.",
        dataQualityFlags: ["custom_delta_invalid"],
      };
    }
    if (Math.abs(normalized.deltaX) > input.request.safetyPolicy.maxDeltaAbs || Math.abs(normalized.deltaY) > input.request.safetyPolicy.maxDeltaAbs) {
      return {
        ok: false,
        failureReason: "delta_limit_exceeded",
        statusMessage: "Mouse Scroll customDelta exceeds maxDeltaAbs and cannot be executed.",
        dataQualityFlags: ["delta_limit_exceeded"],
      };
    }
    return {
      ok: true,
      requestedDelta: normalized,
      executableDelta: normalized,
      deltaResolutionDecision: "custom_delta_normalized",
      deltaCapDecision: "not_capped",
      dataQualityFlags: [],
    };
  }

  const resolved = resolveAxisMagnitude({
    direction: input.direction,
    magnitude: requestedMagnitude,
    bounds: input.bounds,
    region: input.region,
    coordinateSpace: input.coordinateSpace,
    maxDeltaAbs: input.request.safetyPolicy.maxDeltaAbs,
  });
  const requestedDelta = toSignedDelta(input.direction, resolved.requestedAxisDelta);
  const executableDelta = toSignedDelta(input.direction, resolved.executableAxisDelta);
  if (executableDelta.deltaX === 0 && executableDelta.deltaY === 0) {
    return {
      ok: false,
      failureReason: "zero_delta",
      statusMessage: "Mouse Scroll resolved to a zero delta and cannot report no-op success.",
      dataQualityFlags: ["zero_delta"],
    };
  }
  return {
    ok: true,
    requestedDelta,
    executableDelta,
    deltaResolutionDecision: resolved.deltaResolutionDecision,
    deltaCapDecision: resolved.deltaCapDecision,
    dataQualityFlags: resolved.dataQualityFlags,
  };
}