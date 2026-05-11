import type { z } from "zod";

import {
  VISUAL_TARGET_ABILITY_GROUP_ID,
  VISUAL_TARGET_CHILD_CAPABILITY_IDS,
  VisualTargetAbilityInputSchema,
  VisualTargetAbilityResultSchema,
  VisualTargetBboxSchema,
  VisualTargetChildCapabilityIdSchema,
  VisualTargetGridCellSchema,
  VisualTargetGridRegionSchema,
  VisualTargetOutputSchema,
  VisualTargetPackageSchema,
  VisualTargetRuntimeProofSchema,
} from "./schema.js";

export {
  VISUAL_TARGET_ABILITY_GROUP_ID,
  VISUAL_TARGET_CHILD_CAPABILITY_IDS,
};

export type VisualTargetChildCapabilityId = z.output<
  typeof VisualTargetChildCapabilityIdSchema
>;
export type VisualTargetGridCell = z.output<typeof VisualTargetGridCellSchema>;
export type VisualTargetGridRegion = z.output<
  typeof VisualTargetGridRegionSchema
>;
export type VisualTargetBbox = z.output<typeof VisualTargetBboxSchema>;
export type VisualTargetPackage = z.output<typeof VisualTargetPackageSchema>;
export type VisualTargetOutput = z.output<typeof VisualTargetOutputSchema>;
export type VisualTargetRuntimeProof = z.output<
  typeof VisualTargetRuntimeProofSchema
>;
export type VisualTargetAbilityInput = z.input<
  typeof VisualTargetAbilityInputSchema
>;
export type ParsedVisualTargetAbilityInput = z.output<
  typeof VisualTargetAbilityInputSchema
>;
export type VisualTargetAbilityResult = z.output<
  typeof VisualTargetAbilityResultSchema
>;

export interface VisualTargetChildCapability {
  readonly abilityGroupId: typeof VISUAL_TARGET_ABILITY_GROUP_ID;
  readonly childCapabilityId: VisualTargetChildCapabilityId;
  execute(
    input: ParsedVisualTargetAbilityInput,
  ): Promise<VisualTargetAbilityResult>;
}

export interface VisualTargetAbilityGroup {
  listChildCapabilityIds(): VisualTargetChildCapabilityId[];
  execute(input: VisualTargetAbilityInput): Promise<VisualTargetAbilityResult>;
}
