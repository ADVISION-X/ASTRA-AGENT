import type { MouseClickCoordinateSpace, ParsedMouseClickAbilityInput } from "../contract.js";

export function validateMouseClickBoundary(input: {
  request: ParsedMouseClickAbilityInput;
  expectedCoordinateSpace: MouseClickCoordinateSpace;
}):
  | { ok: true; boundaryDecision: "allow"; boundaryReason: "child_route_confirmed" }
  | {
      ok: false;
      failureReason: "boundary_route_mismatch";
      statusMessage: string;
      policyDecision: "block";
      boundaryDecision: "block";
      boundaryReason: "child_route_mismatch" | "coordinate_space_mismatch";
      dataQualityFlags: string[];
    } {
  const expectedChildCapabilityId = input.expectedCoordinateSpace === "desktopScreen"
    ? "click-desktop-coordinate"
    : "click-browser-coordinate";

  if (input.request.childCapabilityId !== expectedChildCapabilityId) {
    return {
      ok: false,
      failureReason: "boundary_route_mismatch",
      statusMessage: "Mouse Click child route does not match the expected execution boundary.",
      policyDecision: "block",
      boundaryDecision: "block",
      boundaryReason: "child_route_mismatch",
      dataQualityFlags: ["boundary_child_route_mismatch"],
    };
  }

  if (input.request.geometryGuardProof.normalizedCoordinateSpace !== input.expectedCoordinateSpace) {
    return {
      ok: false,
      failureReason: "boundary_route_mismatch",
      statusMessage: "Mouse Click execution boundary rejected a coordinate-space mismatch.",
      policyDecision: "block",
      boundaryDecision: "block",
      boundaryReason: "coordinate_space_mismatch",
      dataQualityFlags: ["boundary_coordinate_space_mismatch"],
    };
  }

  return { ok: true, boundaryDecision: "allow", boundaryReason: "child_route_confirmed" };
}