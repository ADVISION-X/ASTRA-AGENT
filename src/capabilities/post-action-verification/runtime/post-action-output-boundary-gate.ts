import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionChildAssessment } from "./post-action-verification-runtime-context.js";

const CRITICAL_FLAGS = new Set(["critical_data_quality", "output_boundary_violation", "insufficient_evidence", "conflicting_observation"]);

function createPostActionOutputBoundaryFailure(input: {
  status: "review_required" | "failed";
  failureReason: "self_reported_success_only" | "output_boundary_violation" | "insufficient_evidence";
  reviewRequiredReason: string | null;
  statusMessage: string;
  dataQualityFlags: string[];
  outputBoundaryDecision: string;
  criticalDataQualityDecision: "allow" | "review_required" | "fail";
}) {
  return { ok: false as const, status: input.status, failureReason: input.failureReason, reviewRequiredReason: input.reviewRequiredReason, statusMessage: input.statusMessage, dataQualityFlags: input.dataQualityFlags, outputBoundaryDecision: input.outputBoundaryDecision, criticalDataQualityDecision: input.criticalDataQualityDecision };
}

function resolveVerifiedBoundaryFailure(input: {
  request: ParsedPostActionVerificationAbilityInput;
  assessment: PostActionChildAssessment;
  hasCriticalFlag: boolean;
}) {
  if (!input.request.actionProof.selfReportedOnly) {
    return null;
  }

  return createPostActionOutputBoundaryFailure(
    {
      status: "review_required",
      failureReason: "self_reported_success_only",
      reviewRequiredReason: "Self-reported action completion cannot produce verified truth on its own.",
      statusMessage: "Verified output was rejected because the source action was self-reported only.",
      dataQualityFlags: [...input.assessment.dataQualityFlags, "self_reported_only"],
      outputBoundaryDecision: "review_required:self_reported_only",
      criticalDataQualityDecision: "review_required",
    },
  );
}

function resolveCriticalFlagFailure(input: {
  assessment: PostActionChildAssessment;
}) {
  if (!input.assessment.dataQualityFlags.some((flag) => CRITICAL_FLAGS.has(flag))) {
    return null;
  }

  return createPostActionOutputBoundaryFailure(
    {
      status: "failed",
      failureReason: "output_boundary_violation",
      reviewRequiredReason: null,
      statusMessage: "Verified output carried critical data quality flags.",
      dataQualityFlags: [...input.assessment.dataQualityFlags, "output_boundary_violation"],
      outputBoundaryDecision: "failed:critical_data_quality_flag",
      criticalDataQualityDecision: "fail",
    },
  );
}

function resolveMissingSourceProofFailure(input: {
  assessment: PostActionChildAssessment;
}) {
  if (input.assessment.supportingSourceProofRefs.length > 0) {
    return null;
  }

  return createPostActionOutputBoundaryFailure(
    {
      status: "failed",
      failureReason: "output_boundary_violation",
      reviewRequiredReason: null,
      statusMessage: "Verified output must include bound source proof refs.",
      dataQualityFlags: [...input.assessment.dataQualityFlags, "output_boundary_violation"],
      outputBoundaryDecision: "failed:missing_supporting_source_proof_ref",
      criticalDataQualityDecision: "fail",
    },
  );
}

function resolveInsufficientEvidenceFailure(input: {
  request: ParsedPostActionVerificationAbilityInput;
  assessment: PostActionChildAssessment;
}) {
  const hasObservationOnlySupport = input.request.verificationPolicy.verificationMode === "observation_only"
    && input.assessment.supportingObservationRefs.length >= 1
    && input.assessment.supportingSourceProofRefs.length >= 1;

  if (input.assessment.supportingEvidenceRefs.length > 0 || input.assessment.supportingObservationRefs.length >= 2 || hasObservationOnlySupport) {
    return null;
  }

  return createPostActionOutputBoundaryFailure(
    {
      status: "failed",
      failureReason: "insufficient_evidence",
      reviewRequiredReason: null,
      statusMessage: "Verified output requires stronger evidence support.",
      dataQualityFlags: [...input.assessment.dataQualityFlags, "insufficient_evidence"],
      outputBoundaryDecision: "failed:insufficient_evidence",
      criticalDataQualityDecision: "fail",
    },
  );
}

function resolveLowConfidenceFailure(input: {
  request: ParsedPostActionVerificationAbilityInput;
  assessment: PostActionChildAssessment;
}) {
  if (input.assessment.confidence >= input.request.confidencePolicy.minimumConfidence) {
    return null;
  }

  return createPostActionOutputBoundaryFailure(
    {
      status: "review_required",
      failureReason: "insufficient_evidence",
      reviewRequiredReason: "Verified output fell below the governed confidence threshold.",
      statusMessage: "Verified output was downgraded to review_required because confidence is too low.",
      dataQualityFlags: [...input.assessment.dataQualityFlags, "low_confidence"],
      outputBoundaryDecision: "review_required:low_confidence",
      criticalDataQualityDecision: "review_required",
    },
  );
}

function resolvePostActionOutputBoundary(input: {
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

  for (const failure of [
    resolveVerifiedBoundaryFailure({ request: input.request, assessment: input.assessment, hasCriticalFlag }),
    resolveCriticalFlagFailure({ assessment: input.assessment }),
    resolveMissingSourceProofFailure({ assessment: input.assessment }),
    resolveInsufficientEvidenceFailure({ request: input.request, assessment: input.assessment }),
    resolveLowConfidenceFailure({ request: input.request, assessment: input.assessment }),
  ]) {
    if (failure) return failure;
  }

  return {
    ok: true,
    outputBoundaryDecision: "allow" as const,
    criticalDataQualityDecision: "allow" as const,
  };
}

export function validatePostActionOutputBoundary(input: {
  request: ParsedPostActionVerificationAbilityInput;
  assessment: PostActionChildAssessment;
}) {
  return resolvePostActionOutputBoundary(input);
}