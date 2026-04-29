import { PAGE_STATE_ABILITY_GROUP_ID } from "../../contract.js";
import { findPageMarker, findRuntimeSignal, findVisualTargets } from "../../shared/page-state-observation.js";
import type { DetectCommentPanelStateChildCapability } from "./contract.js";
import { DetectCommentPanelStateChildInputSchema, DetectCommentPanelStateChildOutputSchema } from "./schema.js";

export function createDetectCommentPanelStateCapability(): DetectCommentPanelStateChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-comment-panel-state",
    async execute(input) {
      const request = DetectCommentPanelStateChildInputSchema.parse(input);
      const openSignals = findRuntimeSignal(request.observations, "comments_panel_open").filter((observation) => observation.payload.value);
      const closedSignals = findRuntimeSignal(request.observations, "comments_panel_closed").filter((observation) => observation.payload.value);
      const commentMarkers = findPageMarker(request.observations, "comment_panel").filter((observation) => observation.payload.present);
      const commentTargets = findVisualTargets(request.observations, "comment_panel").filter((observation) => observation.payload.matched);
      const matchedObservationIds = [...openSignals, ...closedSignals, ...commentMarkers, ...commentTargets].map((observation) => observation.observationId);
      const output = openSignals.length > 0 || commentMarkers.length > 0 || commentTargets.length > 0
        ? {
            childCapabilityId: "detect-comment-panel-state" as const,
            pageStateType: "comments_panel_open" as const,
            stateSummary: "Comment panel evidence confirms an open panel.",
            confidence: 0.9,
            reviewRequiredReason: null,
            dataQualityFlags: [],
            matchedObservationIds,
            supportingEvidenceRefs: [...request.sourceEvidenceRefs],
            supportingReasons: ["comment panel marker or target detected"],
          }
        : {
            childCapabilityId: "detect-comment-panel-state" as const,
            pageStateType: "comments_panel_closed" as const,
            stateSummary: "No governed comment panel evidence indicates an open panel.",
            confidence: closedSignals.length > 0 ? 0.86 : 0.7,
            reviewRequiredReason: null,
            dataQualityFlags: closedSignals.length > 0 ? [] : ["insufficient_signal"],
            matchedObservationIds,
            supportingEvidenceRefs: [...request.sourceEvidenceRefs],
            supportingReasons: ["no open comment panel evidence was found"],
          };

      return DetectCommentPanelStateChildOutputSchema.parse(output);
    },
  };
}