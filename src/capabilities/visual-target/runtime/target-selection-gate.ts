import type { VisualTargetDataQualityFlag } from "../contract.js";
import type { ResolvedVisualTargetProfile } from "./visual-target-input-gate.js";
import type { VisualTargetResolvedCandidate } from "./visual-target-child-contract.js";
import {
  createVisualTargetGateBlocked,
  createVisualTargetGateSuccess,
  type VisualTargetGateBlocked,
  type VisualTargetGateSuccess,
} from "./visual-target-gate-results.js";

export type VisualTargetCandidateScoreTrace = {
  candidateRef: string;
  rawConfidence: number;
  stalePenalty: number;
  dataQualityPenalty: number;
  sourcePenalty: number;
  finalScore: number;
  tieBreakKey: string;
};

function buildCandidateTrace(candidate: VisualTargetResolvedCandidate, index: number): VisualTargetCandidateScoreTrace {
  const stalePenalty = candidate.dataQualityFlags.includes("stale_candidate") ? 0.12 : 0;
  const dataQualityPenalty = candidate.dataQualityFlags.reduce((total, flag) => {
    switch (flag) {
      case "candidate_coordinate_requires_mapping":
        return total + 0.05;
      case "candidate_mapping_unverified":
        return total + 0.1;
      case "candidate_source_frame_missing":
        return total + 0.08;
      case "low_confidence":
      case "ai_confidence_low":
        return total + 0.2;
      default:
        return total;
    }
  }, 0);
  const sourcePenalty = (() => {
    switch (candidate.originalCoordinateSpace) {
      case "desktop_screen":
        return 0.03;
      case "source_image":
        return 0.08;
      case "ai_input":
        return 0.12;
      default:
        return 0;
    }
  })();
  const finalScore = Math.max(0, candidate.confidence - stalePenalty - dataQualityPenalty - sourcePenalty);

  return {
    candidateRef: candidate.candidateRef,
    rawConfidence: candidate.confidence,
    stalePenalty,
    dataQualityPenalty,
    sourcePenalty,
    finalScore,
    tieBreakKey: `${candidate.originalCoordinateSpace}:${index + 1}`,
  };
}

type SelectedTargetCandidate = VisualTargetGateSuccess<"selected", {
  candidates: VisualTargetResolvedCandidate[];
  selectedCandidate: VisualTargetResolvedCandidate;
  candidateScoreTrace: VisualTargetCandidateScoreTrace[];
  selectionTrace: string[];
}>;

type MissingTargetCandidate = VisualTargetGateBlocked<"no_candidate", {
  candidateScoreTrace: VisualTargetCandidateScoreTrace[];
  selectionTrace: string[];
}>;

function createMissingTargetCandidateFailure(): MissingTargetCandidate {
  return createVisualTargetGateBlocked({
    decision: "no_candidate",
    failureReason: "no_candidates",
    statusMessage: "Visual Target has no candidates after gating.",
    dataQualityFlags: [],
    extra: { candidateScoreTrace: [], selectionTrace: ["selection aborted: no candidates survived gating"] },
  });
}

function rankCandidates(candidates: VisualTargetResolvedCandidate[]): {
  orderedCandidates: VisualTargetResolvedCandidate[];
  candidateScoreTrace: VisualTargetCandidateScoreTrace[];
  selectionTrace: string[];
} {
  const scoreTrace = candidates.map((candidate, index) => buildCandidateTrace(candidate, index));
  const candidateByRef = new Map(candidates.map((candidate) => [candidate.candidateRef, candidate]));
  const orderedScoreTrace = [...scoreTrace].sort((left, right) => {
    if (right.finalScore !== left.finalScore) {
      return right.finalScore - left.finalScore;
    }
    if (right.rawConfidence !== left.rawConfidence) {
      return right.rawConfidence - left.rawConfidence;
    }
    return left.tieBreakKey.localeCompare(right.tieBreakKey);
  });

  return {
    orderedCandidates: orderedScoreTrace.map((trace) => candidateByRef.get(trace.candidateRef)!).filter(Boolean),
    candidateScoreTrace: orderedScoreTrace,
    selectionTrace: orderedScoreTrace.map((trace, index) => `rank ${index + 1}: ${trace.candidateRef} score=${trace.finalScore.toFixed(4)} confidence=${trace.rawConfidence.toFixed(4)} stalePenalty=${trace.stalePenalty.toFixed(4)} dataQualityPenalty=${trace.dataQualityPenalty.toFixed(4)} sourcePenalty=${trace.sourcePenalty.toFixed(4)}`),
  };
}

export function selectTargetCandidate(input: {
  candidates: VisualTargetResolvedCandidate[];
  profile: ResolvedVisualTargetProfile;
}): SelectedTargetCandidate | MissingTargetCandidate {
  if (input.candidates.length === 0) {
    return createMissingTargetCandidateFailure();
  }

  const rankedCandidates = rankCandidates(input.candidates);
  const selectedCandidate = rankedCandidates.orderedCandidates[0]!;
  const topScore = rankedCandidates.candidateScoreTrace[0]!;
  const secondScore = rankedCandidates.candidateScoreTrace[1] ?? null;
  const scoreGap = secondScore ? topScore.finalScore - secondScore.finalScore : topScore.finalScore;
  const ambiguityCandidates = secondScore && scoreGap < input.profile.selectionWindow
    ? rankedCandidates.orderedCandidates
    : [selectedCandidate];
  const selectionTrace = secondScore && scoreGap < input.profile.selectionWindow
    ? [...rankedCandidates.selectionTrace, `selection window ${scoreGap.toFixed(4)} is below governed gate ${input.profile.selectionWindow.toFixed(4)}; ambiguity handoff stays active`]
    : [...rankedCandidates.selectionTrace, `selected ${selectedCandidate.candidateRef} with score gap ${scoreGap.toFixed(4)}`];

  return createVisualTargetGateSuccess("selected", [], {
    candidates: ambiguityCandidates,
    selectedCandidate,
    candidateScoreTrace: rankedCandidates.candidateScoreTrace,
    selectionTrace,
  });
}
