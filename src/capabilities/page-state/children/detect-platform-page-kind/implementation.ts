import {
  PAGE_STATE_ABILITY_GROUP_ID,
  type PageStateChildCapability,
} from "../../contract.js";
import { resolvePlatformPageKind } from "../../state-profiles.js";
import { buildPageStateFailure, buildPageStateResult } from "../../shared/page-state-result.js";
import { validatePageStateInput } from "../../shared/state-policy.js";

export function createDetectPlatformPageKindCapability(): PageStateChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-platform-page-kind",
    async execute(input) {
      const startedAt = new Date().toISOString();
      const failureReason = validatePageStateInput(input);
      if (failureReason) {
        const endedAt = new Date().toISOString();
        return buildPageStateFailure({
          abilityInput: input,
          failureReason,
          stateSummary: "page-state platform-page-kind detection input is incomplete",
          startedAt,
          endedAt,
        });
      }

      const pageKind = resolvePlatformPageKind(input.currentUrl);
      const endedAt = new Date().toISOString();
      return buildPageStateResult({
        abilityInput: input,
        pageStateType: pageKind,
        stateSummary: pageKind === "platform_feed"
          ? "current page matches the governed platform feed surface"
          : pageKind === "platform_video_page"
            ? "current page matches a governed platform video-detail surface"
            : "current page kind is not recognized as a governed platform surface",
        confidence: pageKind === "platform_unknown" ? 0.65 : 0.88,
        startedAt,
        endedAt,
        reviewRequiredReason: pageKind === "platform_unknown" && input.statePolicy.allowReviewRequired
          ? "current page kind is unknown to the governed platform adapter"
          : null,
      });
    },
  };
}