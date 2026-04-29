import type { GeometryGuardChildCapability } from "../../contract.js";
import { createGeometryGuardChildCapability } from "../../runtime/geometry-child-capability.js";

export function createValidateBBoxIntegrityCapability(): GeometryGuardChildCapability {
  return createGeometryGuardChildCapability("validate-bbox-integrity");
}