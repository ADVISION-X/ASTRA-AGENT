import {
  PAGE_STATE_ABILITY_GROUP_ID,
  type PageStateChildCapability,
} from "../../contract.js";
import { getObservationByKind, readBooleanPayload, readStringPayload } from "../../shared/observation-utils.js";
import { buildPageStateFailure, buildPageStateResult } from "../../shared/page-state-result.js";
import { validatePageStateInput } from "../../shared/state-policy.js";

export function createDetectModalOverlayStateCapability(): PageStateChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-modal-overlay-state",
    async execute(input) {
      const startedAt = new Date().toISOString();
      const failureReason = validatePageStateInput(input);
      if (failureReason) {
        const endedAt = new Date().toISOString();
        return buildPageStateFailure({
          abilityInput: input,
          failureReason,
          stateSummary: "page-state modal-overlay detection input is incomplete",
          startedAt,
          endedAt,
        });
      }

      const observations = [...getObservationByKind(input, "visual_target"), ...getObservationByKind(input, "page_marker")];
      const modalObservation = observations.find((observation) => readBooleanPayload(observation, "modalOverlayPresent") !== null || readStringPayload(observation, "overlayState") !== null);
      const endedAt = new Date().toISOString();

      if (!modalObservation) {
        return buildPageStateFailure({
          abilityInput: input,
          failureReason: "insufficient_signal",
          stateSummary: "modal overlay state signals are missing",
          startedAt,
          endedAt,
          reviewRequiredReason: input.statePolicy.allowReviewRequired ? "modal overlay state could not be classified from current observations" : null,
        });
      }

      const explicitPresent = readBooleanPayload(modalObservation, "modalOverlayPresent");
      const overlayState = readStringPayload(modalObservation, "overlayState");
      const isPresent = explicitPresent === true || overlayState === "present";

      return buildPageStateResult({
        abilityInput: input,
        pageStateType: isPresent ? "modal_overlay_present" : "modal_overlay_absent",
        stateSummary: isPresent ? "a modal or overlay is currently blocking the page" : "no modal or overlay is blocking the page",
        confidence: 0.86,
        startedAt,
        endedAt,
      });
    },
  };
}