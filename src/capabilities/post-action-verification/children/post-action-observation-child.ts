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

const OBSERVATION_EVIDENCE_KIND_BY_KIND = {
  page_state: "page_state",
  ai_observation: "ai_observation",
  visual_target: "visual_target",
  screenshot_diff: "screenshot_diff",
  video_identity: "video_identity",
  runtime_signal: "runtime_signal",
} as const;

function collectSupportingEvidenceRefs(input: ParsedPostActionVerificationAbilityInput): string[] {
  return [
    input.beforeAfterEvidence.beforeEvidence?.evidenceRef ?? null,
    input.beforeAfterEvidence.afterEvidence?.evidenceRef ?? null,
  ].filter((value): value is string => Boolean(value));
}

function collectVerifiedByEvidenceKinds(input: ParsedPostActionVerificationAbilityInput): Array<
  "page_state" | "screenshot" | "visual_target" | "ai_observation" | "runtime_signal" | "screenshot_diff" | "video_identity"
> {
  return [...new Set([
    input.beforeAfterEvidence.beforeEvidence?.evidenceKind ?? null,
    input.beforeAfterEvidence.afterEvidence?.evidenceKind ?? null,
    ...input.observationSet.observations.map((observation) => OBSERVATION_EVIDENCE_KIND_BY_KIND[observation.kind as keyof typeof OBSERVATION_EVIDENCE_KIND_BY_KIND] ?? null),
  ].filter((value): value is NonNullable<typeof value> => value !== null))];
}

function buildObservedOutcome(input: ParsedPostActionVerificationAbilityInput, packageLabel: string, evidenceRefs: string[]): string {
  return `${packageLabel} observed ${input.observationSet.observations.length} governed observations with ${evidenceRefs.length} governed evidence refs.`;
}

function buildConfidence(input: ParsedPostActionVerificationAbilityInput, verifiedByEvidenceKinds: readonly string[]): number {
  const observationCount = input.observationSet.observations.length;
  const sourceProofCount = new Set([
    input.actionProof.sourceRuntimeProofRef,
    ...input.observationSet.observations.map((observation) => observation.source.sourceProofRef),
  ]).size;
  const evidenceKindsCount = verifiedByEvidenceKinds.length;
  let confidence = 0.35 + Math.min(observationCount, 3) * 0.15 + Math.min(evidenceKindsCount, 3) * 0.1 + Math.min(sourceProofCount, 3) * 0.05;
  if (input.actionProof.selfReportedOnly) {
    confidence = Math.min(confidence, 0.2);
  }
  return Math.max(0, Math.min(1, Number(confidence.toFixed(2))));
}

function buildObservationSummary(input: ParsedPostActionVerificationAbilityInput, packageLabel: string, evidenceRefs: string[]): string {
  return `${packageLabel} closed from ${input.observationSet.observations.length} governed observations and ${evidenceRefs.length} governed evidence refs. Semantic interpretation remains with upstream analyzers.`;
}

function buildObservation(input: ParsedPostActionVerificationAbilityInput, childCapabilityId: PostActionVerificationChildCapabilityId): PostActionChildObservation {
  const packageLabel = POST_ACTION_PACKAGE_LABELS[childCapabilityId];
  const supportingEvidenceRefs = collectSupportingEvidenceRefs(input);
  const verifiedByEvidenceKinds = collectVerifiedByEvidenceKinds(input);
  return {
    packageLabel,
    observationSummary: buildObservationSummary(input, packageLabel, supportingEvidenceRefs),
    observedOutcome: buildObservedOutcome(input, packageLabel, supportingEvidenceRefs),
    verificationDecision: input.observationSet.observations.length === 0 ? "failed" : "verified",
    confidence: buildConfidence(input, verifiedByEvidenceKinds),
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
    verifiedByEvidenceKinds,
    confidenceSource: "governed_observation_bundle",
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
