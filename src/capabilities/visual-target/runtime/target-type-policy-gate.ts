import type { ParsedVisualTargetAbilityInput, VisualTargetCandidate, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";

export function validateTargetTypePolicy(input: {
  request: ParsedVisualTargetAbilityInput;
  candidates: VisualTargetCandidate[];
  requireClickPoint: boolean;
}):
  | {
      ok: true;
      decision: "allow";
      candidates: VisualTargetCandidate[];
      rejectedCandidateRefs: string[];
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | {
      ok: false;
      status: "failed" | "review_required";
      decision: "block" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      rejectedCandidateRefs: string[];
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  const rejectedCandidateRefs: string[] = [];
  const dataQualityFlags = new Set<VisualTargetDataQualityFlag>();
  const candidates = input.candidates.filter((candidate) => {
    if (candidate.targetType !== input.request.targetType) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      return false;
    }
    if (input.requireClickPoint && !candidate.clickPoint) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      dataQualityFlags.add("candidate_missing_click_point");
      return false;
    }
    if (!input.requireClickPoint && candidate.clickPoint) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      dataQualityFlags.add("candidate_click_point_forbidden");
      return false;
    }
    return true;
  });

  if (input.request.targetNature === "action" && !input.requireClickPoint) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "invalid_target_type",
      statusMessage: "Action visual targets must require clickPoint and geometry handoff.",
      reviewRequiredReason: null,
      rejectedCandidateRefs,
      dataQualityFlags: [...dataQualityFlags],
    };
  }
  if (candidates.length === 0) {
    return {
      ok: false,
      status: dataQualityFlags.has("candidate_missing_click_point") || dataQualityFlags.has("candidate_click_point_forbidden") ? "review_required" : "failed",
      decision: dataQualityFlags.has("candidate_missing_click_point") || dataQualityFlags.has("candidate_click_point_forbidden") ? "review_required" : "block",
      failureReason: dataQualityFlags.has("candidate_missing_click_point") ? "click_point_missing" : dataQualityFlags.has("candidate_click_point_forbidden") ? "non_action_click_point_forbidden" : "target_type_mismatch",
      statusMessage: "Visual Target target-type policy rejected every candidate.",
      reviewRequiredReason: dataQualityFlags.has("candidate_missing_click_point") || dataQualityFlags.has("candidate_click_point_forbidden")
        ? "Visual Target requires review because candidate shape does not match target-type policy."
        : null,
      rejectedCandidateRefs,
      dataQualityFlags: [...dataQualityFlags],
    };
  }

  return {
    ok: true,
    decision: "allow",
    candidates,
    rejectedCandidateRefs,
    dataQualityFlags: [...dataQualityFlags],
  };
}