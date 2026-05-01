import type { MouseClickCoordinateSpace, ParsedMouseClickAbilityInput } from "../contract.js";

const MAX_ALLOWED_BOUND = 12_000;

function createSafetyFailure(input: {
  failureReason: "geometry_proof_missing_coordinate" | "invalid_bounds" | "bounds_too_large" | "unsupported_coordinate_space" | "non_finite_coordinate" | "out_of_bounds";
  statusMessage: string;
  safetyDecisionReason: string;
  dataQualityFlags: string[];
}) {
  return {
    ok: false as const,
    status: "failed" as const,
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
    policyDecision: "block" as const,
    safetyDecision: "block" as const,
    safetyDecisionReason: input.safetyDecisionReason,
    dataQualityFlags: input.dataQualityFlags,
  };
}

function validateRequestedCoordinate(request: ParsedMouseClickAbilityInput, expectedCoordinateSpace: MouseClickCoordinateSpace) {
  const requestedCoordinate = request.geometryGuardProof.normalizedClickPoint;
  if (!requestedCoordinate) {
    return createSafetyFailure({ failureReason: "geometry_proof_missing_coordinate", statusMessage: "Mouse Click requires Geometry Guard normalizedClickPoint.", safetyDecisionReason: "geometry_coordinate_missing", dataQualityFlags: ["geometry_coordinate_missing"] });
  }
  return request.geometryGuardProof.normalizedCoordinateSpace !== expectedCoordinateSpace
    ? createSafetyFailure({ failureReason: "unsupported_coordinate_space", statusMessage: "Geometry Guard coordinate space no longer matches this child capability.", safetyDecisionReason: "coordinate_space_mismatch", dataQualityFlags: ["coordinate_space_mismatch"] })
    : requestedCoordinate;
}

function validateBounds(bounds: { width: number; height: number }) {
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
    return createSafetyFailure({ failureReason: "invalid_bounds", statusMessage: "Mouse Click bounds must be finite positive dimensions.", safetyDecisionReason: "invalid_bounds", dataQualityFlags: ["invalid_bounds"] });
  }
  return bounds.width > MAX_ALLOWED_BOUND || bounds.height > MAX_ALLOWED_BOUND
    ? createSafetyFailure({ failureReason: "bounds_too_large", statusMessage: "Mouse Click bounds exceed the governed maximum size.", safetyDecisionReason: "bounds_too_large", dataQualityFlags: ["bounds_too_large"] })
    : null;
}

function validateExecutableCoordinate(requestedCoordinate: { x: number; y: number }, bounds: { width: number; height: number }) {
  if (!Number.isFinite(requestedCoordinate.x) || !Number.isFinite(requestedCoordinate.y)) {
    return createSafetyFailure({ failureReason: "non_finite_coordinate", statusMessage: "Mouse Click requires finite coordinates.", safetyDecisionReason: "non_finite_coordinate", dataQualityFlags: ["non_finite_coordinate"] });
  }
  const executableCoordinate = { x: Math.round(requestedCoordinate.x), y: Math.round(requestedCoordinate.y) };
  return executableCoordinate.x < 0 || executableCoordinate.x >= bounds.width || executableCoordinate.y < 0 || executableCoordinate.y >= bounds.height
    ? createSafetyFailure({ failureReason: "out_of_bounds", statusMessage: "Mouse Click executableCoordinate is outside the governed bounds window.", safetyDecisionReason: "out_of_bounds", dataQualityFlags: ["out_of_bounds"] })
    : executableCoordinate;
}

export function validatePreClickSafety(input: {
  request: ParsedMouseClickAbilityInput;
  expectedCoordinateSpace: MouseClickCoordinateSpace;
}):
  | {
      ok: true;
      requestedCoordinate: { x: number; y: number };
      executableCoordinate: { x: number; y: number };
      targetBounds: { width: number; height: number };
      sourceBounds: { width: number; height: number } | null;
      coordinateRoundingDecision: "rounded_to_integer";
      safetyDecision: "allow";
      safetyDecisionReason: "bounds_and_coordinate_valid";
    }
  | {
      ok: false;
      status: "failed";
      failureReason: "geometry_proof_missing_coordinate" | "invalid_bounds" | "bounds_too_large" | "unsupported_coordinate_space" | "non_finite_coordinate" | "out_of_bounds";
      statusMessage: string;
      policyDecision: "block";
      safetyDecision: "block";
      safetyDecisionReason: string;
      dataQualityFlags: string[];
    } {
  const requestedCoordinate = validateRequestedCoordinate(input.request, input.expectedCoordinateSpace);
  const bounds = input.request.bounds;
  if (!("x" in requestedCoordinate)) {
    return requestedCoordinate;
  }
  const boundsFailure = validateBounds(bounds);
  if (boundsFailure) {
    return boundsFailure;
  }
  const executableCoordinate = validateExecutableCoordinate(requestedCoordinate, bounds);
  if (!("x" in executableCoordinate)) {
    return executableCoordinate;
  }

  return {
    ok: true,
    requestedCoordinate,
    executableCoordinate,
    targetBounds: bounds,
    sourceBounds: input.request.geometryGuardProof.sourceBounds,
    coordinateRoundingDecision: "rounded_to_integer",
    safetyDecision: "allow",
    safetyDecisionReason: "bounds_and_coordinate_valid",
  };
}