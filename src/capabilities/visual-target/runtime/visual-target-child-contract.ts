import type { ParsedVisualTargetAbilityInput, VisualBoundingBox, VisualClickPoint, VisualTargetAbilityResult, VisualTargetCandidate, VisualTargetChildCapabilityId, VisualTargetCoordinateSpace, VisualTargetScaleMapping } from "../contract.js";
import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../shared/visual-target-types.js";
import type { VisualTargetRuntimeContext } from "./visual-target-runtime-context.js";

type ExecutableVisualTargetCoordinateSpace = Exclude<VisualTargetCoordinateSpace, "ai_input" | "contact_sheet">;

export type VisualTargetResolvedCandidate = VisualTargetCandidate & {
  originalCoordinateSpace: VisualTargetCoordinateSpace;
  executableCoordinateSpace: ExecutableVisualTargetCoordinateSpace;
  executableBoundingBox: VisualBoundingBox;
  executableClickPoint: VisualClickPoint | null;
  geometryScaleMapping: VisualTargetScaleMapping | null;
};

export interface VisualTargetChildCapability {
  readonly abilityGroupId: typeof VISUAL_TARGET_ABILITY_GROUP_ID;
  readonly childCapabilityId: VisualTargetChildCapabilityId;
  execute(input: ParsedVisualTargetAbilityInput, context: VisualTargetRuntimeContext): Promise<VisualTargetAbilityResult>;
}