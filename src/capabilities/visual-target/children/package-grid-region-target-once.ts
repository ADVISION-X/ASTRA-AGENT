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

export function createPackageGridRegionTargetOnceCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "package-grid-region-target-once",

    async execute(
      input: ParsedVisualTargetAbilityInput,
    ): Promise<VisualTargetAbilityResult> {
      const startedAt = new Date().toISOString();
      const startMs = Date.now();

      // Require gridRegion
      if (!input.gridRegion) {
        const endedAt = new Date().toISOString();
        const durationMs = Date.now() - startMs;
        const proof = buildVisualTargetProof({
          input,
          status: "failed",
          targetResultRef: null,
          candidateRef: null,
          failureReason: "grid_region_required",
          reviewRequiredReason: null,
          startedAt,
          endedAt,
          durationMs,
        });
        return buildVisualTargetFailedResult({
          input,
          proof,
          failureReason: "grid_region_required",
        });
      }

      const targetRef = generateTargetRef("package-grid-region-target-once");
      const candidateRef = generateCandidateRef();

      const targetPackage = buildTargetPackage({
        input,
        targetRef,
        gridCell: null,
        gridRegion: input.gridRegion,
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
