import type { MouseClickCoordinateSpace, ParsedMouseClickAbilityInput } from "../contract.js";

export function validatePreClickSafety(input: {
  request: ParsedMouseClickAbilityInput;
  expectedCoordinateSpace: MouseClickCoordinateSpace;
}):
  | {
      ok: true;
      requestedCoordinate: { x: number; y: number };
      executableCoordinate: { x: number; y: number };
      bounds: { width: number; height: number };
    }
  | {
      ok: false;
      status: "failed";
      failureReason: "geometry_proof_missing_coordinate" | "invalid_bounds" | "unsupported_coordinate_space" | "out_of_bounds";
      statusMessage: string;
      policyDecision: "block";
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
      dataQualityFlags: ["invalid_bounds"],
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
      dataQualityFlags: ["out_of_bounds"],
    };
  }

  return {
    ok: true,
    requestedCoordinate,
    executableCoordinate,
    bounds,
  };
}