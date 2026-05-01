import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import type { VisualTargetResolvedCandidate } from "./visual-target-child-contract.js";
import type { ResolvedVisualTargetProfile } from "./visual-target-input-gate.js";
import {
  collectVisualTargetFlags,
  createVisualTargetGateBlocked,
  createVisualTargetGateReviewRequired,
  createVisualTargetGateSuccess,
  type VisualTargetGateBlocked,
  type VisualTargetGateReviewRequired,
  type VisualTargetGateSuccess,
} from "./visual-target-gate-results.js";

type TargetTypeAllow = VisualTargetGateSuccess<"allow", {
  candidates: VisualTargetResolvedCandidate[];
  rejectedCandidateRefs: string[];
}>;

type TargetTypeBlocked = VisualTargetGateBlocked<"block", {
  rejectedCandidateRefs: string[];
}>;

type TargetTypeReviewRequired = VisualTargetGateReviewRequired<"review_required", {
  rejectedCandidateRefs: string[];
}>;

function allowTargetTypeCandidate(
  candidate: VisualTargetResolvedCandidate,
  input: { request: ParsedVisualTargetAbilityInput; profile: ResolvedVisualTargetProfile },
  rejectedCandidateRefs: string[],
  dataQualityFlags: Set<VisualTargetDataQualityFlag>,
): boolean {
  if (candidate.targetType !== input.request.targetType) {
    rejectedCandidateRefs.push(candidate.candidateRef);
    return false;
  }
  if (!input.profile.allowedCoordinateSpaces.includes(candidate.originalCoordinateSpace)) {
    rejectedCandidateRefs.push(candidate.candidateRef);
    dataQualityFlags.add("candidate_coordinate_non_executable");
    return false;
  }
  if (input.profile.requireClickPoint && !candidate.executableClickPoint) {
    rejectedCandidateRefs.push(candidate.candidateRef);
    dataQualityFlags.add("candidate_missing_click_point");
    return false;
  }
  if (!input.profile.requireClickPoint && candidate.executableClickPoint) {
    rejectedCandidateRefs.push(candidate.candidateRef);
    dataQualityFlags.add("candidate_click_point_forbidden");
    return false;
  }
  return true;
}

function createEmptyTargetTypeFailure(
  rejectedCandidateRefs: string[],
  dataQualityFlags: Set<VisualTargetDataQualityFlag>,
): TargetTypeBlocked | TargetTypeReviewRequired {
  const flags = collectVisualTargetFlags(dataQualityFlags);
  const reviewRequired = dataQualityFlags.has("candidate_missing_click_point") || dataQualityFlags.has("candidate_click_point_forbidden");
  const failureReason = dataQualityFlags.has("candidate_missing_click_point")
    ? "click_point_missing"
    : dataQualityFlags.has("candidate_click_point_forbidden")
      ? "non_action_click_point_forbidden"
      : "target_type_mismatch";

  if (reviewRequired) {
    return createVisualTargetGateReviewRequired({
      decision: "review_required",
      failureReason,
      statusMessage: "Visual Target target-type policy rejected every candidate.",
      reviewRequiredReason: "Visual Target requires review because candidate shape does not match target-type policy.",
      dataQualityFlags: flags,
      extra: { rejectedCandidateRefs },
    });
  }

  return createVisualTargetGateBlocked({
    decision: "block",
    failureReason,
    statusMessage: "Visual Target target-type policy rejected every candidate.",
    dataQualityFlags: flags,
    extra: { rejectedCandidateRefs },
  });
}

export function validateTargetTypePolicy(input: {
  request: ParsedVisualTargetAbilityInput;
  candidates: VisualTargetResolvedCandidate[];
  profile: ResolvedVisualTargetProfile;
}): TargetTypeAllow | TargetTypeBlocked | TargetTypeReviewRequired {
  const rejectedCandidateRefs: string[] = [];
  const dataQualityFlags = new Set<VisualTargetDataQualityFlag>();

  if (input.request.targetType !== input.profile.targetType || input.request.targetNature !== input.profile.targetNature) {
    return createVisualTargetGateBlocked({
      decision: "block",
      failureReason: "invalid_target_type",
      statusMessage: "Visual Target request targetType/targetNature drifted from the child policy.",
      dataQualityFlags: [],
      extra: { rejectedCandidateRefs },
    });
  }

  const candidates = input.candidates.filter((candidate) => allowTargetTypeCandidate(candidate, input, rejectedCandidateRefs, dataQualityFlags));

  if (input.request.targetNature === "action" && !input.profile.requireClickPoint) {
    return createVisualTargetGateBlocked({
      decision: "block",
      failureReason: "invalid_target_type",
      statusMessage: "Action visual targets must require clickPoint and geometry handoff.",
      dataQualityFlags: collectVisualTargetFlags(dataQualityFlags),
      extra: { rejectedCandidateRefs },
    });
  }
  if (candidates.length === 0) {
    return createEmptyTargetTypeFailure(rejectedCandidateRefs, dataQualityFlags);
  }

  return createVisualTargetGateSuccess("allow", collectVisualTargetFlags(dataQualityFlags), { candidates, rejectedCandidateRefs });
}