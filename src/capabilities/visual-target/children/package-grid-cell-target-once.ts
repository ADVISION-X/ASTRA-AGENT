import type {
  ParsedVisualTargetAbilityInput,
  VisualTargetAbilityResult,
  VisualTargetChildCapability,
} from "../contract.js";
import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../contract.js";
import {
  buildTargetPackage,
  generateCandidateRef,
  generateTargetRef,
} from "../runtime/package-target.js";
import {
  buildVisualTargetFailedResult,
  buildVisualTargetProof,
  buildVisualTargetSuccessResult,
} from "../runtime/result.js";

export function createPackageGridCellTargetOnceCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "package-grid-cell-target-once",

    async execute(
      input: ParsedVisualTargetAbilityInput,
    ): Promise<VisualTargetAbilityResult> {
      const startedAt = new Date().toISOString();
      const startMs = Date.now();

      // Require gridCell
      if (!input.gridCell) {
        const endedAt = new Date().toISOString();
        const durationMs = Date.now() - startMs;
        const proof = buildVisualTargetProof({
          input,
          status: "failed",
          targetResultRef: null,
          candidateRef: null,
          failureReason: "grid_cell_required",
          reviewRequiredReason: null,
          startedAt,
          endedAt,
          durationMs,
        });
        return buildVisualTargetFailedResult({
          input,
          proof,
          failureReason: "grid_cell_required",
        });
      }

      const targetRef = generateTargetRef("package-grid-cell-target-once");
      const candidateRef = generateCandidateRef();

      const targetPackage = buildTargetPackage({
        input,
        targetRef,
        gridCell: input.gridCell,
        gridRegion: null,
        bbox: null,
      });

      const endedAt = new Date().toISOString();
      const durationMs = Date.now() - startMs;

      const proof = buildVisualTargetProof({
        input,
        status: "success",
        targetResultRef: targetRef,
        candidateRef,
        failureReason: null,
        reviewRequiredReason: null,
        startedAt,
        endedAt,
        durationMs,
      });

      return buildVisualTargetSuccessResult({
        input,
        proof,
        targetResultRef: targetRef,
        candidateRef,
        targetPackage,
      });
    },
  };
}
