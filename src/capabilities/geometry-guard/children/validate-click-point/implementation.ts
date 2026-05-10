import type { GeometryGuardChildCapability } from "../../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "../../contract.js";
import { executeGeometryGuardChild } from "../../runtime/geometry-guard-executor.js";

export function createValidateClickPointCapability(): GeometryGuardChildCapability {
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: "validate-click-point",
    async execute(input, context) {
      return executeGeometryGuardChild({ request: input, context });
    },
  };
}