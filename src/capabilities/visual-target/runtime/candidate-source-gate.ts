import type { ParsedVisualTargetAbilityInput, VisualTargetCandidate, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import type { ResolvedVisualTargetProfile } from "./visual-target-input-gate.js";
import { parseVisualTargetIsoTimestamp } from "./visual-target-clock.js";
import {
  collectVisualTargetFlags,
  createVisualTargetGateBlocked,
  createVisualTargetGateReviewRequired,
  createVisualTargetGateSuccess,
  type VisualTargetGateBlocked,
  type VisualTargetGateReviewRequired,
  type VisualTargetGateSuccess,
} from "./visual-target-gate-results.js";

type CandidateSourceAllow = VisualTargetGateSuccess<"allow", {
  bindingDecision: "allow";
  candidates: VisualTargetCandidate[];
  rejectedCandidateRefs: string[];
}>;

type CandidateSourceBlocked = VisualTargetGateBlocked<"block", {
  bindingDecision: "block";
  rejectedCandidateRefs: string[];
}>;

type CandidateSourceReviewRequired = VisualTargetGateReviewRequired<"review_required", {
  bindingDecision: "review_required";
  rejectedCandidateRefs: string[];
}>;

type CandidateSourceInspection = {
  acceptedCandidate: VisualTargetCandidate | null;
  rejectedCandidateRef: string | null;
  dataQualityFlag: VisualTargetDataQualityFlag | null;
  failure: CandidateSourceReviewRequired | null;
};

function createCandidateSourceBlocked(
  failureReason: VisualTargetFailureReason,
  statusMessage: string,
  rejectedCandidateRefs: string[],
  dataQualityFlags: VisualTargetDataQualityFlag[],
): CandidateSourceBlocked {
  return createVisualTargetGateBlocked({
    decision: "block",
    failureReason,
    statusMessage,
    dataQualityFlags,
    extra: { bindingDecision: "block", rejectedCandidateRefs },
  });
}

function createCandidateSourceReview(
  failureReason: VisualTargetFailureReason,
  statusMessage: string,
  reviewRequiredReason: string,
  rejectedCandidateRefs: string[],
  dataQualityFlags: VisualTargetDataQualityFlag[],
): CandidateSourceReviewRequired {
  return createVisualTargetGateReviewRequired({
    decision: "review_required",
    failureReason,
    statusMessage,
    reviewRequiredReason,
    dataQualityFlags,
    extra: { bindingDecision: "review_required", rejectedCandidateRefs },
  });
}

function inspectCandidateSourceCandidate(input: {
  request: ParsedVisualTargetAbilityInput;
  nowEpochMs: number;
  profile: ResolvedVisualTargetProfile;
  candidate: VisualTargetCandidate;
}): CandidateSourceInspection {
  const { candidate } = input;
  if (candidate.sourceProofRef !== input.request.sourceProof.sourceProofRef) {
    return { acceptedCandidate: null, rejectedCandidateRef: candidate.candidateRef, dataQualityFlag: "candidate_source_binding_mismatch", failure: null };
  }
  if (!input.profile.allowedCandidateKinds.includes(candidate.candidateKind)) {
    return { acceptedCandidate: null, rejectedCandidateRef: candidate.candidateRef, dataQualityFlag: "candidate_source_kind_mismatch", failure: null };
  }
  if (candidate.candidateKind === "operator_manual" && !input.profile.allowOperatorManual) {
    return { acceptedCandidate: null, rejectedCandidateRef: candidate.candidateRef, dataQualityFlag: "operator_manual_review_required", failure: null };
  }
  if (candidate.candidateKind === "operator_manual" && !input.request.sourceProof.operatorApproval) {
    return {
      acceptedCandidate: null,
      rejectedCandidateRef: null,
      dataQualityFlag: null,
      failure: createCandidateSourceReview(
        "operator_approval_required",
        "operator_manual candidate requires operator approval proof.",
        "Visual Target requires operator approval proof for operator_manual candidate sources.",
        [candidate.candidateRef],
        ["operator_manual_review_required"],
      ),
    };
  }
  if (candidate.candidateKind === "ai_candidate" && !candidate.sourceFrameRef) {
    return { acceptedCandidate: null, rejectedCandidateRef: candidate.candidateRef, dataQualityFlag: "candidate_source_frame_missing", failure: null };
  }
  if (candidate.blockedReason) {
    return { acceptedCandidate: null, rejectedCandidateRef: candidate.candidateRef, dataQualityFlag: "candidate_blocked", failure: null };
  }
  if (!candidate.isVisible) {
    return { acceptedCandidate: null, rejectedCandidateRef: candidate.candidateRef, dataQualityFlag: "candidate_invisible", failure: null };
  }

  const ageMs = Math.max(0, input.nowEpochMs - parseVisualTargetIsoTimestamp(candidate.capturedAt));
  return ageMs > input.profile.freshnessTtlMs
    ? { acceptedCandidate: null, rejectedCandidateRef: candidate.candidateRef, dataQualityFlag: "stale_candidate", failure: null }
    : { acceptedCandidate: candidate, rejectedCandidateRef: null, dataQualityFlag: null, failure: null };
}

function createEmptyCandidateSourceFailure(
  rejectedCandidateRefs: string[],
  dataQualityFlags: Set<VisualTargetDataQualityFlag>,
): CandidateSourceBlocked | CandidateSourceReviewRequired {
  const flags = collectVisualTargetFlags(dataQualityFlags);
  if (dataQualityFlags.has("candidate_blocked")) {
    return createCandidateSourceBlocked("blocked_candidate", "All visual target candidates were blocked by source policy.", rejectedCandidateRefs, flags);
  }
  if (
    dataQualityFlags.has("candidate_invisible")
    || dataQualityFlags.has("operator_manual_review_required")
    || dataQualityFlags.has("candidate_source_binding_mismatch")
    || dataQualityFlags.has("candidate_source_frame_missing")
  ) {
    const failureReason = dataQualityFlags.has("candidate_source_frame_missing")
      ? "candidate_source_frame_missing"
      : dataQualityFlags.has("candidate_source_binding_mismatch")
        ? "candidate_source_binding_mismatch"
        : dataQualityFlags.has("candidate_invisible")
          ? "invisible_candidate"
          : "operator_approval_required";
    return createCandidateSourceReview(
      failureReason,
      "Visual Target requires review because no governed candidate survived source gating.",
      "Visual Target source gating left no bindable visible candidate for success.",
      rejectedCandidateRefs,
      flags,
    );
  }
  return createCandidateSourceBlocked(
    "missing_candidate_source_proof",
    "Visual Target candidate source proof validation rejected every candidate.",
    rejectedCandidateRefs,
    flags,
  );
}

export function validateCandidateSources(input: {
  request: ParsedVisualTargetAbilityInput;
  nowEpochMs: number;
  profile: ResolvedVisualTargetProfile;
}): CandidateSourceAllow | CandidateSourceBlocked | CandidateSourceReviewRequired {
  if (input.request.candidates.length === 0) {
    return createCandidateSourceBlocked("no_candidates", "Visual Target request contains no candidates.", [], []);
  }

  if (!input.profile.allowedSourceAbilityGroups.includes(input.request.sourceAbilityGroupId)) {
    return createCandidateSourceBlocked(
      "invalid_source_ability",
      "Visual Target sourceAbilityGroupId is outside the child policy allowlist.",
      [],
      [],
    );
  }

  const candidates: VisualTargetCandidate[] = [];
  const rejectedCandidateRefs: string[] = [];
  const dataQualityFlags = new Set<VisualTargetDataQualityFlag>();

  for (const candidate of input.request.candidates) {
    const inspection = inspectCandidateSourceCandidate({ ...input, candidate });
    if (inspection.failure) {
      return inspection.failure;
    }
    if (inspection.rejectedCandidateRef) {
      rejectedCandidateRefs.push(inspection.rejectedCandidateRef);
    }
    if (inspection.dataQualityFlag) {
      dataQualityFlags.add(inspection.dataQualityFlag);
    }
    if (inspection.acceptedCandidate) {
      candidates.push(inspection.acceptedCandidate);
    }
  }

  if (candidates.length === 0) {
    return createEmptyCandidateSourceFailure(rejectedCandidateRefs, dataQualityFlags);
  }

  return createVisualTargetGateSuccess("allow", collectVisualTargetFlags(dataQualityFlags), {
    bindingDecision: "allow",
    candidates,
    rejectedCandidateRefs,
  });
}