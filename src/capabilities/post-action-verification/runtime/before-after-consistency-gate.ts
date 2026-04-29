import { POST_ACTION_AFTER_EVIDENCE_MAX_LAG_MS } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import { parsePostActionTimestampMs } from "./verification-clock.js";

export function validateBeforeAfterConsistency(request: ParsedPostActionVerificationAbilityInput) {
  const beforeEvidence = request.beforeAfterEvidence.beforeEvidence;
  const afterEvidence = request.beforeAfterEvidence.afterEvidence;
  const actionStartedAtMs = parsePostActionTimestampMs(request.actionProof.startedAt);
  const actionEndedAtMs = parsePostActionTimestampMs(request.actionProof.endedAt);

  if (request.verificationPolicy.requireAfterEvidence && afterEvidence === null) {
    return {
      ok: false,
      status: "review_required" as const,
      failureReason: "missing_after_evidence" as const,
      reviewRequiredReason: "After evidence is required for post-action verification.",
      statusMessage: "Required after evidence is missing.",
      dataQualityFlags: ["after_evidence_missing"],
      beforeAfterDecision: "review_required:missing_after_evidence" as const,
    };
  }

  if ((request.verificationPolicy.requireBeforeAfterComparison || request.expectedOutcome.requiresBeforeAfterComparison) && (beforeEvidence === null || afterEvidence === null)) {
    return {
      ok: false,
      status: "review_required" as const,
      failureReason: "missing_before_after_evidence" as const,
      reviewRequiredReason: "Before and after evidence are both required for this verification mode.",
      statusMessage: "Before/after evidence pair is incomplete.",
      dataQualityFlags: ["before_after_pair_missing"],
      beforeAfterDecision: "review_required:missing_before_after_evidence" as const,
    };
  }

  if (beforeEvidence !== null && parsePostActionTimestampMs(beforeEvidence.capturedAt) > actionStartedAtMs) {
    return {
      ok: false,
      status: "review_required" as const,
      failureReason: "before_after_conflict" as const,
      reviewRequiredReason: "Before evidence was captured after the action started.",
      statusMessage: "Before evidence ordering is invalid.",
      dataQualityFlags: ["before_after_conflict"],
      beforeAfterDecision: "review_required:before_after_conflict" as const,
    };
  }

  if (afterEvidence !== null) {
    const afterCapturedAtMs = parsePostActionTimestampMs(afterEvidence.capturedAt);
    if (afterCapturedAtMs < actionEndedAtMs || afterCapturedAtMs - actionEndedAtMs > POST_ACTION_AFTER_EVIDENCE_MAX_LAG_MS) {
      return {
        ok: false,
        status: "review_required" as const,
        failureReason: "before_after_conflict" as const,
        reviewRequiredReason: "After evidence is outside the governed post-action capture window.",
        statusMessage: "After evidence ordering is invalid.",
        dataQualityFlags: ["after_window_conflict"],
        beforeAfterDecision: "review_required:after_window_conflict" as const,
      };
    }
  }

  return {
    ok: true,
    beforeAfterDecision: "allow" as const,
  };
}
