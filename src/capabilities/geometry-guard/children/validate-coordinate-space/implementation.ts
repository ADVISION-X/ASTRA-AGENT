import type { GeometryGuardChildCapability } from "../../contract.js";
import { createGeometryGuardChildCapability } from "../../runtime/geometry-child-capability.js";

export function createValidateCoordinateSpaceCapability(): GeometryGuardChildCapability {
  return createGeometryGuardChildCapability("validate-coordinate-space");
}