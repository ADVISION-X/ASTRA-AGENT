import type { ParsedVisualTargetAbilityInput, VisualTargetCandidate, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import { calculateVisualTargetAgeMs } from "./visual-target-time.js";

export function validateCandidateSources(input: {
  request: ParsedVisualTargetAbilityInput;
  nowIso: string;
  freshnessTtlMs: number;
  allowOperatorManual: boolean;
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
      status: "failed" | "review_required" | "blocked";
      decision: "block" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      rejectedCandidateRefs: string[];
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  if (input.request.candidates.length === 0) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "no_candidates",
      statusMessage: "Visual Target request contains no candidates.",
      reviewRequiredReason: null,
      rejectedCandidateRefs: [],
      dataQualityFlags: [],
    };
  }

  const candidates: VisualTargetCandidate[] = [];
  const rejectedCandidateRefs: string[] = [];
  const dataQualityFlags = new Set<VisualTargetDataQualityFlag>();

  for (const candidate of input.request.candidates) {
    if (candidate.sourceProofRef !== input.request.sourceProof.sourceProofRef) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      continue;
    }
    if (!candidate.candidateRef) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      continue;
    }
    if (candidate.candidateKind === "operator_manual" && !input.allowOperatorManual) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      dataQualityFlags.add("operator_manual_review_required");
      continue;
    }
    if (candidate.candidateKind === "operator_manual" && !input.request.sourceProof.operatorApproval) {
      return {
        ok: false,
        status: "review_required",
        decision: "review_required",
        failureReason: "operator_approval_required",
        statusMessage: "operator_manual candidate requires operator approval proof.",
        reviewRequiredReason: "Visual Target requires operator approval proof for operator_manual candidate sources.",
        rejectedCandidateRefs: [candidate.candidateRef],
        dataQualityFlags: ["operator_manual_review_required"],
      };
    }
    if (candidate.blockedReason) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      dataQualityFlags.add("candidate_blocked");
      continue;
    }
    if (!candidate.isVisible) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      dataQualityFlags.add("candidate_invisible");
      continue;
    }
    const ageMs = calculateVisualTargetAgeMs({ nowIso: input.nowIso, observedIso: candidate.capturedAt });
    if (ageMs > input.freshnessTtlMs) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      dataQualityFlags.add("stale_candidate");
      continue;
    }
    candidates.push(candidate);
  }

  if (candidates.length === 0) {
    if (dataQualityFlags.has("candidate_blocked")) {
      return {
        ok: false,
        status: "blocked",
        decision: "block",
        failureReason: "blocked_candidate",
        statusMessage: "All visual target candidates were blocked by source policy.",
        reviewRequiredReason: null,
        rejectedCandidateRefs,
        dataQualityFlags: [...dataQualityFlags],
      };
    }
    if (dataQualityFlags.has("candidate_invisible") || dataQualityFlags.has("operator_manual_review_required")) {
      return {
        ok: false,
        status: "review_required",
        decision: "review_required",
        failureReason: dataQualityFlags.has("candidate_invisible") ? "invisible_candidate" : "operator_approval_required",
        statusMessage: "Visual Target requires review because no visible governed candidate survived source gating.",
        reviewRequiredReason: "Visual Target source gating left no visible candidate for success.",
        rejectedCandidateRefs,
        dataQualityFlags: [...dataQualityFlags],
      };
    }
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "missing_candidate_source_proof",
      statusMessage: "Visual Target candidate source proof validation rejected every candidate.",
      reviewRequiredReason: null,
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