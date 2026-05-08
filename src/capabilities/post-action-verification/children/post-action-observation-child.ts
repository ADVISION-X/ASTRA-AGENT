import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionVerificationChildCapabilityId } from "../shared/post-action-types.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext, PostActionChildObservation } from "../runtime/post-action-verification-runtime-context.js";

const POST_ACTION_PACKAGE_LABELS: Record<PostActionVerificationChildCapabilityId, string> = {
  "observe-page-open-attempt": "page-open attempt observation bundle",
  "observe-comments-panel-open-attempt": "comments-panel open attempt observation bundle",
  "observe-comments-panel-close-attempt": "comments-panel close attempt observation bundle",
  "observe-not-interested-attempt": "not-interested attempt observation bundle",
  "observe-target-state-transition": "target-state transition observation bundle",
};

function buildObservation(input: ParsedPostActionVerificationAbilityInput, childCapabilityId: PostActionVerificationChildCapabilityId): PostActionChildObservation {
  return {
    packageLabel: POST_ACTION_PACKAGE_LABELS[childCapabilityId],
    observationSummary: `${POST_ACTION_PACKAGE_LABELS[childCapabilityId]} packaged from ${input.observationSet.observations.length} governed observations. AI owns final action-outcome judgment.`,
    failureReason: null,
    reviewRequiredReason: input.observationSet.observations.length === 0 ? "No governed observations were provided for AI review." : null,
    statusMessage: `Packaged governed observations for ${childCapabilityId}.`,
    dataQualityFlags: input.observationSet.observations.length === 0 ? ["missing_observation"] : [],
    supportingEvidenceRefs: [
      input.beforeAfterEvidence.beforeEvidence?.evidenceRef ?? null,
      input.beforeAfterEvidence.afterEvidence?.evidenceRef ?? null,
      input.actionProof.actionProofRef,
    ].filter((value): value is string => Boolean(value)),
    supportingObservationRefs: input.observationSet.observations.map((observation) => observation.ref),
    supportingSourceProofRefs: [
      input.actionProof.sourceRuntimeProofRef,
      ...input.observationSet.observations.map((observation) => observation.source.sourceProofRef),
    ].filter((value): value is string => Boolean(value)),
  };
}

export function createObservePostActionCapability(childCapabilityId: PostActionVerificationChildCapabilityId): PostActionVerificationChildCapability {
  return {
    abilityGroupId: "post-action-verification",
    childCapabilityId,
    async execute(input: ParsedPostActionVerificationAbilityInput, _context: PostActionVerificationRuntimeContext) {
      return buildObservation(input, childCapabilityId);
    },
  };
}
