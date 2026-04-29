import { PAGE_STATE_ABILITY_GROUP_ID } from "../../contract.js";
import { findPageMarker, findRuntimeSignal } from "../../shared/page-state-observation.js";
import type { DetectVideoStableChildCapability } from "./contract.js";
import { DetectVideoStableChildInputSchema, DetectVideoStableChildOutputSchema } from "./schema.js";

export function createDetectVideoStableCapability(): DetectVideoStableChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-video-stable",
    async execute(input) {
      const request = DetectVideoStableChildInputSchema.parse(input);
      const stableSignals = findRuntimeSignal(request.observations, "video_stable").filter((observation) => observation.payload.value);
      const unstableSignals = findRuntimeSignal(request.observations, "video_unstable").filter((observation) => observation.payload.value);
      const playerMarkers = findPageMarker(request.observations, "video_player").filter((observation) => observation.payload.present);
      const matchedObservationIds = [...stableSignals, ...unstableSignals, ...playerMarkers].map((observation) => observation.observationId);
      const output = stableSignals.length > 0 && playerMarkers.length > 0 && unstableSignals.length === 0
        ? {
            childCapabilityId: "detect-video-stable" as const,
            pageStateType: "video_stable" as const,
            stateSummary: "Stable video signals and player markers agree on a settled video surface.",
            confidence: 0.9,
            reviewRequiredReason: null,
            dataQualityFlags: [],
            matchedObservationIds,
            supportingEvidenceRefs: [...request.sourceEvidenceRefs],
            supportingReasons: ["runtime video_stable signal and player marker present"],
          }
        : {
            childCapabilityId: "detect-video-stable" as const,
            pageStateType: "video_unstable" as const,
            stateSummary: "Video stability cannot be proven from the current observations.",
            confidence: stableSignals.length > 0 ? 0.58 : 0.45,
            reviewRequiredReason: "Review required because the video surface may still be changing.",
            dataQualityFlags: ["insufficient_signal"],
            matchedObservationIds,
            supportingEvidenceRefs: [...request.sourceEvidenceRefs],
            supportingReasons: ["video stability requires player markers and a stable runtime signal"],
          };

      return DetectVideoStableChildOutputSchema.parse(output);
    },
  };
}