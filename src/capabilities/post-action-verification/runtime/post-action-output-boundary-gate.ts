import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionChildAssessment } from "./post-action-verification-runtime-context.js";

const CRITICAL_FLAGS = new Set(["critical_data_quality", "output_boundary_violation", "insufficient_evidence", "conflicting_observation"]);

export function validatePostActionOutputBoundary(input: {
  request: ParsedPostActionVerificationAbilityInput;
  assessment: PostActionChildAssessment;
}) {
  const hasCriticalFlag = input.assessment.dataQualityFlags.some((flag) => CRITICAL_FLAGS.has(flag));

  if (input.assessment.verificationDecision !== "verified") {
    return {
      ok: true,
      outputBoundaryDecision: "allow" as const,
      criticalDataQualityDecision: hasCriticalFlag ? "review_required" as const : "allow" as const,
    };
  }

  if (input.request.actionProof.selfReportedOnly) {
    return {
      ok: false,
      status: "review_required" as const,
      failureReason: "self_reported_success_only" as const,
      reviewRequiredReason: "Self-reported action completion cannot produce verified truth on its own.",
      statusMessage: "Verified output was rejected because the source action was self-reported only.",
      dataQualityFlags: [...input.assessment.dataQualityFlags, "self_reported_only"],
      outputBoundaryDecision: "review_required:self_reported_only" as const,
      criticalDataQualityDecision: "review_required" as const,
    };
  }

  if (hasCriticalFlag) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "output_boundary_violation" as const,
      reviewRequiredReason: null,
      statusMessage: "Verified output carried critical data quality flags.",
      dataQualityFlags: [...input.assessment.dataQualityFlags, "output_boundary_violation"],
      outputBoundaryDecision: "failed:critical_data_quality_flag" as const,
      criticalDataQualityDecision: "fail" as const,
    };
  }

  if (input.assessment.supportingSourceProofRefs.length === 0) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "output_boundary_violation" as const,
      reviewRequiredReason: null,
      statusMessage: "Verified output must include bound source proof refs.",
      dataQualityFlags: [...input.assessment.dataQualityFlags, "output_boundary_violation"],
      outputBoundaryDecision: "failed:missing_supporting_source_proof_ref" as const,
      criticalDataQualityDecision: "fail" as const,
    };
  }

  if (input.assessment.supportingEvidenceRefs.length === 0 && input.assessment.supportingObservationRefs.length < 2) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "insufficient_evidence" as const,
      reviewRequiredReason: null,
      statusMessage: "Verified output requires stronger evidence support.",
      dataQualityFlags: [...input.assessment.dataQualityFlags, "insufficient_evidence"],
      outputBoundaryDecision: "failed:insufficient_evidence" as const,
      criticalDataQualityDecision: "fail" as const,
    };
  }

  if (input.assessment.confidence < input.request.confidencePolicy.minimumConfidence) {
    return {
      ok: false,
      status: "review_required" as const,
      failureReason: "insufficient_evidence" as const,
      reviewRequiredReason: "Verified output fell below the governed confidence threshold.",
      statusMessage: "Verified output was downgraded to review_required because confidence is too low.",
      dataQualityFlags: [...input.assessment.dataQualityFlags, "low_confidence"],
      outputBoundaryDecision: "review_required:low_confidence" as const,
      criticalDataQualityDecision: "review_required" as const,
    };
  }

  return {
    ok: true,
    outputBoundaryDecision: "allow" as const,
    criticalDataQualityDecision: "allow" as const,
  };
}