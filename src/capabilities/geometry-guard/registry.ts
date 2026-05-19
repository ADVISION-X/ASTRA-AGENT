import type {
  GeometryGuardChildCapability,
  GeometryGuardChildCapabilityId,
} from "./contract.js";
import { createValidateClickGridCellCapability } from "./children/validate-click-grid-cell.js";
import { createValidateBboxGridRegionCapability } from "./children/validate-bbox-grid-region.js";
import { GEOMETRY_GUARD_CHILD_CAPABILITY_IDS } from "./schema-constants.js";

function listGeometryGuardChildren(): GeometryGuardChildCapabilityId[] {
  return [...GEOMETRY_GUARD_CHILD_CAPABILITY_IDS];
}

export function createGeometryGuardCapabilityRegistry(): Map<
  GeometryGuardChildCapabilityId,
  GeometryGuardChildCapability
> {
  return new Map<GeometryGuardChildCapabilityId, GeometryGuardChildCapability>([
    ["validate-click-grid-cell", createValidateClickGridCellCapability()],
    ["validate-bbox-grid-region", createValidateBboxGridRegionCapability()],
  ]);
}
