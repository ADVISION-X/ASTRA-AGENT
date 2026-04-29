import type { z } from "zod";

import type { VisualTargetClockPort } from "./ports/visual-target-clock-port.js";
import type { VisualTargetProfilePort } from "./ports/visual-target-profile-port.js";
import {
  VisualBoundingBoxSchema,
  VisualClickPointSchema,
  VisualTargetAbilityInputSchema,
  VisualTargetAbilityResultSchema,
  VisualTargetActionSuccessResultSchema,
  VisualTargetAiSourceProofSchema,
  VisualTargetCandidateSchema,
  VisualTargetChildCapabilityIdSchema,
  VisualTargetCoordinateSpaceSchema,
  VisualTargetDataQualityFlagSchema,
  VisualTargetFailureReasonSchema,
  VisualTargetNatureSchema,
  VisualTargetPageStateProofSchema,
  VisualTargetResultSchema,
  VisualTargetScaleMappingSchema,
  VisualTargetScreenshotSourceProofSchema,
  VisualTargetSourceProofSchema,
  VisualTargetStatusSchema,
  VisualTargetTypeSchema,
  VisualTargetRuntimeProofSchema,
} from "./schema.js";
import { VISUAL_TARGET_ABILITY_GROUP_ID } from "./shared/visual-target-types.js";

export { VISUAL_TARGET_ABILITY_GROUP_ID };
export const VisualTargetSchema = VisualTargetResultSchema;

export type VisualTargetChildCapabilityId = z.output<typeof VisualTargetChildCapabilityIdSchema>;
export type VisualTargetStatus = z.output<typeof VisualTargetStatusSchema>;
export type VisualTargetType = z.output<typeof VisualTargetTypeSchema>;
export type VisualTargetNature = z.output<typeof VisualTargetNatureSchema>;
export type VisualBoundingBox = z.output<typeof VisualBoundingBoxSchema>;
export type VisualClickPoint = z.output<typeof VisualClickPointSchema>;
export type VisualTargetCoordinateSpace = z.output<typeof VisualTargetCoordinateSpaceSchema>;
export type VisualTargetFailureReason = z.output<typeof VisualTargetFailureReasonSchema>;
export type VisualTargetDataQualityFlag = z.output<typeof VisualTargetDataQualityFlagSchema>;
export type VisualTargetScaleMapping = z.output<typeof VisualTargetScaleMappingSchema>;
export type VisualTargetScreenshotSourceProof = z.output<typeof VisualTargetScreenshotSourceProofSchema>;
export type VisualTargetAiSourceProof = z.output<typeof VisualTargetAiSourceProofSchema>;
export type VisualTargetPageStateProof = z.output<typeof VisualTargetPageStateProofSchema>;
export type VisualTargetSourceProof = z.output<typeof VisualTargetSourceProofSchema>;
export type VisualTargetCandidate = z.output<typeof VisualTargetCandidateSchema>;
export type VisualTargetRuntimeProof = z.output<typeof VisualTargetRuntimeProofSchema>;
export type VisualTargetAbilityInput = z.input<typeof VisualTargetAbilityInputSchema>;
export type ParsedVisualTargetAbilityInput = z.output<typeof VisualTargetAbilityInputSchema>;
export type VisualTarget = z.output<typeof VisualTargetResultSchema>;
export type VisualTargetResult = VisualTarget;
export type VisualTargetAbilityResult = z.output<typeof VisualTargetAbilityResultSchema>;
export type SuccessfulVisualTarget = z.output<typeof VisualTargetActionSuccessResultSchema>;

export type VisualTargetAbilityContext = {
  clock: VisualTargetClockPort;
  profilePort: VisualTargetProfilePort | null;
};

export interface VisualTargetChildCapability {
  readonly abilityGroupId: typeof VISUAL_TARGET_ABILITY_GROUP_ID;
  readonly childCapabilityId: VisualTargetChildCapabilityId;

  execute(input: ParsedVisualTargetAbilityInput, context: VisualTargetAbilityContext): Promise<VisualTargetAbilityResult>;
}

export interface VisualTargetAbilityGroup {
  listChildCapabilityIds(): VisualTargetChildCapabilityId[];
  execute(input: VisualTargetAbilityInput): Promise<VisualTargetAbilityResult>;
}