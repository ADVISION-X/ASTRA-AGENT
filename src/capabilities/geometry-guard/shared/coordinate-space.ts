import type { GeometryGuardCoordinateSpace, GeometryGuardExecutionSpace } from "../contract.js";

export function isExecutionSpace(space: GeometryGuardCoordinateSpace): space is GeometryGuardExecutionSpace {
  return space === "browserViewport" || space === "desktopScreen";
}

export function requiresScaleMapping(space: GeometryGuardCoordinateSpace): boolean {
  return space === "imageEvidence" || space === "aiInput" || space === "regionCrop";
}

export function isContactSheetSpace(space: GeometryGuardCoordinateSpace): boolean {
  return space === "contactSheet";
}