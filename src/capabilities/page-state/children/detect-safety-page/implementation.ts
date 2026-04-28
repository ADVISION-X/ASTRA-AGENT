import {
  PAGE_STATE_ABILITY_GROUP_ID,
  type PageStateChildCapability,
} from "../../contract.js";
import { detectReviewTokens } from "../../state-profiles.js";
import { buildPageStateFailure, buildPageStateResult } from "../../shared/page-state-result.js";
import { validatePageStateInput } from "../../shared/state-policy.js";

export function createDetectSafetyPageCapability(): PageStateChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-safety-page",
    async execute(input) {
      const startedAt = new Date().toISOString();
      const failureReason = validatePageStateInput(input);
      if (failureReason) {
        const endedAt = new Date().toISOString();
        return buildPageStateFailure({
          abilityInput: input,
          failureReason,
          stateSummary: "page-state safety detection input is incomplete",
          startedAt,
          endedAt,
        });
      }

      const hasSafetySignal = input.browserLoginState === "review_required" || detectReviewTokens(input.currentUrl, input.currentTitle);
      const endedAt = new Date().toISOString();
      return buildPageStateResult({
        abilityInput: input,
        pageStateType: hasSafetySignal ? "safety_page" : "page_normal",
        stateSummary: hasSafetySignal ? "captcha or safety-page markers detected on the current page" : "no captcha or safety-page markers detected on the current page",
        confidence: hasSafetySignal ? 0.96 : 0.82,
        startedAt,
        endedAt,
        reviewRequiredReason: hasSafetySignal ? "browser challenge or safety review required" : null,
      });
    },
  };
}