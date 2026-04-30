import type { MouseClickCoordinateSpace, ParsedMouseClickAbilityInput } from "../contract.js";

const MAX_ALLOWED_BOUND = 12_000;

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
  const requestedCoordinate = input.request.geometryGuardProof.normalizedClickPoint;
  const bounds = input.request.bounds;
  if (!requestedCoordinate) {
    return {
      ok: false,
      status: "failed",
      failureReason: "geometry_proof_missing_coordinate",
      statusMessage: "Mouse Click requires Geometry Guard normalizedClickPoint.",
      policyDecision: "block",
      safetyDecision: "block",
      safetyDecisionReason: "geometry_coordinate_missing",
      dataQualityFlags: ["geometry_coordinate_missing"],
    };
  }
  if (input.request.geometryGuardProof.normalizedCoordinateSpace !== input.expectedCoordinateSpace) {
    return {
      ok: false,
      status: "failed",
      failureReason: "unsupported_coordinate_space",
      statusMessage: "Geometry Guard coordinate space no longer matches this child capability.",
      policyDecision: "block",
      safetyDecision: "block",
      safetyDecisionReason: "coordinate_space_mismatch",
      dataQualityFlags: ["coordinate_space_mismatch"],
    };
  }
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
    return {
      ok: false,
      status: "failed",
      failureReason: "invalid_bounds",
      statusMessage: "Mouse Click bounds must be finite positive dimensions.",
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
      statusMessage: "Mouse Click bounds exceed the governed maximum size.",
      policyDecision: "block",
      safetyDecision: "block",
      safetyDecisionReason: "bounds_too_large",
      dataQualityFlags: ["bounds_too_large"],
    };
  }
  if (!Number.isFinite(requestedCoordinate.x) || !Number.isFinite(requestedCoordinate.y)) {
    return {
      ok: false,
      status: "failed",
      failureReason: "non_finite_coordinate",
      statusMessage: "Mouse Click requires finite coordinates.",
      policyDecision: "block",
      safetyDecision: "block",
      safetyDecisionReason: "non_finite_coordinate",
      dataQualityFlags: ["non_finite_coordinate"],
    };
  }

  const executableCoordinate = {
    x: Math.round(requestedCoordinate.x),
    y: Math.round(requestedCoordinate.y),
  };

  if (executableCoordinate.x < 0 || executableCoordinate.x >= bounds.width || executableCoordinate.y < 0 || executableCoordinate.y >= bounds.height) {
    return {
      ok: false,
      status: "failed",
      failureReason: "out_of_bounds",
      statusMessage: "Mouse Click executableCoordinate is outside the governed bounds window.",
      policyDecision: "block",
      safetyDecision: "block",
      safetyDecisionReason: "out_of_bounds",
      dataQualityFlags: ["out_of_bounds"],
    };
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