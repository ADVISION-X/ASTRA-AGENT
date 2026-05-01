import type { PageStateChildCapability } from "./page-state-child-contract.js";
import type { PageStateAbilityInput, PageStateChildDetection } from "../schema.js";
import { childAllowsProceed, isBlockedPageStateType, isReviewRequiredPageStateType } from "../shared/page-state-policy.js";
import type { PageStateClassificationOutcome, PageStateResolvedPlatformProfile } from "../shared/page-state-types.js";
import { gatePageStateOutputBoundary } from "./page-state-output-boundary-gate.js";

const FAILURE_REASON_BY_PAGE_STATE_TYPE: Partial<Record<PageStateClassificationOutcome["pageStateType"], PageStateClassificationOutcome["failureReason"]>> = {
  login_required: "login_wall_detected",
  safety_wall: "safety_wall_detected",
  captcha_challenge: "safety_wall_detected",
  modal_overlay_present: "modal_overlay_detected",
  page_abnormal: "page_abnormal_detected",
  wrong_domain: "platform_mismatch",
  feed_not_ready: "insufficient_signal",
  video_unstable: "insufficient_signal",
};

function mapFailureReason(pageStateType: PageStateClassificationOutcome["pageStateType"]): PageStateClassificationOutcome["failureReason"] {
  return FAILURE_REASON_BY_PAGE_STATE_TYPE[pageStateType] ?? null;
}

function buildClassificationOutcome(
  detection: PageStateChildDetection,
  resolvedProfile: PageStateResolvedPlatformProfile,
  patch: Partial<PageStateClassificationOutcome>,
): PageStateClassificationOutcome {
  return {
    childCapabilityId: patch.childCapabilityId ?? detection.childCapabilityId,
    pageStateType: patch.pageStateType ?? detection.pageStateType,
    stateSummary: patch.stateSummary ?? detection.stateSummary,
    confidence: patch.confidence ?? detection.confidence,
    reviewRequiredReason: patch.reviewRequiredReason ?? detection.reviewRequiredReason,
    dataQualityFlags: patch.dataQualityFlags ?? detection.dataQualityFlags,
    matchedObservationIds: patch.matchedObservationIds ?? detection.matchedObservationIds,
    supportingEvidenceRefs: patch.supportingEvidenceRefs ?? detection.supportingEvidenceRefs,
    supportingReasons: patch.supportingReasons ?? detection.supportingReasons,
    status: patch.status ?? "success",
    decision: patch.decision ?? "proceed",
    failureReason: patch.failureReason ?? null,
    resolvedProfileId: patch.resolvedProfileId ?? resolvedProfile.profileId,
    matchedHost: patch.matchedHost ?? resolvedProfile.matchedHost,
  };
}

function resolveBoundaryClassificationOutcome(input: {
  detection: PageStateChildDetection;
  resolvedProfile: PageStateResolvedPlatformProfile;
  request: PageStateAbilityInput;
}): PageStateClassificationOutcome | null {
  const boundary = gatePageStateOutputBoundary({ request: input.request, detection: input.detection });
  if (boundary.ok) {
    return null;
  }

  return buildClassificationOutcome(input.detection, input.resolvedProfile, {
    status: boundary.failure.status,
    decision: boundary.failure.decision,
    failureReason: boundary.failure.failureReason,
    pageStateType: boundary.failure.pageStateType,
    stateSummary: boundary.failure.stateSummary,
    confidence: 0,
    reviewRequiredReason: boundary.failure.reviewRequiredReason,
    dataQualityFlags: boundary.failure.dataQualityFlags,
    matchedObservationIds: [],
    supportingEvidenceRefs: [],
    supportingReasons: [boundary.failure.stateSummary],
    childCapabilityId: input.request.childCapabilityId,
  });
}

