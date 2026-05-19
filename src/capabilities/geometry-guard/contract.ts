import {
  GEOMETRY_GUARD_ABILITY_GROUP_ID,
} from "./schema-constants.js";
import type { GeometryGuardChildCapabilityId } from "./geometry-types.js";
import type {
  GeometryGuardAbilityInput,
  GeometryGuardAbilityResult,
  ParsedGeometryGuardAbilityInput,
} from "./geometry-io-types.js";

export type {
  GeometryGuardAbilityInput,
  GeometryGuardAbilityResult,
  GeometryGuardChildCapabilityId,
  ParsedGeometryGuardAbilityInput,
};

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
