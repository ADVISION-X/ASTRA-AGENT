import { createVisualTargetAbilityGroup } from "../ability-group.js";
import { createSystemVisualTargetClock } from "./visual-target-clock.js";
import { createVisualTargetRuntimeContext } from "./visual-target-runtime-context.js";

export function createVisualTargetAbilityGroupWithSystemClock() {
  return createVisualTargetAbilityGroup({
    runtimeContext: createVisualTargetRuntimeContext({
      clock: createSystemVisualTargetClock(),
    }),
  });
}