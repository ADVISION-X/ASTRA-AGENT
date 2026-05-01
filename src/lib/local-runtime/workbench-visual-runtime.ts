import { createWorkbenchGeometryGuardAbilityGroup } from "./workbench-geometry-ability-group.js";
import { createWorkbenchVisualTargetAbilityGroup } from "./workbench-visual-target-ability-group.js";

export const createVisualRuntime = () => ({
  visualTargetAbilityGroup: createWorkbenchVisualTargetAbilityGroup(),
  geometryGuardAbilityGroup: createWorkbenchGeometryGuardAbilityGroup(),
});