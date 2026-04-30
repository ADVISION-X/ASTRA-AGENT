import { PAGE_STATE_ABILITY_GROUP_ID } from "../../contract.js";
import { findPageMarker, findPlatformCaptures, findVisualTargets } from "../../shared/page-state-observation.js";
import { resolvePageStatePlatformProfile, urlMatchesFeedPath } from "../../shared/page-state-profile.js";
import type { DetectFeedReadyChildCapability } from "./contract.js";
import { DetectFeedReadyChildInputSchema, DetectFeedReadyChildOutputSchema } from "./schema.js";

const collectFeedReadySignals = (request: ReturnType<typeof DetectFeedReadyChildInputSchema.parse>) => {
  const resolvedProfile = resolvePageStatePlatformProfile(request.openHandoff.platformProfileId);
  const feedMarkers = findPageMarker(request.observations, "feed_shell");
  const feedTargets = findVisualTargets(request.observations, "feed_card");
  const captures = findPlatformCaptures(request.observations, "post_open_capture");
  const hasFeedEvidence = feedMarkers.some((observation) => observation.payload.present)
    || feedTargets.some((observation) => observation.payload.matched && observation.payload.targetCount > 0)
    || captures.some((observation) => observation.payload.tags.includes("feed-shell") || observation.payload.tags.includes("feed-ready"));
  const matchedObservationIds = [...feedMarkers, ...feedTargets, ...captures].map((observation) => observation.observationId);

  return {
    resolvedProfile,
    hasFeedEvidence,
    matchedObservationIds,
  };
};

const buildFeedNotReadyOutput = (
  request: ReturnType<typeof DetectFeedReadyChildInputSchema.parse>,
  matchedObservationIds: string[],
) => ({
  childCapabilityId: "detect-feed-ready" as const,
  pageStateType: "feed_not_ready" as const,
  stateSummary: "Feed-ready evidence is incomplete for the current page.",
  confidence: 0.56,
  reviewRequiredReason: "Review required because feed-ready cannot be proven from the governed observations.",
  dataQualityFlags: ["insufficient_signal"],
  matchedObservationIds,
  supportingEvidenceRefs: [...request.sourceEvidenceRefs],
  supportingReasons: ["feed-ready requires markers, captures, and a resolved platform feed path"],
});

const buildFeedReadyOutput = (request: ReturnType<typeof DetectFeedReadyChildInputSchema.parse>) => {
  const { resolvedProfile, hasFeedEvidence, matchedObservationIds } = collectFeedReadySignals(request);

  if (request.snapshot.browserLoginState !== "logged_in") {
    return {
      childCapabilityId: "detect-feed-ready" as const,
      pageStateType: "feed_not_ready" as const,
      stateSummary: "Feed cannot be ready while the browser session is not logged in.",
      confidence: 0.94,
      reviewRequiredReason: "Feed readiness is blocked until the login wall is cleared.",
      dataQualityFlags: [],
      matchedObservationIds,
      supportingEvidenceRefs: [...request.sourceEvidenceRefs],
      supportingReasons: ["snapshot.browserLoginState is not logged_in"],
    };
  }

  if (resolvedProfile && hasFeedEvidence && urlMatchesFeedPath(request.snapshot.currentUrl, resolvedProfile)) {
    return {
      childCapabilityId: "detect-feed-ready" as const,
      pageStateType: "feed_ready" as const,
      stateSummary: "Feed shell evidence confirms the platform feed is ready.",
      confidence: 0.9,
      reviewRequiredReason: null,
      dataQualityFlags: [],
      matchedObservationIds,
      supportingEvidenceRefs: [...request.sourceEvidenceRefs],
      supportingReasons: [`feed markers and post-open capture agree on feed readiness for ${resolvedProfile.profileId}`],
    };
  }

  return buildFeedNotReadyOutput(request, matchedObservationIds);
};

export function createDetectFeedReadyCapability(): DetectFeedReadyChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-feed-ready",
    async execute(input) {
      const request = DetectFeedReadyChildInputSchema.parse(input);
      return DetectFeedReadyChildOutputSchema.parse(buildFeedReadyOutput(request));
    },
  };
}