function resolveLowConfidenceClassificationOutcome(input: {
  detection: PageStateChildDetection;
  request: PageStateAbilityInput;
  resolvedProfile: PageStateResolvedPlatformProfile;
}): PageStateClassificationOutcome | null {
  if (input.detection.confidence >= input.request.confidencePolicy.minimumConfidence) {
    return null;
  }

  return buildClassificationOutcome(input.detection, input.resolvedProfile, {
    status: input.request.confidencePolicy.allowReviewRequired ? "review_required" : "failed",
    decision: input.request.confidencePolicy.allowReviewRequired ? "review_required" : "fail",
    failureReason: "low_confidence",
    reviewRequiredReason: input.detection.reviewRequiredReason ?? "Review required because confidence is below the minimum confidence policy.",
    dataQualityFlags: [...input.detection.dataQualityFlags, "low_confidence"],
  });
}

function resolveBlockedTypeClassificationOutcome(input: {
  detection: PageStateChildDetection;
  resolvedProfile: PageStateResolvedPlatformProfile;
}): PageStateClassificationOutcome | null {
  if (!isBlockedPageStateType(input.detection.pageStateType)) {
    return null;
  }

  return buildClassificationOutcome(input.detection, input.resolvedProfile, {
    status: "failed",
    decision: "block",
    failureReason: mapFailureReason(input.detection.pageStateType) ?? "classification_failed",
  });
}

function resolveReviewRequiredTypeClassificationOutcome(input: {
  detection: PageStateChildDetection;
  resolvedProfile: PageStateResolvedPlatformProfile;
}): PageStateClassificationOutcome | null {
  if (!isReviewRequiredPageStateType(input.detection.pageStateType)) {
    return null;
  }

  return buildClassificationOutcome(input.detection, input.resolvedProfile, {
    status: "review_required",
    decision: "review_required",
    failureReason: mapFailureReason(input.detection.pageStateType) ?? "classification_failed",
    reviewRequiredReason: input.detection.reviewRequiredReason ?? `Review required for ${input.detection.pageStateType}.`,
  });
}

function resolveProceedClassificationOutcome(input: {
  request: PageStateAbilityInput;
  detection: PageStateChildDetection;
  resolvedProfile: PageStateResolvedPlatformProfile;
}): PageStateClassificationOutcome | null {
  if (childAllowsProceed(input.request.childCapabilityId, input.detection.pageStateType)) {
    return null;
  }

  return buildClassificationOutcome(input.detection, input.resolvedProfile, {
    status: input.request.statePolicy.allowUnknownState ? "review_required" : "failed",
    decision: input.request.statePolicy.allowUnknownState ? "review_required" : "fail",
    failureReason: "classification_failed",
    reviewRequiredReason: `Review required because ${input.detection.pageStateType} is not a governed proceed state for ${input.request.childCapabilityId}.`,
    dataQualityFlags: [...input.detection.dataQualityFlags, "insufficient_signal"],
  });
}

function resolvePageStateClassificationOutcome(input: {
  request: PageStateAbilityInput;
  detection: PageStateChildDetection;
  resolvedProfile: PageStateResolvedPlatformProfile;
}): PageStateClassificationOutcome {
  return resolveBoundaryClassificationOutcome(input)
    ?? resolveLowConfidenceClassificationOutcome(input)
    ?? resolveBlockedTypeClassificationOutcome(input)
    ?? resolveReviewRequiredTypeClassificationOutcome(input)
    ?? resolveProceedClassificationOutcome(input)
    ?? buildClassificationOutcome(input.detection, input.resolvedProfile, {
      status: "success",
      decision: "proceed",
      failureReason: null,
    });
}

export async function classifyPageState(input: {
  request: PageStateAbilityInput;
  childCapability: PageStateChildCapability;
  resolvedProfile: PageStateResolvedPlatformProfile;
}): Promise<PageStateClassificationOutcome> {
  const detection = await input.childCapability.execute(input.request);
  return resolvePageStateClassificationOutcome({ request: input.request, detection, resolvedProfile: input.resolvedProfile });
}