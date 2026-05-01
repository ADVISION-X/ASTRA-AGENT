import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionChildAssessment } from "./post-action-verification-runtime-context.js";

function buildOutputBoundaryFailureDecision(input: {
  outputBoundaryGate: {
    status?: "failed" | "review_required";
    failureReason?: "self_reported_success_only" | "output_boundary_violation" | "insufficient_evidence";
    reviewRequiredReason?: string | null;
    statusMessage?: string;
    dataQualityFlags?: string[];
    outputBoundaryDecision: string;
  };
  assessment: PostActionChildAssessment;
}) {
  return {
    verificationDecision: input.outputBoundaryGate.status === "review_required" ? "review_required" as const : "failed" as const,
    status: input.outputBoundaryGate.status ?? "failed",
    failureReason: input.outputBoundaryGate.failureReason ?? "output_boundary_violation",
    reviewRequiredReason: input.outputBoundaryGate.reviewRequiredReason ?? null,
    confidence: input.assessment.confidence,
    statusMessage: input.outputBoundaryGate.statusMessage ?? input.assessment.statusMessage,
    verificationDecisionTrace: [input.outputBoundaryGate.outputBoundaryDecision],
    dataQualityFlags: input.outputBoundaryGate.dataQualityFlags ?? input.assessment.dataQualityFlags,
  };
}

function buildVerifiedWithReviewReasonDecision(assessment: PostActionChildAssessment) {
  return {
    verificationDecision: "review_required" as const,
    status: "review_required" as const,
    failureReason: "conflicting_observation" as const,
    reviewRequiredReason: assessment.reviewRequiredReason,
    confidence: assessment.confidence,
    statusMessage: assessment.statusMessage,
    verificationDecisionTrace: ["review_required:verified_with_review_reason"],
    dataQualityFlags: [...assessment.dataQualityFlags, "decision_conflict"],
  };
}

function buildLowConfidenceDecision(input: {
  request: ParsedPostActionVerificationAbilityInput;
  assessment: PostActionChildAssessment;
  minimumConfidence: number;
}) {
  const allowReviewRequired = input.request.confidencePolicy.allowReviewRequired;
  return {
    verificationDecision: allowReviewRequired ? "review_required" as const : "failed" as const,
    status: allowReviewRequired ? "review_required" as const : "failed" as const,
    failureReason: allowReviewRequired ? "insufficient_evidence" as const : "unexpected_state" as const,
    reviewRequiredReason: allowReviewRequired ? "Verification confidence is below the required minimum." : null,
    confidence: input.assessment.confidence,
    statusMessage: "Verification confidence did not satisfy the governed threshold.",
    verificationDecisionTrace: [allowReviewRequired ? "review_required:low_confidence" : "failed:low_confidence"],
    dataQualityFlags: [...input.assessment.dataQualityFlags, "low_confidence"],
  };
}

function buildVerifiedDecision(assessment: PostActionChildAssessment) {
  return {
    verificationDecision: "verified" as const,
    status: "success" as const,
    failureReason: null,
    reviewRequiredReason: null,
    confidence: assessment.confidence,
    statusMessage: assessment.statusMessage,
    verificationDecisionTrace: ["verified"],
    dataQualityFlags: assessment.dataQualityFlags,
  };
}

function buildFailedDecision(assessment: PostActionChildAssessment) {
  return {
    verificationDecision: "failed" as const,
    status: "failed" as const,
    failureReason: assessment.failureReason ?? "unexpected_state",
    reviewRequiredReason: null,
    confidence: assessment.confidence,
    statusMessage: assessment.statusMessage,
    verificationDecisionTrace: ["failed"],
    dataQualityFlags: assessment.dataQualityFlags,
  };
}

function buildReviewRequiredDecision(assessment: PostActionChildAssessment) {
  return {
    verificationDecision: "review_required" as const,
    status: "review_required" as const,
    failureReason: assessment.failureReason ?? "insufficient_evidence",
    reviewRequiredReason: assessment.reviewRequiredReason ?? "Governed verification requires manual review.",
    confidence: assessment.confidence,
    statusMessage: assessment.statusMessage,
    verificationDecisionTrace: ["review_required"],
    dataQualityFlags: assessment.dataQualityFlags,
  };
}

function resolveVerificationDecisionFromAssessment(input: {
  request: ParsedPostActionVerificationAbilityInput;
  assessment: PostActionChildAssessment;
  minimumConfidence: number;
}) {
  const assessment = input.assessment;

  if (assessment.verificationDecision === "verified" && assessment.reviewRequiredReason !== null) {
    return buildVerifiedWithReviewReasonDecision(assessment);
  }

  if (assessment.verificationDecision === "verified" && assessment.confidence < input.minimumConfidence) {
    return buildLowConfidenceDecision({ request: input.request, assessment, minimumConfidence: input.minimumConfidence });
  }

  if (assessment.verificationDecision === "verified") {
    return buildVerifiedDecision(assessment);
  }

  if (assessment.verificationDecision === "failed") {
    return buildFailedDecision(assessment);
  }

  return buildReviewRequiredDecision(assessment);
}

function resolveVerificationDecision(input: {
  request: ParsedPostActionVerificationAbilityInput;
  assessment: PostActionChildAssessment;
  outputBoundaryGate: {
    ok: boolean;
    status?: "failed" | "review_required";
    failureReason?: "self_reported_success_only" | "output_boundary_violation" | "insufficient_evidence";
    reviewRequiredReason?: string | null;
    statusMessage?: string;
    dataQualityFlags?: string[];
    outputBoundaryDecision: string;
    criticalDataQualityDecision: "allow" | "review_required" | "fail";
  };
}) {
  const minimumConfidence = input.request.confidencePolicy.minimumConfidence;
  if (!input.outputBoundaryGate.ok) {
    return buildOutputBoundaryFailureDecision({ outputBoundaryGate: input.outputBoundaryGate, assessment: input.assessment });
  }

  return resolveVerificationDecisionFromAssessment({
    request: input.request,
    assessment: input.assessment,
    minimumConfidence,
  });
}

export function finalizeVerificationDecision(input: {
  request: ParsedPostActionVerificationAbilityInput;
  assessment: PostActionChildAssessment;
  outputBoundaryGate: {
    ok: boolean;
    status?: "failed" | "review_required";
    failureReason?: "self_reported_success_only" | "output_boundary_violation" | "insufficient_evidence";
    reviewRequiredReason?: string | null;
    statusMessage?: string;
    dataQualityFlags?: string[];
    outputBoundaryDecision: string;
    criticalDataQualityDecision: "allow" | "review_required" | "fail";
  };
}) {
  return resolveVerificationDecision(input);
}
