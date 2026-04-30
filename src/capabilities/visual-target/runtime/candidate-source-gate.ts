import type { ParsedVisualTargetAbilityInput, VisualTargetCandidate, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import type { ResolvedVisualTargetProfile } from "./visual-target-input-gate.js";
import { parseVisualTargetIsoTimestamp } from "./visual-target-clock.js";

export function validateCandidateSources(input: {
  request: ParsedVisualTargetAbilityInput;
  nowEpochMs: number;
  profile: ResolvedVisualTargetProfile;
}):
  | {
      ok: true;
      decision: "allow";
      bindingDecision: "allow";
      candidates: VisualTargetCandidate[];
      rejectedCandidateRefs: string[];
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | {
      ok: false;
      status: "failed" | "review_required";
      decision: "block" | "review_required";
      bindingDecision: "block" | "review_required";
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
      bindingDecision: "block",
      failureReason: "no_candidates",
      statusMessage: "Visual Target request contains no candidates.",
      reviewRequiredReason: null,
      rejectedCandidateRefs: [],
      dataQualityFlags: [],
    };
  }

  if (!input.profile.allowedSourceAbilityGroups.includes(input.request.sourceAbilityGroupId)) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      bindingDecision: "block",
      failureReason: "invalid_source_ability",
      statusMessage: "Visual Target sourceAbilityGroupId is outside the child policy allowlist.",
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
      dataQualityFlags.add("candidate_source_binding_mismatch");
      continue;
    }
    if (!input.profile.allowedCandidateKinds.includes(candidate.candidateKind)) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      dataQualityFlags.add("candidate_source_kind_mismatch");
      continue;
    }
    if (candidate.candidateKind === "operator_manual" && !input.profile.allowOperatorManual) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      dataQualityFlags.add("operator_manual_review_required");
      continue;
    }
    if (candidate.candidateKind === "operator_manual" && !input.request.sourceProof.operatorApproval) {
      return {
        ok: false,
        status: "review_required",
        decision: "review_required",
        bindingDecision: "review_required",
        failureReason: "operator_approval_required",
        statusMessage: "operator_manual candidate requires operator approval proof.",
        reviewRequiredReason: "Visual Target requires operator approval proof for operator_manual candidate sources.",
        rejectedCandidateRefs: [candidate.candidateRef],
        dataQualityFlags: ["operator_manual_review_required"],
      };
    }
    if (candidate.candidateKind === "ai_candidate" && !candidate.sourceFrameRef) {
      rejectedCandidateRefs.push(candidate.candidateRef);
      dataQualityFlags.add("candidate_source_frame_missing");
      continue;
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
    const ageMs = Math.max(0, input.nowEpochMs - parseVisualTargetIsoTimestamp(candidate.capturedAt));
    if (ageMs > input.profile.freshnessTtlMs) {
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
        status: "failed",
        decision: "block",
        bindingDecision: "block",
        failureReason: "blocked_candidate",
        statusMessage: "All visual target candidates were blocked by source policy.",
        reviewRequiredReason: null,
        rejectedCandidateRefs,
        dataQualityFlags: [...dataQualityFlags],
      };
    }
    if (
      dataQualityFlags.has("candidate_invisible")
      || dataQualityFlags.has("operator_manual_review_required")
      || dataQualityFlags.has("candidate_source_binding_mismatch")
      || dataQualityFlags.has("candidate_source_frame_missing")
    ) {
      return {
        ok: false,
        status: "review_required",
        decision: "review_required",
        bindingDecision: "review_required",
        failureReason: dataQualityFlags.has("candidate_source_frame_missing") ? "candidate_source_frame_missing" : dataQualityFlags.has("candidate_source_binding_mismatch") ? "candidate_source_binding_mismatch" : dataQualityFlags.has("candidate_invisible") ? "invisible_candidate" : "operator_approval_required",
        statusMessage: "Visual Target requires review because no governed candidate survived source gating.",
        reviewRequiredReason: "Visual Target source gating left no bindable visible candidate for success.",
        rejectedCandidateRefs,
        dataQualityFlags: [...dataQualityFlags],
      };
    }
    return {
      ok: false,
      status: "failed",
      decision: "block",
      bindingDecision: "block",
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
    bindingDecision: "allow",
    candidates,
    rejectedCandidateRefs,
    dataQualityFlags: [...dataQualityFlags],
  };
}