import type { z } from "zod";

import type { GeometryClockPort } from "./ports/geometry-clock-port.js";
import {
  GeometryGuardAbilityInputSchema,
  GeometryGuardAbilityResultSchema,
  GeometryGuardBoundingBoxSchema,
  GeometryGuardCheckDecisionSchema,
  GeometryGuardChildCapabilityIdSchema,
  GeometryGuardCoordinateSpaceSchema,
  GeometryGuardDecisionSchema,
  GeometryGuardExecutionSpaceSchema,
  GeometryGuardFailureReasonSchema,
  GeometryGuardPointSchema,
  GeometryGuardResultOutputSchema,
  GeometryGuardRoundingPolicySchema,
  GeometryGuardRuntimeProofSchema,
  GeometryGuardSafetyPolicySchema,
  GeometryGuardScaleMappingSchema,
  GeometryGuardSizeSchema,
  GeometryGuardStatusSchema,
} from "./schema.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID, GEOMETRY_GUARD_CHILD_CAPABILITY_IDS } from "./shared/geometry-types.js";

export { GEOMETRY_GUARD_ABILITY_GROUP_ID, GEOMETRY_GUARD_CHILD_CAPABILITY_IDS };

export type GeometryGuardChildCapabilityId = z.output<typeof GeometryGuardChildCapabilityIdSchema>;
export type GeometryGuardCoordinateSpace = z.output<typeof GeometryGuardCoordinateSpaceSchema>;
export type GeometryGuardExecutionSpace = z.output<typeof GeometryGuardExecutionSpaceSchema>;
export type GeometryGuardStatus = z.output<typeof GeometryGuardStatusSchema>;
export type GeometryGuardDecision = z.output<typeof GeometryGuardDecisionSchema>;
export type GeometryGuardCheckDecision = z.output<typeof GeometryGuardCheckDecisionSchema>;
export type GeometryGuardFailureReason = z.output<typeof GeometryGuardFailureReasonSchema>;
export type GeometryGuardRoundingPolicy = z.output<typeof GeometryGuardRoundingPolicySchema>;
export type GeometryGuardPoint = z.output<typeof GeometryGuardPointSchema>;
export type GeometryGuardBoundingBox = z.output<typeof GeometryGuardBoundingBoxSchema>;
export type GeometryGuardSize = z.output<typeof GeometryGuardSizeSchema>;
export type GeometryGuardScaleMapping = z.output<typeof GeometryGuardScaleMappingSchema>;
export type GeometryGuardSafetyPolicy = z.output<typeof GeometryGuardSafetyPolicySchema>;
export type GeometryGuardResultOutput = z.output<typeof GeometryGuardResultOutputSchema>;
export type GeometryGuardRuntimeProof = z.output<typeof GeometryGuardRuntimeProofSchema>;
export type GeometryGuardAbilityInput = z.input<typeof GeometryGuardAbilityInputSchema>;
export type ParsedGeometryGuardAbilityInput = z.output<typeof GeometryGuardAbilityInputSchema>;
export type GeometryGuardAbilityResult = z.output<typeof GeometryGuardAbilityResultSchema>;

export type GeometryGuardAbilityContext = {
  clock: GeometryClockPort;
};

export interface GeometryGuardChildCapability {
  readonly abilityGroupId: typeof GEOMETRY_GUARD_ABILITY_GROUP_ID;
  readonly childCapabilityId: GeometryGuardChildCapabilityId;

  execute(input: ParsedGeometryGuardAbilityInput, context: GeometryGuardAbilityContext): Promise<GeometryGuardAbilityResult>;
}

export interface GeometryGuardAbilityGroup {
  listChildCapabilityIds(): GeometryGuardChildCapabilityId[];
  execute(input: GeometryGuardAbilityInput): Promise<GeometryGuardAbilityResult>;
}