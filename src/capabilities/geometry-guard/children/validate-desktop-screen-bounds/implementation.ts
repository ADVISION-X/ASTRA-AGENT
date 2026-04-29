import type { GeometryGuardChildCapability } from "../../contract.js";
import { createGeometryGuardChildCapability } from "../../runtime/geometry-child-capability.js";

export function createValidateDesktopScreenBoundsCapability(): GeometryGuardChildCapability {
  return createGeometryGuardChildCapability("validate-desktop-screen-bounds");
}