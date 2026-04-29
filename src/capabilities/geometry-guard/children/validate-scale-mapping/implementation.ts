import type { GeometryGuardChildCapability } from "../../contract.js";
import { createGeometryGuardChildCapability } from "../../runtime/geometry-child-capability.js";

export function createValidateScaleMappingCapability(): GeometryGuardChildCapability {
  return createGeometryGuardChildCapability("validate-scale-mapping");
}