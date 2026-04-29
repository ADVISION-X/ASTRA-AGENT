import type { GeometryGuardChildCapability } from "../../contract.js";
import { createGeometryGuardChildCapability } from "../../runtime/geometry-child-capability.js";

export function createValidateClickPointCapability(): GeometryGuardChildCapability {
  return createGeometryGuardChildCapability("validate-click-point");
}