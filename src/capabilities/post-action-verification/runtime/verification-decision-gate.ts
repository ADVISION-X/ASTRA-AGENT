import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionChildAssessment } from "./post-action-verification-runtime-context.js";

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
  const minimumConfidence = input.request.confidencePolicy.minimumConfidence;
  const assessment = input.assessment;

  if (!input.outputBoundaryGate.ok) {
    return {
      verificationDecision: input.outputBoundaryGate.status === "review_required" ? "review_required" as const : "failed" as const,
      status: input.outputBoundaryGate.status ?? "failed",
      failureReason: input.outputBoundaryGate.failureReason ?? "output_boundary_violation",
      reviewRequiredReason: input.outputBoundaryGate.reviewRequiredReason ?? null,
      confidence: assessment.confidence,
      statusMessage: input.outputBoundaryGate.statusMessage ?? assessment.statusMessage,
      verificationDecisionTrace: [input.outputBoundaryGate.outputBoundaryDecision],
      dataQualityFlags: input.outputBoundaryGate.dataQualityFlags ?? assessment.dataQualityFlags,
    };
  }

  if (assessment.verificationDecision === "verified" && assessment.reviewRequiredReason !== null) {
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

  if (assessment.verificationDecision === "verified" && assessment.confidence < minimumConfidence) {
    return {
      verificationDecision: input.request.confidencePolicy.allowReviewRequired ? "review_required" as const : "failed" as const,
      status: input.request.confidencePolicy.allowReviewRequired ? "review_required" as const : "failed" as const,
      failureReason: input.request.confidencePolicy.allowReviewRequired ? "insufficient_evidence" as const : "unexpected_state" as const,
      reviewRequiredReason: input.request.confidencePolicy.allowReviewRequired ? "Verification confidence is below the required minimum." : null,
      confidence: assessment.confidence,
      statusMessage: "Verification confidence did not satisfy the governed threshold.",
      verificationDecisionTrace: [input.request.confidencePolicy.allowReviewRequired ? "review_required:low_confidence" : "failed:low_confidence"],
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
      verificationDecisionTrace: ["verified"],
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
      verificationDecisionTrace: ["failed"],
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
    verificationDecisionTrace: ["review_required"],
    dataQualityFlags: assessment.dataQualityFlags,
  };
}
