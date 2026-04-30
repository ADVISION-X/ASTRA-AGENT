import type { VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import type { VisualTargetResolvedCandidate } from "./visual-target-child-contract.js";
import { parseVisualTargetIsoTimestamp } from "./visual-target-clock.js";

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
  const tieBreakKey = `${candidateKindPriority}:${input.candidate.candidateRef}:${input.candidate.sourceProofRef}`;

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

export function selectTargetCandidate(input: {
  candidates: VisualTargetResolvedCandidate[];
  nowEpochMs: number;
  freshnessTtlMs: number;
  minimumConfidence: number;
}):
  | {
      ok: true;
      decision: "selected";
      candidates: VisualTargetResolvedCandidate[];
      selectedCandidate: VisualTargetResolvedCandidate;
      candidateScoreTrace: VisualTargetCandidateScoreTrace[];
      selectionTrace: string[];
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | {
      ok: false;
      decision: "no_candidate" | "review_required";
      status: "failed" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      candidateScoreTrace: VisualTargetCandidateScoreTrace[];
      selectionTrace: string[];
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  if (input.candidates.length === 0) {
    return {
      ok: false,
      decision: "no_candidate",
      status: "failed",
      failureReason: "no_candidates",
      statusMessage: "Visual Target has no candidates after gating.",
      reviewRequiredReason: null,
      candidateScoreTrace: [],
      selectionTrace: ["selection aborted: no candidates survived gating"],
      dataQualityFlags: [],
    };
  }

  const scored = [...input.candidates]
    .map((candidate) => ({
      candidate,
      trace: scoreCandidate({ candidate, nowEpochMs: input.nowEpochMs, freshnessTtlMs: input.freshnessTtlMs }),
    }))
    .sort((left, right) => right.trace.finalScore - left.trace.finalScore || left.trace.tieBreakKey.localeCompare(right.trace.tieBreakKey));
  const sorted = scored.map((entry) => entry.candidate);
  const selectionTrace = scored.map((entry, index) => `rank ${index + 1}: ${entry.candidate.candidateRef} score=${entry.trace.finalScore.toFixed(4)} tieBreak=${entry.trace.tieBreakKey}`);

  if (sorted[0]!.confidence < input.minimumConfidence) {
    return {
      ok: false,
      decision: "review_required",
      status: "review_required",
      failureReason: "confidence_below_threshold",
      statusMessage: "Visual Target top candidate is below minimum confidence policy.",
      reviewRequiredReason: "Visual Target requires review because top candidate confidence is below threshold.",
      candidateScoreTrace: scored.map((entry) => entry.trace),
      selectionTrace,
      dataQualityFlags: ["low_confidence"],
    };
  }

  return {
    ok: true,
    decision: "selected",
    candidates: sorted,
    selectedCandidate: sorted[0]!,
    candidateScoreTrace: scored.map((entry) => entry.trace),
    selectionTrace,
    dataQualityFlags: [],
  };
}