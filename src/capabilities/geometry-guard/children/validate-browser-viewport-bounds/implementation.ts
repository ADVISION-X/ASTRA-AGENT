import type { GeometryGuardChildCapability } from "../../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "../../contract.js";
import { buildGeometryGuardFailure, buildGeometryGuardReviewRequired, buildGeometryGuardSuccess } from "../../shared/guard-result.js";
import {
  asValidatedBoundingBox,
  asValidatedClickPoint,
  asValidatedScaleMapping,
  resolveFailure,
  validateBaseInput,
  validateBoundingBox,
  validateClickPoint,
  validateExecutionBounds,
  validateScaleMappingRequirement,
} from "../../shared/failure.js";
import { mapBoundingBoxToExecutionSpace, mapPointToExecutionSpace } from "../../shared/scale-mapping.js";

export function createValidateBrowserViewportBoundsCapability(): GeometryGuardChildCapability {
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: "validate-browser-viewport-bounds",
    async execute(input) {
      const startedAt = new Date().toISOString();
      const baseFailure = validateBaseInput(input);
      if (baseFailure) {
        return baseFailure.decision === "review_required"
          ? buildGeometryGuardReviewRequired({ callInput: input, startedAt, endedAt: new Date().toISOString(), ...resolveFailure(baseFailure) })
          : buildGeometryGuardFailure({ callInput: input, startedAt, endedAt: new Date().toISOString(), ...resolveFailure(baseFailure) });
      }

      if (input.requestedExecutionSpace !== "browserViewport") {
        return buildGeometryGuardFailure({
          callInput: input,
          startedAt,
          endedAt: new Date().toISOString(),
          failureReason: "execution_space_missing",
          statusMessage: "validate-browser-viewport-bounds requires browserViewport execution",
        });
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

      let normalizedBbox = bbox;
      let normalizedClickPoint = asValidatedClickPoint(input.clickPoint);
      let appliedScaleMapping = null;
      if (input.sourceCoordinateSpace !== "browserViewport") {
        const scaleFailure = validateScaleMappingRequirement(input);
        if (scaleFailure) {
          return scaleFailure.decision === "review_required"
            ? buildGeometryGuardReviewRequired({ callInput: input, startedAt, endedAt: new Date().toISOString(), ...resolveFailure(scaleFailure) })
            : buildGeometryGuardFailure({ callInput: input, startedAt, endedAt: new Date().toISOString(), ...resolveFailure(scaleFailure) });
        }

        appliedScaleMapping = asValidatedScaleMapping(input.scaleMapping);
        normalizedBbox = mapBoundingBoxToExecutionSpace(bbox, appliedScaleMapping);
        normalizedClickPoint = mapPointToExecutionSpace(normalizedClickPoint, appliedScaleMapping);
      }

      const boundsFailure = validateExecutionBounds({
        bbox: normalizedBbox,
        clickPoint: normalizedClickPoint,
        requestedExecutionSpace: "browserViewport",
        viewportSize: input.viewportSize,
        screenSize: input.screenSize,
      });
      if (boundsFailure) {
        return buildGeometryGuardFailure({ callInput: input, startedAt, endedAt: new Date().toISOString(), ...resolveFailure(boundsFailure) });
      }

      return buildGeometryGuardSuccess({
        callInput: input,
        startedAt,
        endedAt: new Date().toISOString(),
        normalizedCoordinateSpace: "browserViewport",
        normalizedClickPoint,
        normalizedBbox,
        appliedScaleMapping,
        statusMessage: "geometry guard approved browserViewport coordinates",
      });
    },
  };
}