import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionVerificationChildCapabilityId } from "../shared/post-action-types.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext, PostActionChildObservation } from "../runtime/post-action-verification-runtime-context.js";

const POST_ACTION_PACKAGE_LABELS: Record<PostActionVerificationChildCapabilityId, string> = {
  "observe-page-open-attempt": "page-open attempt verification bundle",
  "observe-comments-panel-open-attempt": "comments-panel open attempt verification bundle",
  "observe-comments-panel-close-attempt": "comments-panel close attempt verification bundle",
  "observe-not-interested-attempt": "not-interested attempt verification bundle",
  "observe-target-state-transition": "target-state transition verification bundle",
  "verify-action-result": "action-result verification bundle",
};

function collectSupportingEvidenceRefs(input: ParsedPostActionVerificationAbilityInput): string[] {
  return [
    input.beforeAfterEvidence.beforeEvidence?.evidenceRef ?? null,
    input.beforeAfterEvidence.afterEvidence?.evidenceRef ?? null,
    input.actionProof.actionProofRef,
  ].filter((value): value is string => Boolean(value));
}

function buildObservationSummary(input: ParsedPostActionVerificationAbilityInput, packageLabel: string, evidenceRefs: string[]): string {
  return `${packageLabel} closed from ${input.observationSet.observations.length} governed observations and ${evidenceRefs.length} governed evidence refs. Semantic interpretation remains with upstream analyzers.`;
}

function buildObservation(input: ParsedPostActionVerificationAbilityInput, childCapabilityId: PostActionVerificationChildCapabilityId): PostActionChildObservation {
  const packageLabel = POST_ACTION_PACKAGE_LABELS[childCapabilityId];
  const supportingEvidenceRefs = collectSupportingEvidenceRefs(input);
  return {
    packageLabel,
    observationSummary: buildObservationSummary(input, packageLabel, supportingEvidenceRefs),
    failureReason: null,
    reviewRequiredReason: input.observationSet.observations.length === 0 ? "No governed observations were provided for AI review." : null,
    statusMessage: `Closed governed verification bundle for ${childCapabilityId}.`,
    dataQualityFlags: input.observationSet.observations.length === 0 ? ["missing_observation"] : [],
    supportingEvidenceRefs,
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
