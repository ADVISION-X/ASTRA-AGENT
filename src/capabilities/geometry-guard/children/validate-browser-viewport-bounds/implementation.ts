import type { GeometryGuardChildCapability } from "../../contract.js";
import { createGeometryGuardChildCapability } from "../../runtime/geometry-child-capability.js";

export function createValidateBrowserViewportBoundsCapability(): GeometryGuardChildCapability {
  return createGeometryGuardChildCapability("validate-browser-viewport-bounds");
}