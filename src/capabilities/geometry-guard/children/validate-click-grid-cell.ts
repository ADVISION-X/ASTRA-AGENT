import type {
  GeometryGuardAbilityResult,
  GeometryGuardChildCapability,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "../contract.js";
import {
  bboxCenter,
  projectBboxToViewport,
  projectClickPointToViewport,
  roundBbox,
  roundPoint,
} from "../runtime/normalize.js";
import {
  validateBboxInsideViewport,
  validatePointInsideViewport,
  validateSizeProvided,
} from "../runtime/bounds.js";
import { buildGeometryGuardProof } from "../runtime/proof.js";
import { buildAllowResult, buildDenyResult } from "../runtime/result.js";

export function createValidateClickGridCellCapability(): GeometryGuardChildCapability {
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: "validate-click-grid-cell",

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
          statusMessage: `Geometry Guard denied validate-click-grid-cell: ${viewportCheck.reason}`,
        });
      }

      const viewportSize = input.viewportSize!;

      // Require bbox (pre-decoded from gridCell by orchestration)
      if (!input.bbox) {
        const endedAt = new Date().toISOString();
        const durationMs = Date.now() - startMs;
        const proof = buildGeometryGuardProof({
          input,
          guardDecision: "deny",
          normalizedClickPoint: null,
          normalizedBbox: null,
          failureReason: "bbox_required_for_click_grid_cell",
          reviewRequiredReason: null,
          startedAt,
          endedAt,
          durationMs,
        });
        return buildDenyResult({
          input,
          proof,
          failureReason: "bbox_required_for_click_grid_cell",
          statusMessage:
            "Geometry Guard denied validate-click-grid-cell: bbox is required.",
        });
      }

      // Normalize: project bbox from image space to viewport space
      const sourceBbox = input.bbox;
      let normalizedBbox = sourceBbox;
      let normalizedClickPoint = input.clickPoint
        ? input.clickPoint
        : bboxCenter(sourceBbox);

      if (input.imageSize && input.imageSize.width > 0 && input.imageSize.height > 0) {
        normalizedBbox = projectBboxToViewport({
          bbox: sourceBbox,
          imageSize: input.imageSize,
          viewportSize,
        });
        normalizedClickPoint = input.clickPoint
          ? projectClickPointToViewport({
              clickPoint: input.clickPoint,
              imageSize: input.imageSize,
              viewportSize,
            })
          : bboxCenter(normalizedBbox);
      }

      normalizedBbox = roundBbox(normalizedBbox);
      normalizedClickPoint = roundPoint(normalizedClickPoint);

      // Validate click point is inside viewport
      const pointCheck = validatePointInsideViewport(
        normalizedClickPoint,
        viewportSize,
        safetyPolicy,
      );
      if (!pointCheck.ok) {
        const endedAt = new Date().toISOString();
        const durationMs = Date.now() - startMs;
        const proof = buildGeometryGuardProof({
          input,
          guardDecision: "deny",
          normalizedClickPoint,
          normalizedBbox,
          failureReason: pointCheck.reason,
          reviewRequiredReason: null,
          startedAt,
          endedAt,
          durationMs,
        });
        return buildDenyResult({
          input,
          proof,
          failureReason: pointCheck.reason,
          statusMessage: `Geometry Guard denied validate-click-grid-cell: ${pointCheck.reason}`,
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
