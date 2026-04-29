import type { GeometryGuardChildCapability, GeometryGuardChildCapabilityId } from "../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "../contract.js";
import { executeGeometryGuardChild } from "./geometry-guard-executor.js";

export function createGeometryGuardChildCapability(childCapabilityId: GeometryGuardChildCapabilityId): GeometryGuardChildCapability {
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId,
    async execute(input, context) {
      return executeGeometryGuardChild({ request: input, context });
    },
  };
}