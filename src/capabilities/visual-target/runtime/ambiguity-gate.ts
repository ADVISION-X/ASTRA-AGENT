import type { VisualTargetResolvedCandidate } from "./visual-target-child-contract.js";
import {
  createVisualTargetGateReviewRequired,
  createVisualTargetGateSuccess,
  type VisualTargetGateReviewRequired,
  type VisualTargetGateSuccess,
} from "./visual-target-gate-results.js";

type AmbiguityClear = VisualTargetGateSuccess<"clear", { ambiguityTrace: string[] }>;
type AmbiguityReviewRequired = VisualTargetGateReviewRequired<"review_required", { ambiguityTrace: string[] }>;

export function validateAmbiguity(input: {
  candidates: VisualTargetResolvedCandidate[];
}): AmbiguityClear | AmbiguityReviewRequired {
  if (input.candidates.length < 2) {
    return createVisualTargetGateSuccess("clear", [], { ambiguityTrace: ["ambiguity clear: fewer than two candidates"] });
  }

  return createVisualTargetGateReviewRequired({
    decision: "review_required",
    failureReason: "ambiguous_candidates",
    statusMessage: "Visual Target will not resolve multiple candidates locally and requires review.",
    reviewRequiredReason: "Visual Target requires review because AI or upstream proof must resolve multi-candidate ambiguity.",
    dataQualityFlags: ["ambiguity_confidence_gap"],
    extra: {
      ambiguityTrace: input.candidates.map((candidate, index) => `candidate ${index + 1}: ${candidate.candidateRef} confidence=${candidate.confidence.toFixed(4)}`),
    },
  });
}