import type { VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import { hashVisualTargetPayload } from "../shared/visual-target-types.js";
import type { VisualTargetResolvedCandidate } from "./visual-target-child-contract.js";
import { parseVisualTargetIsoTimestamp } from "./visual-target-clock.js";
import {
  createVisualTargetGateBlocked,
  createVisualTargetGateReviewRequired,
  createVisualTargetGateSuccess,
  type VisualTargetGateBlocked,
  type VisualTargetGateReviewRequired,
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

function scoreCandidate(input: {
  candidate: VisualTargetResolvedCandidate;
  nowEpochMs: number;
  freshnessTtlMs: number;
}): VisualTargetCandidateScoreTrace {
  const ageMs = Math.max(0, input.nowEpochMs - parseVisualTargetIsoTimestamp(input.candidate.capturedAt));
  const freshnessPenalty = Math.min(0.25, ageMs / Math.max(1, input.freshnessTtlMs) * 0.25);
  const qualityPenalty = input.candidate.dataQualityFlags.length * 0.02;
  const sourcePenalty = input.candidate.candidateKind === "heuristic_profile"
    ? 0.02
    : input.candidate.candidateKind === "operator_manual"
      ? 0.01
      : 0.03;
  const candidateKindPriority = input.candidate.candidateKind === "operator_manual"
    ? 3
    : input.candidate.candidateKind === "heuristic_profile"
      ? 2
      : 1;
  const sourceProofHash = hashVisualTargetPayload(input.candidate.sourceProofRef).slice(0, 16);
  const tieBreakKey = `${candidateKindPriority}:${input.candidate.candidateRef}:${sourceProofHash}`;

  return {
    candidateRef: input.candidate.candidateRef,
    rawConfidence: input.candidate.confidence,
    freshnessPenalty,
    dataQualityPenalty: qualityPenalty,
    sourcePenalty,
    finalScore: input.candidate.confidence - freshnessPenalty - qualityPenalty - sourcePenalty,
    tieBreakKey,
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

type TargetSelectionReviewRequired = VisualTargetGateReviewRequired<"review_required", {
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

function scoreTargetCandidates(input: {
  candidates: VisualTargetResolvedCandidate[];
  nowEpochMs: number;
  freshnessTtlMs: number;
}): {
  sortedCandidates: VisualTargetResolvedCandidate[];
  candidateScoreTrace: VisualTargetCandidateScoreTrace[];
  selectionTrace: string[];
} {
  const scored = [...input.candidates]
    .map((candidate) => ({
      candidate,
      trace: scoreCandidate({ candidate, nowEpochMs: input.nowEpochMs, freshnessTtlMs: input.freshnessTtlMs }),
    }))
    .sort((left, right) => right.trace.finalScore - left.trace.finalScore || left.trace.tieBreakKey.localeCompare(right.trace.tieBreakKey));

  return {
    sortedCandidates: scored.map((entry) => entry.candidate),
    candidateScoreTrace: scored.map((entry) => entry.trace),
    selectionTrace: scored.map((entry, index) => `rank ${index + 1}: ${entry.candidate.candidateRef} score=${entry.trace.finalScore.toFixed(4)} tieBreak=${entry.trace.tieBreakKey}`),
  };
}

export function selectTargetCandidate(input: {
  candidates: VisualTargetResolvedCandidate[];
  nowEpochMs: number;
  freshnessTtlMs: number;
  minimumConfidence: number;
}): SelectedTargetCandidate | MissingTargetCandidate | TargetSelectionReviewRequired {
  if (input.candidates.length === 0) {
    return createMissingTargetCandidateFailure();
  }

  const scoredCandidates = scoreTargetCandidates(input);
  const selectedCandidate = scoredCandidates.sortedCandidates[0]!;

  if (selectedCandidate.confidence < input.minimumConfidence) {
    return createVisualTargetGateReviewRequired({
      decision: "review_required",
      failureReason: "confidence_below_threshold",
      statusMessage: "Visual Target top candidate is below minimum confidence policy.",
      reviewRequiredReason: "Visual Target requires review because top candidate confidence is below threshold.",
      dataQualityFlags: ["low_confidence"],
      extra: {
        candidateScoreTrace: scoredCandidates.candidateScoreTrace,
        selectionTrace: scoredCandidates.selectionTrace,
      },
    });
  }

  return createVisualTargetGateSuccess("selected", [], {
    candidates: scoredCandidates.sortedCandidates,
    selectedCandidate,
    candidateScoreTrace: scoredCandidates.candidateScoreTrace,
    selectionTrace: scoredCandidates.selectionTrace,
  });
}
