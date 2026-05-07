import type { PageStateAbilityInput, PageStateChildCapabilityId, PageStateChildObservation } from "../schema.js";
import type { PageStateChildCapability } from "../runtime/page-state-child-contract.js";

const PAGE_STATE_PACKAGE_LABELS: Record<PageStateChildCapabilityId, string> = {
  "observe-login-surface": "login surface observation bundle",
  "observe-safety-surface": "safety surface observation bundle",
  "observe-feed-surface": "feed surface observation bundle",
  "observe-video-surface": "video surface observation bundle",
  "observe-comment-panel-surface": "comment panel observation bundle",
  "observe-modal-overlay-surface": "modal overlay observation bundle",
  "observe-page-abnormality-surface": "page abnormality observation bundle",
  "observe-platform-surface": "platform surface observation bundle",
};

function buildObservationSummary(input: PageStateAbilityInput, childCapabilityId: PageStateChildCapabilityId): string {
  return `${PAGE_STATE_PACKAGE_LABELS[childCapabilityId]} packaged from ${input.observations.length} governed observations. AI owns readiness, safety, stability, and page-kind interpretation.`;
}

function buildChildObservation(input: PageStateAbilityInput, childCapabilityId: PageStateChildCapabilityId): PageStateChildObservation {
  return {
    childCapabilityId,
    packageLabel: PAGE_STATE_PACKAGE_LABELS[childCapabilityId],
    observationSummary: buildObservationSummary(input, childCapabilityId),
    reviewRequiredReason: input.observations.length === 0 ? "No governed observations were provided for AI review." : null,
    dataQualityFlags: input.observations.length === 0 ? ["missing_observation"] : [],
    matchedObservationIds: input.observations.map((observation) => observation.observationId),
    supportingEvidenceRefs: [...input.sourceEvidenceRefs],
    supportingReasons: [
      `Page State child ${childCapabilityId} only packages observations and does not classify the current page.`,
    ],
  };
}

export function createObservePageSurfaceCapability(childCapabilityId: PageStateChildCapabilityId): PageStateChildCapability {
  return {
    abilityGroupId: "page-state",
    childCapabilityId,
    async execute(input) {
      return buildChildObservation(input, childCapabilityId);
    },
  };
}