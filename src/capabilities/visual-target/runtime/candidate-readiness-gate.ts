import type { VisualTargetDataQualityFlag } from "../contract.js";
import type { ResolvedVisualTargetProfile } from "./visual-target-input-gate.js";
import type { VisualTargetResolvedCandidate } from "./visual-target-child-contract.js";
import {
  collectVisualTargetFlags,
  createVisualTargetGateBlocked,
  createVisualTargetGateReviewRequired,
  createVisualTargetGateSuccess,
  type VisualTargetGateBlocked,
  type VisualTargetGateReviewRequired,
  type VisualTargetGateSuccess,
} from "./visual-target-gate-results.js";

type CandidateReadinessAllow = VisualTargetGateSuccess<"allow", {
  candidates: VisualTargetResolvedCandidate[];
  rejectedCandidateRefs: string[];
}>;

type CandidateReadinessBlocked = VisualTargetGateBlocked<"block", {
  rejectedCandidateRefs: string[];
}>;

type CandidateReadinessReviewRequired = VisualTargetGateReviewRequired<"review_required", {
  rejectedCandidateRefs: string[];
}>;

function createStructureFailure(
  rejectedCandidateRefs: string[],
  dataQualityFlags: Set<VisualTargetDataQualityFlag>,
): CandidateReadinessBlocked | CandidateReadinessReviewRequired {
  const flags = collectVisualTargetFlags(dataQualityFlags);
  if (dataQualityFlags.has("candidate_missing_click_point") || dataQualityFlags.has("candidate_click_point_forbidden")) {
    return createVisualTargetGateReviewRequired({
      decision: "review_required",
      failureReason: dataQualityFlags.has("candidate_missing_click_point")
        ? "click_point_missing"
        : "non_action_click_point_forbidden",
      statusMessage: "Visual Target candidate structure gate rejected every candidate.",
      reviewRequiredReason: "Visual Target requires review because candidate geometry is incomplete or carries a forbidden naked clickPoint.",
      dataQualityFlags: flags,
      extra: { rejectedCandidateRefs },
    });
  }

  return createVisualTargetGateBlocked({
    decision: "block",
    failureReason: "bbox_out_of_bounds",
    statusMessage: "Visual Target candidate structure gate rejected every candidate.",
    dataQualityFlags: flags,
    extra: { rejectedCandidateRefs },
  });
}

const rejectCandidate = (
  candidate: VisualTargetResolvedCandidate,
  rejectedCandidateRefs: string[],
  dataQualityFlags: Set<VisualTargetDataQualityFlag>,
  flag: VisualTargetDataQualityFlag,
) => {
  rejectedCandidateRefs.push(candidate.candidateRef);
  dataQualityFlags.add(flag);
  return false;
};

const isStructurallyValidCandidate = (input: {
  candidate: VisualTargetResolvedCandidate;
  profile: ResolvedVisualTargetProfile;
  rejectedCandidateRefs: string[];
  dataQualityFlags: Set<VisualTargetDataQualityFlag>;
}) => {
  if (input.candidate.executableBoundingBox.width <= 0 || input.candidate.executableBoundingBox.height <= 0) {
    return rejectCandidate(input.candidate, input.rejectedCandidateRefs, input.dataQualityFlags, "candidate_bbox_out_of_bounds");
  }
  if (input.profile.requireClickPoint && !input.candidate.executableClickPoint) {
    return rejectCandidate(input.candidate, input.rejectedCandidateRefs, input.dataQualityFlags, "candidate_missing_click_point");
  }
  return !input.profile.requireClickPoint && input.candidate.executableClickPoint
    ? rejectCandidate(input.candidate, input.rejectedCandidateRefs, input.dataQualityFlags, "candidate_click_point_forbidden")
    : true;
};

export function validateCandidateStructure(input: {
  candidates: VisualTargetResolvedCandidate[];
  profile: ResolvedVisualTargetProfile;
}): CandidateReadinessAllow | CandidateReadinessBlocked | CandidateReadinessReviewRequired {
  const rejectedCandidateRefs: string[] = [];
  const dataQualityFlags = new Set<VisualTargetDataQualityFlag>();

  const candidates = input.candidates.filter((candidate) => isStructurallyValidCandidate({
    candidate,
    profile: input.profile,
    rejectedCandidateRefs,
    dataQualityFlags,
  }));

  if (candidates.length === 0) {
    return createStructureFailure(rejectedCandidateRefs, dataQualityFlags);
  }

  return createVisualTargetGateSuccess("allow", collectVisualTargetFlags(dataQualityFlags), { candidates, rejectedCandidateRefs });
}

export function validateCandidateConfidence(input: {
  candidates: VisualTargetResolvedCandidate[];
  profile: ResolvedVisualTargetProfile;
}): CandidateReadinessAllow | CandidateReadinessReviewRequired {
  const rejectedCandidateRefs: string[] = [];
  const dataQualityFlags = new Set<VisualTargetDataQualityFlag>();

  const candidates = input.candidates.filter((candidate) => {
    const isLowConfidence = candidate.confidence < input.profile.minimumScore
      || candidate.dataQualityFlags.includes("low_confidence")
      || candidate.dataQualityFlags.includes("ai_confidence_low");
    if (!isLowConfidence) {
      return true;
    }
    rejectedCandidateRefs.push(candidate.candidateRef);
    dataQualityFlags.add("low_confidence");
    return false;
  });

  if (candidates.length === 0) {
    return createVisualTargetGateReviewRequired({
      decision: "review_required",
      failureReason: "confidence_below_threshold",
      statusMessage: "Visual Target candidate confidence gate rejected every candidate.",
      reviewRequiredReason: "Visual Target requires review because every surviving candidate stayed below the governed confidence threshold.",
      dataQualityFlags: collectVisualTargetFlags(dataQualityFlags),
      extra: { rejectedCandidateRefs },
    });
  }

  return createVisualTargetGateSuccess("allow", collectVisualTargetFlags(dataQualityFlags), { candidates, rejectedCandidateRefs });
}