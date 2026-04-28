import {
  PAGE_STATE_ABILITY_GROUP_ID,
  type PageStateChildCapability,
  type PageStateFailureReason,
} from "../../contract.js";
import { resolvePlatformPageKind } from "../../state-profiles.js";
import { buildPageStateFailure, buildPageStateResult } from "../../shared/page-state-result.js";
import { validatePageStateInput } from "../../shared/state-policy.js";

function buildInvalidInputFailure(input: Parameters<PageStateChildCapability["execute"]>[0], startedAt: string, failureReason: PageStateFailureReason) {
  return buildPageStateFailure({
    abilityInput: input,
    failureReason,
    stateSummary: "page-state feed-ready detection input is incomplete",
    startedAt,
    endedAt: new Date().toISOString(),
  });
}

function resolveFeedReadyResult(input: Parameters<PageStateChildCapability["execute"]>[0], pageKind: ReturnType<typeof resolvePlatformPageKind>, startedAt: string, endedAt: string) {
  if (input.currentUrl === "about:blank") {
    return buildPageStateResult({ abilityInput: input, pageStateType: "feed_not_ready", stateSummary: "current page is blank and the platform feed is not ready", confidence: 0.98, startedAt, endedAt, reviewRequiredReason: "uncertain platform access: real platform page is blank and requires operator review" });
  }
  if (input.browserLoginState === "login_required") {
    return buildPageStateResult({ abilityInput: input, pageStateType: "login_required", stateSummary: "current page is blocked by a login wall", confidence: 0.98, startedAt, endedAt, reviewRequiredReason: "uncertain platform access: login wall detected and requires operator review" });
  }
  if (input.browserLoginState === "review_required") {
    return buildPageStateResult({ abilityInput: input, pageStateType: "review_required", stateSummary: "current page is blocked by captcha or verification wall", confidence: 0.98, startedAt, endedAt, reviewRequiredReason: "uncertain platform access: captcha or verification wall detected and requires operator review" });
  }
  if (pageKind === "platform_unknown") {
    return buildPageStateResult({ abilityInput: input, pageStateType: "feed_not_ready", stateSummary: "current page does not match a recognized platform feed surface", confidence: 0.7, startedAt, endedAt, reviewRequiredReason: input.statePolicy.allowReviewRequired ? "uncertain platform access: platform page structure not recognized and requires operator review" : null });
  }

  return buildPageStateResult({ abilityInput: input, pageStateType: "feed_ready", stateSummary: "platform feed surface is ready for runtime observation", confidence: 0.9, startedAt, endedAt });
}

async function executeDetectFeedReady(input: Parameters<PageStateChildCapability["execute"]>[0]) {
  const startedAt = new Date().toISOString();
  const failureReason = validatePageStateInput(input);
  if (failureReason) {
    return buildInvalidInputFailure(input, startedAt, failureReason);
  }

  const pageKind = resolvePlatformPageKind(input.currentUrl);
  return resolveFeedReadyResult(input, pageKind, startedAt, new Date().toISOString());
}

export function createDetectFeedReadyCapability(): PageStateChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-feed-ready",
    execute: executeDetectFeedReady,
  };
}