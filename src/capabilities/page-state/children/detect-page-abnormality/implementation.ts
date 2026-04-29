import { PAGE_STATE_ABILITY_GROUP_ID } from "../../contract.js";
import { findPageMarker, findRuntimeSignal } from "../../shared/page-state-observation.js";
import type { DetectPageAbnormalityChildCapability } from "./contract.js";
import { DetectPageAbnormalityChildInputSchema, DetectPageAbnormalityChildOutputSchema } from "./schema.js";

export function createDetectPageAbnormalityCapability(): DetectPageAbnormalityChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-page-abnormality",
    async execute(input) {
      const request = DetectPageAbnormalityChildInputSchema.parse(input);
      const abnormalSignals = findRuntimeSignal(request.observations, "page_abnormal").filter((observation) => observation.payload.value);
      const normalSignals = findRuntimeSignal(request.observations, "page_normal").filter((observation) => observation.payload.value);
      const abnormalMarkers = findPageMarker(request.observations, "abnormal_page").filter((observation) => observation.payload.present);
      const matchedObservationIds = [...abnormalSignals, ...normalSignals, ...abnormalMarkers].map((observation) => observation.observationId);
      const output = request.snapshot.currentUrl === "about:blank" || abnormalSignals.length > 0 || abnormalMarkers.length > 0
        ? {
            childCapabilityId: "detect-page-abnormality" as const,
            pageStateType: "page_abnormal" as const,
            stateSummary: "Abnormal page markers indicate the current page is not stable for execution.",
            confidence: 0.95,
            reviewRequiredReason: "Review required because abnormal page markers are present.",
            dataQualityFlags: [],
            matchedObservationIds,
            supportingEvidenceRefs: [...request.sourceEvidenceRefs],
            supportingReasons: ["abnormal marker, abnormal runtime signal, or about:blank detected"],
          }
        : {
            childCapabilityId: "detect-page-abnormality" as const,
            pageStateType: "page_normal" as const,
            stateSummary: "No abnormal page markers were detected.",
            confidence: normalSignals.length > 0 ? 0.9 : 0.8,
            reviewRequiredReason: null,
            dataQualityFlags: [],
            matchedObservationIds,
            supportingEvidenceRefs: [...request.sourceEvidenceRefs],
            supportingReasons: ["no abnormal markers detected"],
          };

      return DetectPageAbnormalityChildOutputSchema.parse(output);
    },
  };
}