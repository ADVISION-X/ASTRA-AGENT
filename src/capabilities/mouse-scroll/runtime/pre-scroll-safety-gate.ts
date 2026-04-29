import type { MouseScrollCoordinateSpace, MouseScrollRegion, ParsedMouseScrollAbilityInput } from "../contract.js";

function isPointWithinBounds(point: { x: number; y: number }, bounds: { width: number; height: number }): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < bounds.width && point.y < bounds.height;
}

function isRegionWithinBounds(region: MouseScrollRegion, bounds: { width: number; height: number }): boolean {
  return region.x >= 0
    && region.y >= 0
    && region.width > 0
    && region.height > 0
    && region.x + region.width <= bounds.width
    && region.y + region.height <= bounds.height;
}

function isPointWithinRegion(point: { x: number; y: number }, region: MouseScrollRegion): boolean {
  return point.x >= region.x
    && point.y >= region.y
    && point.x < region.x + region.width
    && point.y < region.y + region.height;
}

function regionsMatch(left: MouseScrollRegion, right: MouseScrollRegion): boolean {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}

export function validatePreScrollSafety(input: {
  request: ParsedMouseScrollAbilityInput;
  expectedCoordinateSpace: MouseScrollCoordinateSpace;
}):
  | {
      ok: true;
      requestedAnchor: { x: number; y: number };
      executableAnchor: { x: number; y: number };
      bounds: { width: number; height: number };
      region: MouseScrollRegion | null;
    }
  | {
      ok: false;
      status: "failed";
      failureReason:
        | "invalid_coordinate_space"
        | "invalid_bounds"
        | "invalid_region"
        | "anchor_out_of_bounds"
        | "anchor_outside_region"
        | "invalid_repeat"
        | "invalid_duration_limit"
        | "invalid_primitive_timeout"
        | "invalid_delta_limit";
      statusMessage: string;
      policyDecision: "block";
      dataQualityFlags: string[];
    } {
  const requestedAnchor = input.request.geometryScrollProof.normalizedAnchorPoint;
  if (input.request.coordinateSpace !== input.expectedCoordinateSpace) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_coordinate_space",
      statusMessage: "Mouse Scroll coordinateSpace no longer matches this child capability.",
      policyDecision: "block",
      dataQualityFlags: ["coordinate_space_mismatch"],
    };
  }

  const bounds = input.request.bounds;
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_bounds",
      statusMessage: "Mouse Scroll bounds must be finite positive dimensions.",
      policyDecision: "block",
      dataQualityFlags: ["invalid_bounds"],
    };
  }
  if (!Number.isInteger(input.request.repeat) || input.request.repeat <= 0 || input.request.repeat > input.request.safetyPolicy.maxRepeat) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_repeat",
      statusMessage: "Mouse Scroll repeat must be a finite positive integer within maxRepeat.",
      policyDecision: "block",
      dataQualityFlags: ["invalid_repeat"],
    };
  }
  if (!Number.isFinite(input.request.safetyPolicy.maxDurationMs) || input.request.safetyPolicy.maxDurationMs <= 0) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_duration_limit",
      statusMessage: "Mouse Scroll requires a finite positive maxDurationMs.",
      policyDecision: "block",
      dataQualityFlags: ["invalid_duration_limit"],
    };
  }
  if (!Number.isFinite(input.request.safetyPolicy.primitiveTimeoutMs) || input.request.safetyPolicy.primitiveTimeoutMs <= 0) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_primitive_timeout",
      statusMessage: "Mouse Scroll requires a finite positive primitiveTimeoutMs.",
      policyDecision: "block",
      dataQualityFlags: ["invalid_primitive_timeout"],
    };
  }
  if (!Number.isFinite(input.request.safetyPolicy.maxDeltaAbs) || input.request.safetyPolicy.maxDeltaAbs <= 0) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_delta_limit",
      statusMessage: "Mouse Scroll requires a finite positive maxDeltaAbs.",
      policyDecision: "block",
      dataQualityFlags: ["invalid_delta_limit"],
    };
  }

  const executableAnchor = {
    x: Math.round(requestedAnchor.x),
    y: Math.round(requestedAnchor.y),
  };
  if (!isPointWithinBounds(executableAnchor, bounds)) {
    return {
      ok: false,
      status: "failed",
      failureReason: "anchor_out_of_bounds",
      statusMessage: "Mouse Scroll executableAnchor is outside the governed bounds window.",
      policyDecision: "block",
      dataQualityFlags: ["anchor_out_of_bounds"],
    };
  }

  if (input.request.childCapabilityId !== "scroll-region") {
    if (input.request.region !== null || input.request.regionRef !== null) {
      return {
        ok: false,
        status: "failed",
        failureReason: "invalid_region",
        statusMessage: "Non-region Mouse Scroll children must not carry region or regionRef.",
        policyDecision: "block",
        dataQualityFlags: ["unexpected_region_payload"],
      };
    }

    return {
      ok: true,
      requestedAnchor,
      executableAnchor,
      bounds,
      region: null,
    };
  }

  const region = input.request.region;
  const proofRegion = input.request.geometryScrollProof.normalizedRegion;
  if (region === null || input.request.regionRef === null || proofRegion === null) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_region",
      statusMessage: "scroll-region requires region, regionRef, and Geometry Guard normalizedRegion proof.",
      policyDecision: "block",
      dataQualityFlags: ["region_payload_incomplete"],
    };
  }
  if (!regionsMatch(region, proofRegion)) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_region",
      statusMessage: "scroll-region region must match Geometry Guard normalizedRegion exactly.",
      policyDecision: "block",
      dataQualityFlags: ["region_proof_mismatch"],
    };
  }
  if (!isRegionWithinBounds(region, bounds)) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_region",
      statusMessage: "scroll-region region must stay inside the governed bounds window.",
      policyDecision: "block",
      dataQualityFlags: ["region_out_of_bounds"],
    };
  }
  if (!isPointWithinRegion(executableAnchor, region)) {
    return {
      ok: false,
      status: "failed",
      failureReason: "anchor_outside_region",
      statusMessage: "scroll-region anchor must stay inside the Geometry Guard normalizedRegion.",
      policyDecision: "block",
      dataQualityFlags: ["anchor_outside_region"],
    };
  }

  return {
    ok: true,
    requestedAnchor,
    executableAnchor,
    bounds,
    region,
  };
}