import type {
  VisualTarget,
  VisualTargetAbilityContext,
  VisualTargetAbilityInput,
  VisualTargetChildCapabilityId,
  VisualTargetType,
} from "./contract.js";
import { buildFailedVisualTargetResult, buildSuccessfulVisualTargetResult } from "./shared/target-result.js";
import { resolveConfidencePolicy } from "./shared/confidence-policy.js";
import { selectVisualTargetCandidate } from "./target-selection.js";

type VisualTargetChildProfile = {
  childCapabilityId: VisualTargetChildCapabilityId;
  targetType: VisualTargetType;
  minimumConfidence?: number;
};

const VISUAL_TARGET_CHILD_PROFILES: Record<VisualTargetChildCapabilityId, VisualTargetChildProfile> = {
  "detect-comments-button": { childCapabilityId: "detect-comments-button", targetType: "comments_button", minimumConfidence: 0.72 },
  "detect-not-interested-button": { childCapabilityId: "detect-not-interested-button", targetType: "not_interested_button", minimumConfidence: 0.72 },
  "detect-next-video-region": { childCapabilityId: "detect-next-video-region", targetType: "next_video_region", minimumConfidence: 0.72 },
  "detect-like-button": { childCapabilityId: "detect-like-button", targetType: "like_button", minimumConfidence: 0.72 },
  "detect-save-button": { childCapabilityId: "detect-save-button", targetType: "save_button", minimumConfidence: 0.72 },
  "detect-comments-panel": { childCapabilityId: "detect-comments-panel", targetType: "comments_panel", minimumConfidence: 0.68 },
  "detect-close-comments-button": { childCapabilityId: "detect-close-comments-button", targetType: "close_comments_button", minimumConfidence: 0.72 },
  "detect-metric-like-count": { childCapabilityId: "detect-metric-like-count", targetType: "metric_like_count", minimumConfidence: 0.65 },
  "detect-metric-comment-count": { childCapabilityId: "detect-metric-comment-count", targetType: "metric_comment_count", minimumConfidence: 0.65 },
};

export function getVisualTargetChildProfile(childCapabilityId: VisualTargetChildCapabilityId): VisualTargetChildProfile {
  return VISUAL_TARGET_CHILD_PROFILES[childCapabilityId];
}

export async function executeVisualTargetProfile(input: {
  childCapabilityId: VisualTargetChildCapabilityId;
  request: VisualTargetAbilityInput;
  context: VisualTargetAbilityContext;
}): Promise<VisualTarget> {
  const startedAt = new Date().toISOString();
  const profile = getVisualTargetChildProfile(input.childCapabilityId);
  if (input.request.targetType !== profile.targetType) {
    return buildFailedVisualTargetResult({
      childCapabilityId: input.childCapabilityId,
      request: input.request,
      startedAt,
      status: "failed",
      failureReason: "invalid_target_type",
    });
  }

  const confidencePolicy = resolveConfidencePolicy({
    minConfidence: input.request.confidencePolicy?.minConfidence ?? profile.minimumConfidence ?? input.context.defaultConfidencePolicy.minConfidence,
  });
  const selectionPolicy = input.request.selectionPolicy ?? input.context.defaultSelectionPolicy;
  const dataQualityPolicy = input.request.dataQualityPolicy ?? input.context.defaultDataQualityPolicy;
  const selection = selectVisualTargetCandidate({
    candidates: input.request.candidates.filter((candidate) => candidate.targetType === null || candidate.targetType === input.request.targetType),
    coordinateSpace: input.request.coordinateSpace,
    confidencePolicy,
    selectionPolicy,
    dataQualityPolicy,
  });

  if (selection.status !== "selected") {
    return buildFailedVisualTargetResult({
      childCapabilityId: input.childCapabilityId,
      request: input.request,
      startedAt,
      status: selection.status,
      failureReason: selection.failureReason,
      dataQualityFlags: selection.dataQualityFlags,
    });
  }

  return buildSuccessfulVisualTargetResult({
    childCapabilityId: input.childCapabilityId,
    request: input.request,
    startedAt,
    sourceCandidateRef: selection.candidate.sourceCandidateRef,
    coordinateSpace: selection.candidate.coordinateSpace,
    boundingBox: selection.candidate.boundingBox,
    clickPoint: selection.candidate.clickPoint,
    confidence: selection.candidate.confidence,
    detectionMethod: selection.candidate.detectionMethod,
    visibleText: selection.candidate.visibleText,
    uncertainty: selection.candidate.uncertainty,
    blockedReason: selection.candidate.blockedReason,
    dataQualityFlags: selection.dataQualityFlags,
  });
}