import type { z } from "zod";

import {
  GEOMETRY_GUARD_ABILITY_GROUP_ID,
  GEOMETRY_GUARD_CHILD_CAPABILITY_IDS,
  GeometryGuardAbilityInputSchema,
  GeometryGuardAbilityResultSchema,
  GeometryGuardBoundingBoxSchema,
  GeometryGuardChildCapabilityIdSchema,
  GeometryGuardOutputSchema,
  GeometryGuardPointSchema,
  GeometryGuardRuntimeProofSchema,
  GeometryGuardSafetyPolicySchema,
  GeometryGuardSizeSchema,
} from "./schema.js";

export { GEOMETRY_GUARD_ABILITY_GROUP_ID, GEOMETRY_GUARD_CHILD_CAPABILITY_IDS };

export type GeometryGuardChildCapabilityId = z.output<
  typeof GeometryGuardChildCapabilityIdSchema
>;
export type GeometryGuardPoint = z.output<typeof GeometryGuardPointSchema>;
export type GeometryGuardBoundingBox = z.output<
  typeof GeometryGuardBoundingBoxSchema
>;
export type GeometryGuardSize = z.output<typeof GeometryGuardSizeSchema>;
export type GeometryGuardSafetyPolicy = z.output<
  typeof GeometryGuardSafetyPolicySchema
>;
export type GeometryGuardOutput = z.output<typeof GeometryGuardOutputSchema>;
export type GeometryGuardRuntimeProof = z.output<
  typeof GeometryGuardRuntimeProofSchema
>;
export type GeometryGuardAbilityInput = z.input<
  typeof GeometryGuardAbilityInputSchema
>;
export type ParsedGeometryGuardAbilityInput = z.output<
  typeof GeometryGuardAbilityInputSchema
>;
export type GeometryGuardAbilityResult = z.output<
  typeof GeometryGuardAbilityResultSchema
>;

export interface GeometryGuardChildCapability {
  readonly abilityGroupId: typeof GEOMETRY_GUARD_ABILITY_GROUP_ID;
  readonly childCapabilityId: GeometryGuardChildCapabilityId;
  execute(
    input: ParsedGeometryGuardAbilityInput,
  ): Promise<GeometryGuardAbilityResult>;
}

export interface GeometryGuardAbilityGroup {
  listChildCapabilityIds(): GeometryGuardChildCapabilityId[];
  execute(input: GeometryGuardAbilityInput): Promise<GeometryGuardAbilityResult>;
}
