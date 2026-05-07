import type { VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
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
  freshnessPenalty: number;
  dataQualityPenalty: number;
  sourcePenalty: number;
  finalScore: number;
  tieBreakKey: string;
};

function buildCandidateTrace(candidate: VisualTargetResolvedCandidate, index: number): VisualTargetCandidateScoreTrace {
  return {
    candidateRef: candidate.candidateRef,
    rawConfidence: candidate.confidence,
    freshnessPenalty: 0,
    dataQualityPenalty: 0,
    sourcePenalty: 0,
    finalScore: candidate.confidence,
    tieBreakKey: `input-order:${index + 1}`,
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

function preserveUpstreamCandidateOrder(candidates: VisualTargetResolvedCandidate[]): {
  orderedCandidates: VisualTargetResolvedCandidate[];
  candidateScoreTrace: VisualTargetCandidateScoreTrace[];
  selectionTrace: string[];
} {
  return {
    orderedCandidates: [...candidates],
    candidateScoreTrace: candidates.map((candidate, index) => buildCandidateTrace(candidate, index)),
    selectionTrace: candidates.map((candidate, index) => `input order ${index + 1}: ${candidate.candidateRef} confidence=${candidate.confidence.toFixed(4)}`),
  };
}

export function selectTargetCandidate(input: {
  candidates: VisualTargetResolvedCandidate[];
}): SelectedTargetCandidate | MissingTargetCandidate {
  if (input.candidates.length === 0) {
    return createMissingTargetCandidateFailure();
  }

  const preservedCandidates = preserveUpstreamCandidateOrder(input.candidates);
  const selectedCandidate = preservedCandidates.orderedCandidates[0]!;

  return createVisualTargetGateSuccess("selected", [], {
    candidates: preservedCandidates.orderedCandidates,
    selectedCandidate,
    candidateScoreTrace: preservedCandidates.candidateScoreTrace,
    selectionTrace: preservedCandidates.selectionTrace,
  });
}
