import type { GeometryGuardChildCapability } from "../../contract.js";
import { createGeometryGuardChildCapability } from "../../runtime/geometry-child-capability.js";

export function createMapAiInputToViewportCapability(): GeometryGuardChildCapability {
  return createGeometryGuardChildCapability("map-ai-input-to-viewport");
}