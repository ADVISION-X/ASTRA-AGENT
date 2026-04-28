import {
  PAGE_STATE_ABILITY_GROUP_ID,
  type PageStateChildCapability,
} from "../../contract.js";
import { getObservationByKind, readBooleanPayload, readStringPayload } from "../../shared/observation-utils.js";
import { buildPageStateFailure, buildPageStateResult } from "../../shared/page-state-result.js";
import { validatePageStateInput } from "../../shared/state-policy.js";

export function createDetectCommentPanelStateCapability(): PageStateChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-comment-panel-state",
    async execute(input) {
      const startedAt = new Date().toISOString();
      const failureReason = validatePageStateInput(input);
      if (failureReason) {
        const endedAt = new Date().toISOString();
        return buildPageStateFailure({
          abilityInput: input,
          failureReason,
          stateSummary: "page-state comment-panel detection input is incomplete",
          startedAt,
          endedAt,
        });
      }

      const observations = [...getObservationByKind(input, "visual_target"), ...getObservationByKind(input, "page_marker")];
      const commentsPanelOpen = observations.find((observation) => readBooleanPayload(observation, "commentsPanelOpen") !== null || readStringPayload(observation, "pageState") !== null);
      const endedAt = new Date().toISOString();

      if (!commentsPanelOpen) {
        return buildPageStateFailure({
          abilityInput: input,
          failureReason: "insufficient_signal",
          stateSummary: "comments panel state signals are missing",
          startedAt,
          endedAt,
          reviewRequiredReason: input.statePolicy.allowReviewRequired ? "comments panel state could not be classified from current observations" : null,
        });
      }

      const explicitOpen = readBooleanPayload(commentsPanelOpen, "commentsPanelOpen");
      const explicitState = readStringPayload(commentsPanelOpen, "pageState");
      const isOpen = explicitOpen === true || explicitState === "comments_panel_open";

      return buildPageStateResult({
        abilityInput: input,
        pageStateType: isOpen ? "comments_panel_open" : "comments_panel_closed",
        stateSummary: isOpen ? "comments panel is visible on the current page" : "comments panel is not visible on the current page",
        confidence: 0.88,
        startedAt,
        endedAt,
      });
    },
  };
}