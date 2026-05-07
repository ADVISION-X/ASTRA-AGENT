import type { PageStateAbilityInput, PageStateChildCapabilityId, PageStateChildObservation } from "../schema.js";
import type { PageStateChildCapability } from "../runtime/page-state-child-contract.js";

const PAGE_STATE_PACKAGE_LABELS: Record<PageStateChildCapabilityId, string> = {
  "observe-login-surface": "raw page observation bundle",
  "observe-safety-surface": "raw page observation bundle",
  "observe-feed-surface": "raw page observation bundle",
  "observe-video-surface": "raw page observation bundle",
  "observe-comment-panel-surface": "raw page observation bundle",
  "observe-modal-overlay-surface": "raw page observation bundle",
  "observe-page-abnormality-surface": "raw page observation bundle",
  "observe-platform-surface": "raw page observation bundle",
};

function buildObservationSummary(input: PageStateAbilityInput, childCapabilityId: PageStateChildCapabilityId): string {
  return `${PAGE_STATE_PACKAGE_LABELS[childCapabilityId]} packaged from ${input.observations.length} governed raw observations. AI owns readiness, safety, stability, page-kind, blocker, and business interpretation.`;
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
