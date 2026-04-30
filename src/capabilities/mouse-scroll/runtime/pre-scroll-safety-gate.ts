import type { MouseScrollCoordinateSpace, MouseScrollRegion, ParsedMouseScrollAbilityInput } from "../contract.js";

const MAX_ALLOWED_BOUND = 12_000;

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
      coordinateRoundingDecision: string;
      safetyDecision: "allow";
      safetyDecisionReason: string;
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
        | "invalid_delta_limit"
        | "bounds_too_large";
      statusMessage: string;
      policyDecision: "block";
      safetyDecision: "block";
      safetyDecisionReason: string;
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
      safetyDecision: "block",
      safetyDecisionReason: "coordinate_space_mismatch",
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
      safetyDecision: "block",
      safetyDecisionReason: "invalid_bounds",
      dataQualityFlags: ["invalid_bounds"],
    };
  }
  if (bounds.width > MAX_ALLOWED_BOUND || bounds.height > MAX_ALLOWED_BOUND) {
    return {
      ok: false,
      status: "failed",
      failureReason: "bounds_too_large",
      statusMessage: "Mouse Scroll bounds exceed the governed maximum size.",
      policyDecision: "block",
      safetyDecision: "block",
      safetyDecisionReason: "bounds_too_large",
      dataQualityFlags: ["bounds_too_large"],
    };
  }
  if (!Number.isInteger(input.request.repeat) || input.request.repeat <= 0 || input.request.repeat > input.request.safetyPolicy.maxRepeat) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_repeat",
      statusMessage: "Mouse Scroll repeat must be a finite positive integer within maxRepeat.",
      policyDecision: "block",
      safetyDecision: "block",
      safetyDecisionReason: "repeat_out_of_range",
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
      safetyDecision: "block",
      safetyDecisionReason: "invalid_max_duration",
      dataQualityFlags: ["invalid_duration_limit"],
    };
  }
  if (!Number.isFinite(input.request.safetyPolicy.primitiveTimeoutMs) || input.request.safetyPolicy.primitiveTimeoutMs <= 0 || input.request.safetyPolicy.primitiveTimeoutMs > input.request.safetyPolicy.maxDurationMs) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_primitive_timeout",
      statusMessage: "Mouse Scroll requires a finite positive primitiveTimeoutMs.",
      policyDecision: "block",
      safetyDecision: "block",
      safetyDecisionReason: "invalid_primitive_timeout",
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
      safetyDecision: "block",
      safetyDecisionReason: "invalid_delta_limit",
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
      safetyDecision: "block",
      safetyDecisionReason: "anchor_out_of_bounds",
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
        safetyDecision: "block",
        safetyDecisionReason: "unexpected_region_payload",
        dataQualityFlags: ["unexpected_region_payload"],
      };
    }

    return {
      ok: true,
      requestedAnchor,
      executableAnchor,
      bounds,
      region: null,
      coordinateRoundingDecision: "rounded_to_integer",
      safetyDecision: "allow",
      safetyDecisionReason: "bounds_and_anchor_valid",
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
      safetyDecision: "block",
      safetyDecisionReason: "region_payload_incomplete",
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
      safetyDecision: "block",
      safetyDecisionReason: "region_proof_mismatch",
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
      safetyDecision: "block",
      safetyDecisionReason: "region_out_of_bounds",
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
      safetyDecision: "block",
      safetyDecisionReason: "anchor_outside_region",
      dataQualityFlags: ["anchor_outside_region"],
    };
  }

  return {
    ok: true,
    requestedAnchor,
    executableAnchor,
    bounds,
    region,
    coordinateRoundingDecision: "rounded_to_integer",
    safetyDecision: "allow",
    safetyDecisionReason: "bounds_and_anchor_valid",
  };
}