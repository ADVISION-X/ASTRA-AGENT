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

type VisualTargetChildCapabilityId = z.output<typeof VisualTargetChildCapabilityIdSchema>;
type VisualTargetStatus = z.output<typeof VisualTargetStatusSchema>;
type VisualTargetType = z.output<typeof VisualTargetTypeSchema>;
type VisualTargetNature = z.output<typeof VisualTargetNatureSchema>;
type VisualBoundingBox = z.output<typeof VisualBoundingBoxSchema>;
type VisualClickPoint = z.output<typeof VisualClickPointSchema>;
type VisualTargetCoordinateSpace = z.output<typeof VisualTargetCoordinateSpaceSchema>;
type VisualTargetFailureReason = z.output<typeof VisualTargetFailureReasonSchema>;
type VisualTargetDataQualityFlag = z.output<typeof VisualTargetDataQualityFlagSchema>;
type VisualTargetScaleMapping = z.output<typeof VisualTargetScaleMappingSchema>;
type VisualTargetScreenshotSourceProof = z.output<typeof VisualTargetScreenshotSourceProofSchema>;
type VisualTargetAiSourceProof = z.output<typeof VisualTargetAiSourceProofSchema>;
type VisualTargetPageStateProof = z.output<typeof VisualTargetPageStateProofSchema>;
type VisualTargetSourceProof = z.output<typeof VisualTargetSourceProofSchema>;
type VisualTargetCandidate = z.output<typeof VisualTargetCandidateSchema>;
type VisualTargetRuntimeProof = z.output<typeof VisualTargetRuntimeProofSchema>;
type VisualTargetOutput = z.output<typeof VisualTargetOutputSchema>;
type VisualTargetActionOutput = z.output<typeof VisualTargetActionOutputSchema>;
type VisualTargetGeometryGuardHandoff = z.output<typeof VisualTargetGeometryGuardHandoffSchema>;
type VisualTargetAbilityInput = z.input<typeof VisualTargetAbilityInputSchema>;
type ParsedVisualTargetAbilityInput = z.output<typeof VisualTargetAbilityInputSchema>;
type VisualTarget = z.output<typeof VisualTargetResultSchema>;
type VisualTargetResult = VisualTarget;
type VisualTargetAbilityResult = z.output<typeof VisualTargetAbilityResultSchema>;
type SuccessfulVisualTarget = z.output<typeof VisualTargetActionSuccessResultSchema>;

export type { VisualTargetChildCapability } from "./runtime/visual-target-child-contract.js";

type VisualTargetPublicTypes = {
  abilityGroupId: typeof VISUAL_TARGET_ABILITY_GROUP_ID;
  childCapabilityId: VisualTargetChildCapabilityId;
  targetType: VisualTargetType;
  targetNature: VisualTargetNature;
  result: VisualTargetAbilityResult;
};

interface VisualTargetAbilityGroup {
  listChildCapabilityIds(): VisualTargetChildCapabilityId[];
  execute(input: VisualTargetAbilityInput): Promise<VisualTargetAbilityResult>;
}

export type { VisualTargetChildCapabilityId, VisualTargetStatus, VisualTargetType, VisualTargetNature, VisualBoundingBox, VisualClickPoint, VisualTargetCoordinateSpace, VisualTargetFailureReason, VisualTargetDataQualityFlag, VisualTargetScaleMapping, VisualTargetScreenshotSourceProof, VisualTargetAiSourceProof, VisualTargetPageStateProof, VisualTargetSourceProof, VisualTargetCandidate, VisualTargetRuntimeProof, VisualTargetOutput, VisualTargetActionOutput, VisualTargetGeometryGuardHandoff, VisualTargetAbilityInput, ParsedVisualTargetAbilityInput, VisualTarget, VisualTargetResult, VisualTargetAbilityResult, SuccessfulVisualTarget, VisualTargetPublicTypes, VisualTargetAbilityGroup };
