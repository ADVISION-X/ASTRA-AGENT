import type { GeometryGuardChildCapability } from "../../contract.js";
import { createGeometryGuardChildCapability } from "../../runtime/geometry-child-capability.js";

export function createMapRegionToSourceCapability(): GeometryGuardChildCapability {
  return createGeometryGuardChildCapability("map-region-to-source");
}