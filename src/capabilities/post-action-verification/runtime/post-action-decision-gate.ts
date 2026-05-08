import type { ParsedPostActionVerificationAbilityInput, PostActionFailureReason, PostActionVerificationStatus } from "../contract.js";
import { POST_ACTION_CRITICAL_DATA_QUALITY_FLAGS } from "../shared/post-action-result.js";
import type { PostActionChildObservation, PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

const VISUAL_EVIDENCE_KINDS = new Set(["screenshot", "screenshot_diff", "visual_target"]);
const CRITICAL_DATA_QUALITY_FLAGS = new Set<string>(POST_ACTION_CRITICAL_DATA_QUALITY_FLAGS);

export type PostActionDecisionGateResult = {
  status: PostActionVerificationStatus;
  verificationDecision: PostActionChildObservation["verificationDecision"];
  failureReason: PostActionFailureReason | null;
  reviewRequiredReason: string | null;
  confidence: number;
  dataQualityFlags: string[];
  gateDecisions: string[];
  verificationDecisionTrace: string[];
};

const dedupeStrings = (values: readonly string[]) => [...new Set(values)];

const requiresBeforeAfterComparison = (request: ParsedPostActionVerificationAbilityInput) => (
  request.verificationPolicy.requireBeforeAfterComparison || request.expectedOutcome.requiresBeforeAfterComparison
);

const hasVisualEvidence = (verifiedByEvidenceKinds: readonly string[]) => (
  verifiedByEvidenceKinds.some((evidenceKind) => VISUAL_EVIDENCE_KINDS.has(evidenceKind))
);

const buildGateResult = (input: {
  status: PostActionVerificationStatus;
  verificationDecision: PostActionChildObservation["verificationDecision"];
  failureReason: PostActionFailureReason | null;
  reviewRequiredReason: string | null;
  confidence: number;
  dataQualityFlags: string[];
  gateDecisions: string[];
  verificationDecisionTrace: string[];
}): PostActionDecisionGateResult => ({
  ...input,
  dataQualityFlags: dedupeStrings(input.dataQualityFlags),
  gateDecisions: dedupeStrings(input.gateDecisions),
  verificationDecisionTrace: dedupeStrings(input.verificationDecisionTrace),
});

const buildRejectedGateResult = (input: {
  request: ParsedPostActionVerificationAbilityInput;
  childObservation: PostActionChildObservation;
  status: "failed" | "review_required";
  failureReason: PostActionFailureReason | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
  gateDecisions: string[];
  verificationDecisionTrace: string[];
}): PostActionDecisionGateResult => buildGateResult({
  status: input.status,
  verificationDecision: input.status === "failed" ? "failed" : "review_required",
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  confidence: input.childObservation.confidence,
  dataQualityFlags: input.dataQualityFlags,
  gateDecisions: input.gateDecisions,
  verificationDecisionTrace: input.verificationDecisionTrace,
});

const buildSuccessfulGateResult = (input: {
  childObservation: PostActionChildObservation;
  gateDecisions: string[];
  verificationDecisionTrace: string[];
}): PostActionDecisionGateResult => buildGateResult({
  status: "success",
  verificationDecision: "verified",
  failureReason: null,
  reviewRequiredReason: null,
  confidence: input.childObservation.confidence,
  dataQualityFlags: input.childObservation.dataQualityFlags,
  gateDecisions: input.gateDecisions,
  verificationDecisionTrace: input.verificationDecisionTrace,
});

export function evaluatePostActionDecisionGate(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  childObservation: PostActionChildObservation;
}): PostActionDecisionGateResult {
  const dataQualityFlags = [...input.childObservation.dataQualityFlags];
  const gateDecisions = [
    `child_decision:${input.childObservation.verificationDecision}`,
    `child_confidence:${input.childObservation.confidence.toFixed(2)}`,
  ];
  const verificationDecisionTrace = [
    `observed_outcome:${input.childObservation.observedOutcome}`,
    `confidence_source:${input.childObservation.confidenceSource}`,
  ];
  const hasBeforeEvidence = input.request.beforeAfterEvidence.beforeEvidence !== null;
  const hasAfterEvidence = input.request.beforeAfterEvidence.afterEvidence !== null;

  if (input.childObservation.supportingSourceProofRefs.length === 0) {
    dataQualityFlags.push("missing_source_proof");
    gateDecisions.push("source_proof_gate:failed");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "failed",
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  if (!input.childObservation.supportingSourceProofRefs.every((ref) => input.context.evidenceReadPort.verifyProofRef(input.request, ref))) {
    dataQualityFlags.push("invalid_source_proof");
    gateDecisions.push("source_proof_gate:failed");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "failed",
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  if (!input.childObservation.supportingEvidenceRefs.every((ref) => input.context.evidenceReadPort.verifyEvidenceBinding(input.request, ref))) {
    dataQualityFlags.push("invalid_evidence_binding");
    gateDecisions.push("evidence_binding_gate:failed");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "failed",
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  if (input.request.actionProof.selfReportedOnly && !input.request.verificationPolicy.allowSelfReportedSuccess) {
    dataQualityFlags.push("self_reported_only");
    gateDecisions.push("action_proof_gate:failed");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "failed",
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  if (input.request.verificationPolicy.requireAfterEvidence && !hasAfterEvidence) {
    dataQualityFlags.push("missing_after_evidence");
    gateDecisions.push("after_evidence_gate:failed");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "failed",
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  if (requiresBeforeAfterComparison(input.request) && (!hasBeforeEvidence || !hasAfterEvidence)) {
    dataQualityFlags.push("missing_before_after_evidence");
    gateDecisions.push("before_after_consistency_gate:failed");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "failed",
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  if (input.request.expectedOutcome.requiresVisualEvidence && !hasVisualEvidence(input.childObservation.verifiedByEvidenceKinds)) {
    dataQualityFlags.push("missing_visual_evidence");
    gateDecisions.push("visual_evidence_gate:failed");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "failed",
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  if (input.childObservation.verificationDecision === "failed") {
    gateDecisions.push("child_assessment_gate:failed");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "failed",
      failureReason: input.childObservation.failureReason ?? "insufficient_evidence",
      reviewRequiredReason: null,
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  if (input.childObservation.verificationDecision === "review_required") {
    if (!input.request.confidencePolicy.allowReviewRequired) {
      dataQualityFlags.push("review_required_not_allowed");
      gateDecisions.push("review_required_gate:normalized_to_failed");
      return buildRejectedGateResult({
        request: input.request,
        childObservation: input.childObservation,
        status: "failed",
        failureReason: "output_boundary_violation",
        reviewRequiredReason: input.childObservation.reviewRequiredReason,
        dataQualityFlags,
        gateDecisions,
        verificationDecisionTrace,
      });
    }

    gateDecisions.push("review_required_gate:pass");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "review_required",
      failureReason: null,
      reviewRequiredReason: input.childObservation.reviewRequiredReason ?? "Post Action Verification marked the outcome as review_required.",
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  if (input.childObservation.supportingEvidenceRefs.length === 0 && input.childObservation.supportingObservationRefs.length === 0) {
    dataQualityFlags.push("missing_observation");
    gateDecisions.push("output_boundary_gate:failed");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "failed",
      failureReason: "missing_observation_support",
      reviewRequiredReason: null,
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  if (input.childObservation.confidence < input.request.confidencePolicy.minimumConfidence) {
    dataQualityFlags.push("low_confidence");
    if (input.request.confidencePolicy.allowReviewRequired) {
      gateDecisions.push("confidence_policy_gate:review_required");
      return buildRejectedGateResult({
        request: input.request,
        childObservation: input.childObservation,
        status: "review_required",
        failureReason: null,
        reviewRequiredReason: `Confidence ${input.childObservation.confidence.toFixed(2)} is below minimum ${input.request.confidencePolicy.minimumConfidence.toFixed(2)}.`,
        dataQualityFlags,
        gateDecisions,
        verificationDecisionTrace,
      });
    }

    gateDecisions.push("confidence_policy_gate:failed");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "failed",
      failureReason: "output_boundary_violation",
      reviewRequiredReason: null,
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  if (dedupeStrings(dataQualityFlags).some((flag) => CRITICAL_DATA_QUALITY_FLAGS.has(flag))) {
    gateDecisions.push("output_boundary_gate:failed");
    return buildRejectedGateResult({
      request: input.request,
      childObservation: input.childObservation,
      status: "failed",
      failureReason: "output_boundary_violation",
      reviewRequiredReason: null,
      dataQualityFlags,
      gateDecisions,
      verificationDecisionTrace,
    });
  }

  gateDecisions.push("output_boundary_gate:pass");
  return buildSuccessfulGateResult({
    childObservation: input.childObservation,
    gateDecisions,
    verificationDecisionTrace,
  });
}