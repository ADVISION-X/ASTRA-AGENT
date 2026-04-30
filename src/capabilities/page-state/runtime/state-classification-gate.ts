import type { PageStateChildCapability } from "./page-state-child-contract.js";
import type { PageStateAbilityInput } from "../schema.js";
import { childAllowsProceed, isBlockedPageStateType, isReviewRequiredPageStateType } from "../shared/page-state-policy.js";
import type { PageStateClassificationOutcome, PageStateResolvedPlatformProfile } from "../shared/page-state-types.js";
import { gatePageStateOutputBoundary } from "./page-state-output-boundary-gate.js";

function mapFailureReason(pageStateType: PageStateClassificationOutcome["pageStateType"]): PageStateClassificationOutcome["failureReason"] {
  switch (pageStateType) {
    case "login_required":
      return "login_wall_detected";
    case "safety_wall":
    case "captcha_challenge":
      return "safety_wall_detected";
    case "modal_overlay_present":
      return "modal_overlay_detected";
    case "page_abnormal":
      return "page_abnormal_detected";
    case "wrong_domain":
      return "platform_mismatch";
    case "feed_not_ready":
    case "video_unstable":
      return "insufficient_signal";
    default:
      return null;
  }
}

export async function classifyPageState(input: {
  request: PageStateAbilityInput;
  childCapability: PageStateChildCapability;
  resolvedProfile: PageStateResolvedPlatformProfile;
}): Promise<PageStateClassificationOutcome> {
  const detection = await input.childCapability.execute(input.request);
  const boundary = gatePageStateOutputBoundary({ request: input.request, detection });
  if (!boundary.ok) {
    return {
      ...detection,
      status: boundary.failure.status,
      decision: boundary.failure.decision,
      failureReason: boundary.failure.failureReason,
      resolvedProfileId: input.resolvedProfile.profileId,
      matchedHost: input.resolvedProfile.matchedHost,
      pageStateType: boundary.failure.pageStateType,
      stateSummary: boundary.failure.stateSummary,
      confidence: 0,
      reviewRequiredReason: boundary.failure.reviewRequiredReason,
      dataQualityFlags: boundary.failure.dataQualityFlags,
      matchedObservationIds: [],
      supportingEvidenceRefs: [],
      supportingReasons: [boundary.failure.stateSummary],
      childCapabilityId: input.request.childCapabilityId,
    };
  }
  const lowConfidence = detection.confidence < input.request.confidencePolicy.minimumConfidence;

  if (lowConfidence) {
    return {
      ...detection,
      status: input.request.confidencePolicy.allowReviewRequired ? "review_required" : "failed",
      decision: input.request.confidencePolicy.allowReviewRequired ? "review_required" : "fail",
      failureReason: "low_confidence",
      resolvedProfileId: input.resolvedProfile.profileId,
      matchedHost: input.resolvedProfile.matchedHost,
      reviewRequiredReason: detection.reviewRequiredReason ?? "Review required because confidence is below the minimum confidence policy.",
      dataQualityFlags: [...detection.dataQualityFlags, "low_confidence"],
    };
  }

  if (isBlockedPageStateType(detection.pageStateType)) {
    return {
      ...detection,
      status: "failed",
      decision: "block",
      failureReason: mapFailureReason(detection.pageStateType) ?? "classification_failed",
      resolvedProfileId: input.resolvedProfile.profileId,
      matchedHost: input.resolvedProfile.matchedHost,
    };
  }

  if (isReviewRequiredPageStateType(detection.pageStateType)) {
    return {
      ...detection,
      status: "review_required",
      decision: "review_required",
      failureReason: mapFailureReason(detection.pageStateType) ?? "classification_failed",
      resolvedProfileId: input.resolvedProfile.profileId,
      matchedHost: input.resolvedProfile.matchedHost,
      reviewRequiredReason: detection.reviewRequiredReason ?? `Review required for ${detection.pageStateType}.`,
    };
  }

  if (!childAllowsProceed(input.request.childCapabilityId, detection.pageStateType)) {
    return {
      ...detection,
      status: input.request.statePolicy.allowUnknownState ? "review_required" : "failed",
      decision: input.request.statePolicy.allowUnknownState ? "review_required" : "fail",
      failureReason: "classification_failed",
      resolvedProfileId: input.resolvedProfile.profileId,
      matchedHost: input.resolvedProfile.matchedHost,
      reviewRequiredReason: `Review required because ${detection.pageStateType} is not a governed proceed state for ${input.request.childCapabilityId}.`,
      dataQualityFlags: [...detection.dataQualityFlags, "insufficient_signal"],
    };
  }

  return {
    ...detection,
    status: "success",
    decision: "proceed",
    failureReason: null,
    resolvedProfileId: input.resolvedProfile.profileId,
    matchedHost: input.resolvedProfile.matchedHost,
  };
}