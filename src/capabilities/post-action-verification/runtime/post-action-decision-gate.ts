import type { ParsedPostActionVerificationAbilityInput, PostActionFailureReason } from "../contract.js";
import type { PostActionChildObservation, PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

const VISUAL_EVIDENCE_KINDS = new Set(["screenshot", "screenshot_diff", "visual_target"]);
const VISUAL_OBSERVATION_KINDS = new Set(["screenshot_diff", "visual_target"]);

export type PostActionObservationBundleGateResult = {
  status: "success" | "failed";
  failureReason: PostActionFailureReason | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
};

const dedupeStrings = (values: readonly string[]) => [...new Set(values)];

const requiresBeforeAfterComparison = (request: ParsedPostActionVerificationAbilityInput) => (
  request.verificationPolicy.requireBeforeAfterComparison || request.expectedOutcome.requiresBeforeAfterComparison
);

const hasVisualEvidence = (request: ParsedPostActionVerificationAbilityInput) => (
  request.observationSet.observations.some((observation) => VISUAL_OBSERVATION_KINDS.has(observation.kind))
  || [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence].some((evidence) => evidence !== null && VISUAL_EVIDENCE_KINDS.has(evidence.evidenceKind))
);

const buildGateResult = (input: {
  status: "success" | "failed";
  failureReason: PostActionFailureReason | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
}): PostActionObservationBundleGateResult => ({
  ...input,
  dataQualityFlags: dedupeStrings(input.dataQualityFlags),
});

const buildFailedGateResult = (input: {
  childObservation: PostActionChildObservation;
  failureReason: PostActionFailureReason | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
}): PostActionObservationBundleGateResult => buildGateResult({
  status: "failed",
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  dataQualityFlags: input.dataQualityFlags,
});

const buildSuccessfulGateResult = (input: { childObservation: PostActionChildObservation }): PostActionObservationBundleGateResult => buildGateResult({
  status: "success",
  failureReason: null,
  reviewRequiredReason: null,
  dataQualityFlags: input.childObservation.dataQualityFlags,
});

export function evaluatePostActionObservationBundleGate(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  childObservation: PostActionChildObservation;
}): PostActionObservationBundleGateResult {
  const dataQualityFlags = [...input.childObservation.dataQualityFlags];
  const hasBeforeEvidence = input.request.beforeAfterEvidence.beforeEvidence !== null;
  const hasAfterEvidence = input.request.beforeAfterEvidence.afterEvidence !== null;

  if (input.childObservation.supportingObservationRefs.length === 0) {
    dataQualityFlags.push("missing_observation");
    return buildFailedGateResult({
      childObservation: input.childObservation,
      failureReason: "missing_observation_support",
      reviewRequiredReason: null,
      dataQualityFlags,
    });
  }

  if (input.childObservation.supportingSourceProofRefs.length === 0) {
    dataQualityFlags.push("missing_source_proof");
    return buildFailedGateResult({
      childObservation: input.childObservation,
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
    });
  }

  if (!input.childObservation.supportingSourceProofRefs.every((ref) => input.context.evidenceReadPort.verifyProofRef(input.request, ref))) {
    dataQualityFlags.push("invalid_source_proof");
    return buildFailedGateResult({
      childObservation: input.childObservation,
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
    });
  }

  if (!input.childObservation.supportingEvidenceRefs.every((ref) => input.context.evidenceReadPort.verifyEvidenceBinding(input.request, ref))) {
    dataQualityFlags.push("invalid_evidence_binding");
    return buildFailedGateResult({
      childObservation: input.childObservation,
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
    });
  }

  if (input.request.actionProof.selfReportedOnly && !input.request.verificationPolicy.allowSelfReportedSuccess) {
    dataQualityFlags.push("self_reported_only");
    return buildFailedGateResult({
      childObservation: input.childObservation,
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
    });
  }

  if (input.request.verificationPolicy.requireAfterEvidence && !hasAfterEvidence) {
    dataQualityFlags.push("missing_after_evidence");
    return buildFailedGateResult({
      childObservation: input.childObservation,
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
    });
  }

  if (requiresBeforeAfterComparison(input.request) && (!hasBeforeEvidence || !hasAfterEvidence)) {
    dataQualityFlags.push("missing_before_after_evidence");
    return buildFailedGateResult({
      childObservation: input.childObservation,
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
    });
  }

  if (input.request.expectedOutcome.requiresVisualEvidence && !hasVisualEvidence(input.request)) {
    dataQualityFlags.push("missing_visual_evidence");
    return buildFailedGateResult({
      childObservation: input.childObservation,
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
    });
  }

  return buildSuccessfulGateResult({ childObservation: input.childObservation });
}