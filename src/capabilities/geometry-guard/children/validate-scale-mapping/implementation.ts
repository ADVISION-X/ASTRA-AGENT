import type { GeometryGuardChildCapability } from "../../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "../../contract.js";
import { buildGeometryGuardFailure, buildGeometryGuardReviewRequired, buildGeometryGuardSuccess } from "../../shared/guard-result.js";
import { asValidatedBoundingBox, asValidatedClickPoint, resolveFailure, validateBaseInput, validateBoundingBox, validateClickPoint, validateScaleMappingRequirement } from "../../shared/failure.js";

export function createValidateScaleMappingCapability(): GeometryGuardChildCapability {
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: "validate-scale-mapping",
    async execute(input) {
      const startedAt = new Date().toISOString();
      const baseFailure = validateBaseInput(input);
      if (baseFailure) {
        return baseFailure.decision === "review_required"
          ? buildGeometryGuardReviewRequired({ callInput: input, startedAt, endedAt: new Date().toISOString(), ...resolveFailure(baseFailure) })
          : buildGeometryGuardFailure({ callInput: input, startedAt, endedAt: new Date().toISOString(), ...resolveFailure(baseFailure) });
      }

      const bboxFailure = validateBoundingBox(input);
      if (bboxFailure) {
        return buildGeometryGuardFailure({ callInput: input, startedAt, endedAt: new Date().toISOString(), ...resolveFailure(bboxFailure) });
      }

      const bbox = asValidatedBoundingBox(input.bbox);
      const clickPointFailure = validateClickPoint(input, bbox);
      if (clickPointFailure) {
        return buildGeometryGuardFailure({ callInput: input, startedAt, endedAt: new Date().toISOString(), ...resolveFailure(clickPointFailure) });
      }

      const scaleFailure = validateScaleMappingRequirement(input);
      if (scaleFailure) {
        return scaleFailure.decision === "review_required"
          ? buildGeometryGuardReviewRequired({ callInput: input, startedAt, endedAt: new Date().toISOString(), ...resolveFailure(scaleFailure) })
          : buildGeometryGuardFailure({ callInput: input, startedAt, endedAt: new Date().toISOString(), ...resolveFailure(scaleFailure) });
      }

      return buildGeometryGuardSuccess({
        callInput: input,
        startedAt,
        endedAt: new Date().toISOString(),
        normalizedCoordinateSpace: input.requestedExecutionSpace,
        normalizedClickPoint: asValidatedClickPoint(input.clickPoint),
        normalizedBbox: bbox,
        appliedScaleMapping: input.scaleMapping,
        statusMessage: "geometry guard validated scaleMapping integrity",
      });
    },
  };
}