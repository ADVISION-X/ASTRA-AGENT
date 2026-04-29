import type { PostActionChildAssessment, ParsedPostActionVerificationAbilityInput } from "../contract.js";

export function finalizeVerificationDecision(input: {
  request: ParsedPostActionVerificationAbilityInput;
  assessment: PostActionChildAssessment;
}) {
  const minimumConfidence = input.request.confidencePolicy.minimumConfidence;
  const assessment = input.assessment;

  if (assessment.verificationDecision === "verified" && assessment.reviewRequiredReason !== null) {
    return {
      verificationDecision: "review_required" as const,
      status: "review_required" as const,
      failureReason: "conflicting_observation" as const,
      reviewRequiredReason: assessment.reviewRequiredReason,
      confidence: assessment.confidence,
      statusMessage: assessment.statusMessage,
      verificationDecisionTrace: "review_required:verified_with_review_reason" as const,
      dataQualityFlags: [...assessment.dataQualityFlags, "decision_conflict"],
    };
  }

  if (assessment.verificationDecision === "verified" && assessment.confidence < minimumConfidence) {
    return {
      verificationDecision: input.request.confidencePolicy.allowReviewRequired ? "review_required" as const : "failed" as const,
      status: input.request.confidencePolicy.allowReviewRequired ? "review_required" as const : "failed" as const,
      failureReason: input.request.confidencePolicy.allowReviewRequired ? "insufficient_evidence" as const : "unexpected_state" as const,
      reviewRequiredReason: input.request.confidencePolicy.allowReviewRequired ? "Verification confidence is below the required minimum." : null,
      confidence: assessment.confidence,
      statusMessage: "Verification confidence did not satisfy the governed threshold.",
      verificationDecisionTrace: input.request.confidencePolicy.allowReviewRequired ? "review_required:low_confidence" as const : "failed:low_confidence" as const,
      dataQualityFlags: [...assessment.dataQualityFlags, "low_confidence"],
    };
  }

  if (assessment.verificationDecision === "verified") {
    return {
      verificationDecision: "verified" as const,
      status: "success" as const,
      failureReason: null,
      reviewRequiredReason: null,
      confidence: assessment.confidence,
      statusMessage: assessment.statusMessage,
      verificationDecisionTrace: "verified" as const,
      dataQualityFlags: assessment.dataQualityFlags,
    };
  }

  if (assessment.verificationDecision === "failed") {
    return {
      verificationDecision: "failed" as const,
      status: "failed" as const,
      failureReason: assessment.failureReason ?? "unexpected_state",
      reviewRequiredReason: null,
      confidence: assessment.confidence,
      statusMessage: assessment.statusMessage,
      verificationDecisionTrace: "failed" as const,
      dataQualityFlags: assessment.dataQualityFlags,
    };
  }

  if (assessment.verificationDecision === "blocked") {
    return {
      verificationDecision: "blocked" as const,
      status: "blocked" as const,
      failureReason: assessment.failureReason ?? "policy_blocked",
      reviewRequiredReason: assessment.reviewRequiredReason,
      confidence: assessment.confidence,
      statusMessage: assessment.statusMessage,
      verificationDecisionTrace: "blocked" as const,
      dataQualityFlags: assessment.dataQualityFlags,
    };
  }

  return {
    verificationDecision: "review_required" as const,
    status: "review_required" as const,
    failureReason: assessment.failureReason ?? "insufficient_evidence",
    reviewRequiredReason: assessment.reviewRequiredReason ?? "Governed verification requires manual review.",
    confidence: assessment.confidence,
    statusMessage: assessment.statusMessage,
    verificationDecisionTrace: "review_required" as const,
    dataQualityFlags: assessment.dataQualityFlags,
  };
}
