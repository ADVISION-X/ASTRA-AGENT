import type { z } from "zod";

import {
  VisualBoundingBoxSchema,
  VisualClickPointSchema,
  VisualTargetAbilityInputSchema,
  VisualTargetAbilityResultSchema,
  VisualTargetActionSuccessResultSchema,
  VisualTargetActionOutputSchema,
  VisualTargetAiSourceProofSchema,
  VisualTargetCandidateSchema,
  VisualTargetChildCapabilityIdSchema,
  VisualTargetCoordinateSpaceSchema,
  VisualTargetDataQualityFlagSchema,
  VisualTargetFailureReasonSchema,
  VisualTargetGeometryGuardHandoffSchema,
  VisualTargetOutputSchema,
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
export type VisualTargetOutput = z.output<typeof VisualTargetOutputSchema>;
export type VisualTargetActionOutput = z.output<typeof VisualTargetActionOutputSchema>;
export type VisualTargetGeometryGuardHandoff = z.output<typeof VisualTargetGeometryGuardHandoffSchema>;
export type VisualTargetAbilityInput = z.input<typeof VisualTargetAbilityInputSchema>;
export type ParsedVisualTargetAbilityInput = z.output<typeof VisualTargetAbilityInputSchema>;
export type VisualTarget = z.output<typeof VisualTargetResultSchema>;
export type VisualTargetResult = VisualTarget;
export type VisualTargetAbilityResult = z.output<typeof VisualTargetAbilityResultSchema>;
export type SuccessfulVisualTarget = z.output<typeof VisualTargetActionSuccessResultSchema>;

export type { VisualTargetChildCapability } from "./runtime/visual-target-child-contract.js";

export type VisualTargetPublicTypes = {
  abilityGroupId: typeof VISUAL_TARGET_ABILITY_GROUP_ID;
  childCapabilityId: VisualTargetChildCapabilityId;
  targetType: VisualTargetType;
  targetNature: VisualTargetNature;
  result: VisualTargetAbilityResult;
};

export interface VisualTargetAbilityGroup {
  listChildCapabilityIds(): VisualTargetChildCapabilityId[];
  execute(input: VisualTargetAbilityInput): Promise<VisualTargetAbilityResult>;
}