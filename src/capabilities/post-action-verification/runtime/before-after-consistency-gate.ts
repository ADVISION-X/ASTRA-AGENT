import { POST_ACTION_AFTER_EVIDENCE_MAX_LAG_MS } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import { parsePostActionTimestampMs } from "./verification-clock.js";

function createBeforeAfterConsistencyFailure(input: {
  status: "failed" | "review_required";
  failureReason: "missing_after_evidence" | "missing_before_after_evidence" | "before_after_conflict";
  reviewRequiredReason: string;
  statusMessage: string;
  dataQualityFlag: string;
  beforeAfterDecision: string;
  beforeAfterPairDecision: string;
}) {
  return {
    ok: false as const,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    dataQualityFlags: [input.dataQualityFlag],
    beforeAfterDecision: input.beforeAfterDecision,
    beforeAfterPairDecision: input.beforeAfterPairDecision,
  };
}

function resolveMissingAfterEvidenceFailure(request: ParsedPostActionVerificationAbilityInput) {
  if (!request.verificationPolicy.requireAfterEvidence || request.beforeAfterEvidence.afterEvidence !== null) {
    return null;
  }

  return createBeforeAfterConsistencyFailure(
    {
      status: "review_required",
      failureReason: "missing_after_evidence",
      reviewRequiredReason: "After evidence is required for post-action verification.",
      statusMessage: "Required after evidence is missing.",
      dataQualityFlag: "after_evidence_missing",
      beforeAfterDecision: "review_required:missing_after_evidence",
      beforeAfterPairDecision: "missing_after_evidence",
    },
  );
}

function resolveMissingPairFailure(request: ParsedPostActionVerificationAbilityInput, beforeEvidence: ParsedPostActionVerificationAbilityInput["beforeAfterEvidence"]["beforeEvidence"], afterEvidence: ParsedPostActionVerificationAbilityInput["beforeAfterEvidence"]["afterEvidence"]) {
  if (!(request.verificationPolicy.requireBeforeAfterComparison || request.expectedOutcome.requiresBeforeAfterComparison) || (beforeEvidence !== null && afterEvidence !== null)) {
    return null;
  }

  return createBeforeAfterConsistencyFailure(
    {
      status: "review_required",
      failureReason: "missing_before_after_evidence",
      reviewRequiredReason: "Before and after evidence are both required for this verification mode.",
      statusMessage: "Before/after evidence pair is incomplete.",
      dataQualityFlag: "before_after_pair_missing",
      beforeAfterDecision: "review_required:missing_before_after_evidence",
      beforeAfterPairDecision: "missing_before_after_pair",
    },
  );
}

function resolveEvidenceKindMismatchFailure(beforeEvidence: ParsedPostActionVerificationAbilityInput["beforeAfterEvidence"]["beforeEvidence"], afterEvidence: ParsedPostActionVerificationAbilityInput["beforeAfterEvidence"]["afterEvidence"]) {
  if (beforeEvidence === null || afterEvidence === null || beforeEvidence.evidenceKind === afterEvidence.evidenceKind) {
    return null;
  }

  return createBeforeAfterConsistencyFailure(
    {
      status: "review_required",
      failureReason: "before_after_conflict",
      reviewRequiredReason: "Before and after evidence kinds must match for governed comparison.",
      statusMessage: "Before/after evidence kinds do not match.",
      dataQualityFlag: "before_after_conflict",
      beforeAfterDecision: "review_required:evidence_kind_mismatch",
      beforeAfterPairDecision: "evidence_kind_mismatch",
    },
  );
}

function resolveBeforeEvidenceTimeFailure(beforeEvidence: ParsedPostActionVerificationAbilityInput["beforeAfterEvidence"]["beforeEvidence"], actionStartedAtMs: number) {
  if (beforeEvidence === null || parsePostActionTimestampMs(beforeEvidence.capturedAt) <= actionStartedAtMs) {
    return null;
  }

  return createBeforeAfterConsistencyFailure(
    {
      status: "review_required",
      failureReason: "before_after_conflict",
      reviewRequiredReason: "Before evidence was captured after the action started.",
      statusMessage: "Before evidence ordering is invalid.",
      dataQualityFlag: "before_after_conflict",
      beforeAfterDecision: "review_required:before_after_conflict",
      beforeAfterPairDecision: "before_after_time_conflict",
    },
  );
}

function resolveAfterEvidenceTimeFailure(afterEvidence: ParsedPostActionVerificationAbilityInput["beforeAfterEvidence"]["afterEvidence"], actionEndedAtMs: number) {
  if (afterEvidence === null) {
    return null;
  }

  const afterCapturedAtMs = parsePostActionTimestampMs(afterEvidence.capturedAt);
  if (afterCapturedAtMs >= actionEndedAtMs && afterCapturedAtMs - actionEndedAtMs <= POST_ACTION_AFTER_EVIDENCE_MAX_LAG_MS) {
    return null;
  }

  return createBeforeAfterConsistencyFailure(
    {
      status: "review_required",
      failureReason: "before_after_conflict",
      reviewRequiredReason: "After evidence is outside the governed post-action capture window.",
      statusMessage: "After evidence ordering is invalid.",
      dataQualityFlag: "after_window_conflict",
      beforeAfterDecision: "review_required:after_window_conflict",
      beforeAfterPairDecision: "after_window_conflict",
    },
  );
}

function resolveBeforeAfterConsistency(request: ParsedPostActionVerificationAbilityInput) {
  const beforeEvidence = request.beforeAfterEvidence.beforeEvidence;
  const afterEvidence = request.beforeAfterEvidence.afterEvidence;
  const actionStartedAtMs = parsePostActionTimestampMs(request.actionProof.startedAt);
  const actionEndedAtMs = parsePostActionTimestampMs(request.actionProof.endedAt);

  for (const failure of [
    resolveMissingAfterEvidenceFailure(request),
    resolveMissingPairFailure(request, beforeEvidence, afterEvidence),
    resolveEvidenceKindMismatchFailure(beforeEvidence, afterEvidence),
    resolveBeforeEvidenceTimeFailure(beforeEvidence, actionStartedAtMs),
    resolveAfterEvidenceTimeFailure(afterEvidence, actionEndedAtMs),
  ]) {
    if (failure) return failure;
  }

  return {
    ok: true,
    beforeAfterDecision: "allow" as const,
    beforeAfterPairDecision: "allow" as const,
  };
}

export function validateBeforeAfterConsistency(request: ParsedPostActionVerificationAbilityInput) {
  return resolveBeforeAfterConsistency(request);
}
