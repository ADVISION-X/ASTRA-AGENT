import type { MouseScrollCoordinateSpace, MouseScrollDelta, MouseScrollDirection, MouseScrollMagnitude, MouseScrollRegion, ParsedMouseScrollAbilityInput } from "../contract.js";

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
}): { requestedAxisDelta: number; executableAxisDelta: number; dataQualityFlags: string[] } {
  const axis = isVertical(input.direction)
    ? Math.round((input.region?.height ?? input.bounds.height))
    : Math.round((input.region?.width ?? input.bounds.width));
  const requestedAxisDelta =
    input.magnitude === "small"
      ? Math.max(48, Math.round(axis * 0.12))
      : input.magnitude === "halfPage"
        ? Math.max(64, Math.round(axis * 0.5))
        : input.magnitude === "onePage"
          ? Math.max(96, Math.round(axis * 0.9))
          : Math.max(128, Math.round(axis * 1.8));
  const effectiveLimit = input.coordinateSpace === "desktopScreen"
    ? Math.min(input.maxDeltaAbs, Math.max(96, Math.round(axis * 0.75)))
    : input.maxDeltaAbs;
  const executableAxisDelta = Math.min(requestedAxisDelta, effectiveLimit);
  return {
    requestedAxisDelta,
    executableAxisDelta,
    dataQualityFlags: requestedAxisDelta !== executableAxisDelta ? ["delta_capped"] : [],
  };
}

export function resolveScrollDelta(input: DeltaResolutionInput):
  | {
      ok: true;
      requestedDelta: MouseScrollDelta;
      executableDelta: MouseScrollDelta;
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
    dataQualityFlags: resolved.dataQualityFlags,
  };
}