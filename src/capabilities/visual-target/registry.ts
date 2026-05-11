import type {
  VisualTargetChildCapability,
  VisualTargetChildCapabilityId,
} from "./contract.js";
import { VISUAL_TARGET_CHILD_CAPABILITY_IDS } from "./contract.js";
import { createPackageBboxTargetOnceCapability } from "./children/package-bbox-target-once.js";
import { createPackageGridCellTargetOnceCapability } from "./children/package-grid-cell-target-once.js";
import { createPackageGridRegionTargetOnceCapability } from "./children/package-grid-region-target-once.js";

export function listVisualTargetChildren(): VisualTargetChildCapabilityId[] {
  return [...VISUAL_TARGET_CHILD_CAPABILITY_IDS];
}

export function createVisualTargetCapabilityRegistry(): Map<
  VisualTargetChildCapabilityId,
  VisualTargetChildCapability
> {
  return new Map<VisualTargetChildCapabilityId, VisualTargetChildCapability>([
    [
      "package-grid-cell-target-once",
      createPackageGridCellTargetOnceCapability(),
    ],
    [
      "package-grid-region-target-once",
      createPackageGridRegionTargetOnceCapability(),
    ],
    ["package-bbox-target-once", createPackageBboxTargetOnceCapability()],
  ]);
}
