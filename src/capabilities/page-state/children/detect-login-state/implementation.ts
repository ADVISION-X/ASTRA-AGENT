import {
  PAGE_STATE_ABILITY_GROUP_ID,
  type PageStateChildCapability,
} from "../../contract.js";
import { mapLoginStateToPageState } from "../../state-profiles.js";
import { buildPageStateFailure, buildPageStateResult } from "../../shared/page-state-result.js";
import { validatePageStateInput } from "../../shared/state-policy.js";

export function createDetectLoginStateCapability(): PageStateChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-login-state",
    async execute(input) {
      const startedAt = new Date().toISOString();
      const failureReason = validatePageStateInput(input);
      if (failureReason) {
        const endedAt = new Date().toISOString();
        return buildPageStateFailure({
          abilityInput: input,
          failureReason,
          stateSummary: "page-state login detection input is incomplete",
          startedAt,
          endedAt,
        });
      }

      const detected = mapLoginStateToPageState(input.browserLoginState);
      const endedAt = new Date().toISOString();
      return buildPageStateResult({
        abilityInput: input,
        pageStateType: detected.pageStateType,
        stateSummary: detected.stateSummary,
        confidence: detected.confidence,
        startedAt,
        endedAt,
        reviewRequiredReason: detected.reviewRequiredReason,
      });
    },
  };
}