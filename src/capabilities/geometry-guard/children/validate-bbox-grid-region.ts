import type {
  GeometryGuardAbilityResult,
  GeometryGuardChildCapability,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "../contract.js";
import {
  bboxCenter,
  projectBboxToViewport,
  roundBbox,
  roundPoint,
} from "../runtime/normalize.js";
import {
  validateBboxInsideViewport,
  validateSizeProvided,
} from "../runtime/bounds.js";
import { buildGeometryGuardProof } from "../runtime/proof.js";
import { buildAllowResult, buildDenyResult } from "../runtime/result.js";

export function createValidateBboxGridRegionCapability(): GeometryGuardChildCapability {
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: "validate-bbox-grid-region",

    async execute(
      input: ParsedGeometryGuardAbilityInput,
    ): Promise<GeometryGuardAbilityResult> {
      const startedAt = new Date().toISOString();
      const startMs = Date.now();

      const safetyPolicy = input.safetyPolicy;

      // Require viewportSize
      const viewportCheck = validateSizeProvided(input.viewportSize);
      if (!viewportCheck.ok) {
        const endedAt = new Date().toISOString();
        const durationMs = Date.now() - startMs;
        const proof = buildGeometryGuardProof({
          input,
          guardDecision: "deny",
          normalizedClickPoint: null,
          normalizedBbox: null,
          failureReason: viewportCheck.reason,
          reviewRequiredReason: null,
          startedAt,
          endedAt,
          durationMs,
        });
        return buildDenyResult({
          input,
          proof,
          failureReason: viewportCheck.reason,
          statusMessage: `Geometry Guard denied validate-bbox-grid-region: ${viewportCheck.reason}`,
        });
      }

      const viewportSize = input.viewportSize!;

      // Require bbox
      if (!input.bbox) {
        const endedAt = new Date().toISOString();
        const durationMs = Date.now() - startMs;
        const proof = buildGeometryGuardProof({
          input,
          guardDecision: "deny",
          normalizedClickPoint: null,
          normalizedBbox: null,
          failureReason: "bbox_required_for_bbox_grid_region",
          reviewRequiredReason: null,
          startedAt,
          endedAt,
          durationMs,
        });
        return buildDenyResult({
          input,
          proof,
          failureReason: "bbox_required_for_bbox_grid_region",
          statusMessage:
            "Geometry Guard denied validate-bbox-grid-region: bbox is required.",
        });
      }

      const sourceBbox = input.bbox;
      let normalizedBbox = sourceBbox;

      if (input.imageSize && input.imageSize.width > 0 && input.imageSize.height > 0) {
        normalizedBbox = projectBboxToViewport({
          bbox: sourceBbox,
          imageSize: input.imageSize,
          viewportSize,
        });
      }

      normalizedBbox = roundBbox(normalizedBbox);
      const normalizedClickPoint = roundPoint(
        input.clickPoint
          ? (() => {
              if (
                input.imageSize &&
                input.imageSize.width > 0 &&
                input.imageSize.height > 0
              ) {
                return {
                  x:
                    input.clickPoint.x *
                    (viewportSize.width / input.imageSize.width),
                  y:
                    input.clickPoint.y *
                    (viewportSize.height / input.imageSize.height),
                };
              }
              return input.clickPoint;
            })()
          : bboxCenter(normalizedBbox),
      );

      // Validate bbox is inside viewport
      const bboxCheck = validateBboxInsideViewport(
        normalizedBbox,
        viewportSize,
        safetyPolicy,
      );
      if (!bboxCheck.ok) {
        const endedAt = new Date().toISOString();
        const durationMs = Date.now() - startMs;
        const proof = buildGeometryGuardProof({
          input,
          guardDecision: "deny",
          normalizedClickPoint,
          normalizedBbox,
          failureReason: bboxCheck.reason,
          reviewRequiredReason: null,
          startedAt,
          endedAt,
          durationMs,
        });
        return buildDenyResult({
          input,
          proof,
          failureReason: bboxCheck.reason,
          statusMessage: `Geometry Guard denied validate-bbox-grid-region: ${bboxCheck.reason}`,
        });
      }

      const endedAt = new Date().toISOString();
      const durationMs = Date.now() - startMs;
      const proof = buildGeometryGuardProof({
        input,
        guardDecision: "allow",
        normalizedClickPoint,
        normalizedBbox,
        failureReason: null,
        reviewRequiredReason: null,
        startedAt,
        endedAt,
        durationMs,
      });

      return buildAllowResult({ input, proof, normalizedClickPoint, normalizedBbox });
    },
  };
}
