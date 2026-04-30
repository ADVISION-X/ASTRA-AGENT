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

type GeometryGuardChildCapabilityId = z.output<typeof GeometryGuardChildCapabilityIdSchema>;
type GeometryGuardCoordinateSpace = z.output<typeof GeometryGuardCoordinateSpaceSchema>;
type GeometryGuardExecutionSpace = z.output<typeof GeometryGuardExecutionSpaceSchema>;
type GeometryGuardStatus = z.output<typeof GeometryGuardStatusSchema>;
type GeometryGuardDecision = z.output<typeof GeometryGuardDecisionSchema>;
type GeometryGuardCheckDecision = z.output<typeof GeometryGuardCheckDecisionSchema>;
type GeometryGuardFailureReason = z.output<typeof GeometryGuardFailureReasonSchema>;
type GeometryGuardRoundingPolicy = z.output<typeof GeometryGuardRoundingPolicySchema>;
type GeometryGuardPoint = z.output<typeof GeometryGuardPointSchema>;
type GeometryGuardBoundingBox = z.output<typeof GeometryGuardBoundingBoxSchema>;
type GeometryGuardSize = z.output<typeof GeometryGuardSizeSchema>;
type GeometryGuardScaleMapping = z.output<typeof GeometryGuardScaleMappingSchema>;
type GeometryGuardSafetyPolicy = z.output<typeof GeometryGuardSafetyPolicySchema>;
type GeometryGuardResultOutput = z.output<typeof GeometryGuardResultOutputSchema>;
type GeometryGuardRuntimeProof = z.output<typeof GeometryGuardRuntimeProofSchema>;
type GeometryGuardAbilityInput = z.input<typeof GeometryGuardAbilityInputSchema>;
type ParsedGeometryGuardAbilityInput = z.output<typeof GeometryGuardAbilityInputSchema>;
type GeometryGuardAbilityResult = z.output<typeof GeometryGuardAbilityResultSchema>;

type GeometryGuardAbilityContext = {
  clock: GeometryClockPort;
};

interface GeometryGuardChildCapability {
  readonly abilityGroupId: typeof GEOMETRY_GUARD_ABILITY_GROUP_ID;
  readonly childCapabilityId: GeometryGuardChildCapabilityId;

  execute(input: ParsedGeometryGuardAbilityInput, context: GeometryGuardAbilityContext): Promise<GeometryGuardAbilityResult>;
}

interface GeometryGuardAbilityGroup {
  listChildCapabilityIds(): GeometryGuardChildCapabilityId[];
  execute(input: GeometryGuardAbilityInput): Promise<GeometryGuardAbilityResult>;
}

export { GEOMETRY_GUARD_ABILITY_GROUP_ID, GEOMETRY_GUARD_CHILD_CAPABILITY_IDS };
export type {
  GeometryGuardAbilityContext,
  GeometryGuardAbilityGroup,
  GeometryGuardAbilityInput,
  GeometryGuardAbilityResult,
  GeometryGuardBoundingBox,
  GeometryGuardCheckDecision,
  GeometryGuardChildCapability,
  GeometryGuardChildCapabilityId,
  GeometryGuardCoordinateSpace,
  GeometryGuardDecision,
  GeometryGuardExecutionSpace,
  GeometryGuardFailureReason,
  GeometryGuardPoint,
  GeometryGuardResultOutput,
  GeometryGuardRoundingPolicy,
  GeometryGuardRuntimeProof,
  GeometryGuardSafetyPolicy,
  GeometryGuardScaleMapping,
  GeometryGuardSize,
  GeometryGuardStatus,
  ParsedGeometryGuardAbilityInput,
};