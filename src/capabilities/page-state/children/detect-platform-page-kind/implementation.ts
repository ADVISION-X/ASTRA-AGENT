import { PAGE_STATE_ABILITY_GROUP_ID } from "../../contract.js";
import { isLocalWorkbenchUrl, resolvePageStatePlatformProfile, urlMatchesFeedPath, urlMatchesVideoPath } from "../../shared/page-state-profile.js";
import type { DetectPlatformPageKindChildCapability } from "./contract.js";
import { DetectPlatformPageKindChildInputSchema, DetectPlatformPageKindChildOutputSchema } from "./schema.js";

function buildLocalWorkbenchOutput(request: ReturnType<typeof DetectPlatformPageKindChildInputSchema.parse>) {
  return {
    childCapabilityId: "detect-platform-page-kind" as const,
    pageStateType: "local_workbench" as const,
    stateSummary: "Current page resolves to the local workbench profile.",
    confidence: 0.98,
    reviewRequiredReason: null,
    dataQualityFlags: [],
    matchedObservationIds: [],
    supportingEvidenceRefs: [...request.sourceEvidenceRefs],
    supportingReasons: ["snapshot.currentUrl host is local workbench"],
  };
}

function buildPlatformVideoOutput(request: ReturnType<typeof DetectPlatformPageKindChildInputSchema.parse>, resolvedProfile: NonNullable<ReturnType<typeof resolvePageStatePlatformProfile>>) {
  return {
    childCapabilityId: "detect-platform-page-kind" as const,
    pageStateType: "platform_video_page" as const,
    stateSummary: "URL path indicates a platform video page.",
    confidence: 0.9,
    reviewRequiredReason: null,
    dataQualityFlags: [],
    matchedObservationIds: [],
    supportingEvidenceRefs: [...request.sourceEvidenceRefs],
    supportingReasons: [`URL path matches governed video marker for ${resolvedProfile.profileId}`],
  };
}

function buildPlatformFeedOutput(request: ReturnType<typeof DetectPlatformPageKindChildInputSchema.parse>, resolvedProfile: NonNullable<ReturnType<typeof resolvePageStatePlatformProfile>>) {
  return {
    childCapabilityId: "detect-platform-page-kind" as const,
    pageStateType: "platform_feed" as const,
    stateSummary: "URL path indicates a platform feed page.",
    confidence: 0.88,
    reviewRequiredReason: null,
    dataQualityFlags: [],
    matchedObservationIds: [],
    supportingEvidenceRefs: [...request.sourceEvidenceRefs],
    supportingReasons: [`URL path matches governed feed marker for ${resolvedProfile.profileId}`],
  };
}

function buildPlatformUnknownOutput(request: ReturnType<typeof DetectPlatformPageKindChildInputSchema.parse>) {
  return {
    childCapabilityId: "detect-platform-page-kind" as const,
    pageStateType: "platform_unknown" as const,
    stateSummary: "Platform page kind is unknown for the current URL.",
    confidence: 0.52,
    reviewRequiredReason: "Review required because the platform page kind could not be resolved.",
    dataQualityFlags: ["insufficient_signal"],
    matchedObservationIds: [],
    supportingEvidenceRefs: [...request.sourceEvidenceRefs],
    supportingReasons: ["URL pathname did not match a governed feed or video profile"],
  };
}

function resolveDetectPlatformPageKindOutput(request: ReturnType<typeof DetectPlatformPageKindChildInputSchema.parse>) {
  const resolvedProfile = resolvePageStatePlatformProfile(request.openHandoff.platformProfileId);
  if (request.statePolicy.allowLocalWorkbench && isLocalWorkbenchUrl(request.snapshot.currentUrl)) {
    return buildLocalWorkbenchOutput(request);
  }

  if (resolvedProfile && urlMatchesVideoPath(request.snapshot.currentUrl, resolvedProfile)) {
    return buildPlatformVideoOutput(request, resolvedProfile);
  }

  if (resolvedProfile && urlMatchesFeedPath(request.snapshot.currentUrl, resolvedProfile)) {
    return buildPlatformFeedOutput(request, resolvedProfile);
  }

  return buildPlatformUnknownOutput(request);
}

async function executeDetectPlatformPageKind(input: unknown) {
  const request = DetectPlatformPageKindChildInputSchema.parse(input);
  return DetectPlatformPageKindChildOutputSchema.parse(resolveDetectPlatformPageKindOutput(request));
}

export function createDetectPlatformPageKindCapability(): DetectPlatformPageKindChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-platform-page-kind",
    execute: executeDetectPlatformPageKind,
  };
}