import { createGeometryGuardAbilityGroup } from "../../capabilities/geometry-guard/ability-group.js";
import { createVisualTargetAbilityGroupWithSystemClock } from "../../capabilities/visual-target/runtime/visual-target-ability-group-factory.js";

export const createVisualRuntime = () => ({
  visualTargetAbilityGroup: createVisualTargetAbilityGroupWithSystemClock(),
  geometryGuardAbilityGroup: createGeometryGuardAbilityGroup(),
});