import type { GeometryGuardChildCapability, GeometryGuardChildCapabilityId } from "./contract.js";
import { createMapAiInputToViewportCapability } from "./children/map-ai-input-to-viewport/implementation.js";
import { createMapRegionToSourceCapability } from "./children/map-region-to-source/implementation.js";
import { createValidateBBoxIntegrityCapability } from "./children/validate-bbox-integrity/implementation.js";
import { createValidateBrowserViewportBoundsCapability } from "./children/validate-browser-viewport-bounds/implementation.js";
import { createValidateClickPointCapability } from "./children/validate-click-point/implementation.js";
import { createValidateCoordinateSpaceCapability } from "./children/validate-coordinate-space/implementation.js";
import { createValidateDesktopScreenBoundsCapability } from "./children/validate-desktop-screen-bounds/implementation.js";
import { createValidateScaleMappingCapability } from "./children/validate-scale-mapping/implementation.js";

export function createGeometryGuardCapabilityRegistry(): Map<GeometryGuardChildCapabilityId, GeometryGuardChildCapability> {
  return new Map<GeometryGuardChildCapabilityId, GeometryGuardChildCapability>([
    ["validate-coordinate-space", createValidateCoordinateSpaceCapability()],
    ["validate-bbox-integrity", createValidateBBoxIntegrityCapability()],
    ["validate-click-point", createValidateClickPointCapability()],
    ["validate-scale-mapping", createValidateScaleMappingCapability()],
    ["map-ai-input-to-viewport", createMapAiInputToViewportCapability()],
    ["map-region-to-source", createMapRegionToSourceCapability()],
    ["validate-browser-viewport-bounds", createValidateBrowserViewportBoundsCapability()],
    ["validate-desktop-screen-bounds", createValidateDesktopScreenBoundsCapability()],
  ]);
}