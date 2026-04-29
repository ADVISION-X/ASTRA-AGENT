import { PAGE_STATE_ABILITY_GROUP_ID } from "../../contract.js";
import { findPageMarker, findRuntimeSignal, findVisualTargets } from "../../shared/page-state-observation.js";
import type { DetectModalOverlayStateChildCapability } from "./contract.js";
import { DetectModalOverlayStateChildInputSchema, DetectModalOverlayStateChildOutputSchema } from "./schema.js";

export function createDetectModalOverlayStateCapability(): DetectModalOverlayStateChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-modal-overlay-state",
    async execute(input) {
      const request = DetectModalOverlayStateChildInputSchema.parse(input);
      const overlaySignals = findRuntimeSignal(request.observations, "modal_overlay_present").filter((observation) => observation.payload.value);
      const overlayAbsentSignals = findRuntimeSignal(request.observations, "modal_overlay_absent").filter((observation) => observation.payload.value);
      const overlayMarkers = findPageMarker(request.observations, "modal_overlay").filter((observation) => observation.payload.present);
      const overlayTargets = findVisualTargets(request.observations, "modal_overlay").filter((observation) => observation.payload.matched);
      const matchedObservationIds = [...overlaySignals, ...overlayAbsentSignals, ...overlayMarkers, ...overlayTargets].map((observation) => observation.observationId);
      const output = overlaySignals.length > 0 || overlayMarkers.length > 0 || overlayTargets.length > 0
        ? {
            childCapabilityId: "detect-modal-overlay-state" as const,
            pageStateType: "modal_overlay_present" as const,
            stateSummary: "Modal overlay evidence blocks the current page.",
            confidence: 0.93,
            reviewRequiredReason: "Modal overlay must be reviewed or dismissed before proceeding.",
            dataQualityFlags: [],
            matchedObservationIds,
            supportingEvidenceRefs: [...request.sourceEvidenceRefs],
            supportingReasons: ["modal overlay marker or target detected"],
          }
        : {
            childCapabilityId: "detect-modal-overlay-state" as const,
            pageStateType: "modal_overlay_absent" as const,
            stateSummary: "No governed modal overlay evidence is present.",
            confidence: overlayAbsentSignals.length > 0 ? 0.88 : 0.72,
            reviewRequiredReason: null,
            dataQualityFlags: overlayAbsentSignals.length > 0 ? [] : ["insufficient_signal"],
            matchedObservationIds,
            supportingEvidenceRefs: [...request.sourceEvidenceRefs],
            supportingReasons: ["no overlay markers detected"],
          };

      return DetectModalOverlayStateChildOutputSchema.parse(output);
    },
  };
}