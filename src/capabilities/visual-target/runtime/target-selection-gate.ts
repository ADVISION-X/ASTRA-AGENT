import type { VisualTargetCandidate, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import { calculateVisualTargetAgeMs } from "./visual-target-time.js";

function scoreCandidate(input: {
  candidate: VisualTargetCandidate;
  nowIso: string;
  freshnessTtlMs: number;
}): number {
  const ageMs = calculateVisualTargetAgeMs({ nowIso: input.nowIso, observedIso: input.candidate.capturedAt });
  const freshnessPenalty = Math.min(0.25, ageMs / Math.max(1, input.freshnessTtlMs) * 0.25);
  const qualityPenalty = input.candidate.dataQualityFlags.length * 0.02;
  const sourcePenalty = input.candidate.candidateKind === "heuristic_profile"
    ? 0.01
    : input.candidate.candidateKind === "operator_manual"
      ? 0.04
      : 0;

  return input.candidate.confidence - freshnessPenalty - qualityPenalty - sourcePenalty;
}

export function selectTargetCandidate(input: {
  candidates: VisualTargetCandidate[];
  nowIso: string;
  freshnessTtlMs: number;
  minimumConfidence: number;
}):
  | {
      ok: true;
      decision: "selected";
      candidates: VisualTargetCandidate[];
      selectedCandidate: VisualTargetCandidate;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    }
  | {
      ok: false;
      decision: "no_candidate" | "review_required";
      status: "failed" | "review_required";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
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
      dataQualityFlags: [],
    };
  }

  const sorted = [...input.candidates]
    .map((candidate) => ({ candidate, score: scoreCandidate({ candidate, nowIso: input.nowIso, freshnessTtlMs: input.freshnessTtlMs }) }))
    .sort((left, right) => right.score - left.score || right.candidate.confidence - left.candidate.confidence)
    .map((entry) => entry.candidate);

  if (sorted[0]!.confidence < input.minimumConfidence) {
    return {
      ok: false,
      decision: "review_required",
      status: "review_required",
      failureReason: "confidence_below_threshold",
      statusMessage: "Visual Target top candidate is below minimum confidence policy.",
      reviewRequiredReason: "Visual Target requires review because top candidate confidence is below threshold.",
      dataQualityFlags: ["ai_confidence_low"],
    };
  }

  return {
    ok: true,
    decision: "selected",
    candidates: sorted,
    selectedCandidate: sorted[0]!,
    dataQualityFlags: [],
  };
}