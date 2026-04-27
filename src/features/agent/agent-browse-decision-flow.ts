import type { RuntimePageReadyStatus } from "../../types/runtime.js";
import type { VisionProductPresenceResult } from "../../types/vision-product-presence.js";
import type { AgentBrowseDecisionOutput, BrowserRoundStep, ProductPresenceDecision, RoundOutcome } from "./agent-browse-flow-contract.js";

export const PRODUCT_PRESENCE_CONFIDENCE_THRESHOLD = 0.75;

const lower = (value: string | null | undefined): string => value?.toLowerCase() ?? "";

const createDecisionOutput = (input: {
  decision: ProductPresenceDecision;
  nextStep: BrowserRoundStep;
  roundOutcome: RoundOutcome | null;
  reason: string;
  shouldCollectPreActionMetrics?: boolean;
  shouldRunLikeSaveMarker?: boolean;
  shouldOpenComments?: boolean;
  shouldCreateVideoOnlyCandidate?: boolean;
  shouldCreateRicherCandidate?: boolean;
  shouldScrollNext?: boolean;
  shouldClickNotInterested?: boolean;
  mustReview?: boolean;
}): AgentBrowseDecisionOutput => ({
  decision: input.decision,
  nextStep: input.nextStep,
  roundOutcome: input.roundOutcome,
  shouldCollectPreActionMetrics: input.shouldCollectPreActionMetrics ?? false,
  shouldRunLikeSaveMarker: input.shouldRunLikeSaveMarker ?? false,
  shouldOpenComments: input.shouldOpenComments ?? false,
  shouldCreateVideoOnlyCandidate: input.shouldCreateVideoOnlyCandidate ?? false,
  shouldCreateRicherCandidate: input.shouldCreateRicherCandidate ?? false,
  shouldScrollNext: input.shouldScrollNext ?? false,
  shouldClickNotInterested: input.shouldClickNotInterested ?? false,
  mustReview: input.mustReview ?? false,
  reason: input.reason,
});

export const determineBlockedBrowseDecision = (input: {
  pageReadyStatus: RuntimePageReadyStatus;
  message: string;
  geometryGuardStatus: string;
}): AgentBrowseDecisionOutput | null => {
  const message = lower(input.message);
  const geometry = lower(input.geometryGuardStatus);

  if (geometry.includes("mismatch")) {
    return createDecisionOutput({
      decision: "geometry_mismatch",
      nextStep: "review_required",
      roundOutcome: "review_required",
      reason: "geometry mismatch blocks governed browse actions",
      mustReview: true,
    });
  }

  if (message.includes("captcha")) {
    return createDecisionOutput({
      decision: "blocked_by_captcha",
      nextStep: "review_required",
      roundOutcome: "review_required",
      reason: "captcha detected and must route to operator review",
      mustReview: true,
    });
  }

  if (message.includes("login")) {
    return createDecisionOutput({
      decision: "blocked_by_login",
      nextStep: "review_required",
      roundOutcome: "review_required",
      reason: "login wall detected and must route to operator review",
      mustReview: true,
    });
  }

  if (message.includes("safety") || message.includes("unknown ui") || input.pageReadyStatus === "review_required") {
    return createDecisionOutput({
      decision: "blocked_by_safety_page",
      nextStep: "review_required",
      roundOutcome: "review_required",
      reason: "safety page or unknown UI detected and must route to operator review",
      mustReview: true,
    });
  }

  return null;
};

export const resolveProductPresenceDecision = (
  payload: VisionProductPresenceResult,
): AgentBrowseDecisionOutput => {
  if (payload.mustReview || payload.suggestedNextAction === "review_required") {
    return createDecisionOutput({
      decision: "product_uncertain",
      nextStep: "review_required",
      roundOutcome: "review_required",
      reason: payload.reason,
      mustReview: true,
    });
  }

  if (payload.isProductVideo === true && payload.confidence >= PRODUCT_PRESENCE_CONFIDENCE_THRESHOLD) {
    return createDecisionOutput({
      decision: "product_yes_high_confidence",
      nextStep: "collect_pre_action_metrics",
      roundOutcome: null,
      reason: payload.reason,
      shouldCollectPreActionMetrics: true,
      shouldRunLikeSaveMarker: true,
      shouldOpenComments: true,
      shouldCreateVideoOnlyCandidate: true,
      shouldCreateRicherCandidate: true,
    });
  }

  if (payload.isProductVideo === false && payload.confidence >= PRODUCT_PRESENCE_CONFIDENCE_THRESHOLD) {
    return createDecisionOutput({
      decision: "product_no_high_confidence",
      nextStep: "decide_negative_action",
      roundOutcome: "skipped_non_product",
      reason: payload.reason,
      shouldScrollNext: true,
      shouldClickNotInterested: payload.suggestedNextAction === "click_not_interested_or_scroll_next",
    });
  }

  return createDecisionOutput({
    decision: "product_uncertain",
    nextStep: payload.mustReview ? "review_required" : "record_skip_reason",
    roundOutcome: payload.mustReview ? "review_required" : "skipped_uncertain",
    reason: payload.reason,
    shouldScrollNext: !payload.mustReview,
    mustReview: payload.mustReview,
  });
};