import type { DeepResearchDecompositionResponse } from "./deep-research-analysis.decomposition-schema.js";

export const scoreDecompositionQuality = (input: DeepResearchDecompositionResponse): {
  status: "passed" | "failed";
  score: number;
  passScore: number;
} => {
  const passScore = 14;
  let score = 0;
  const dimensions = new Set<string>();
  for (const subQuestion of input.subQuestions) {
    dimensions.add(subQuestion.dimension);
    score += subQuestion.requiredEvidence.length > 0 ? 2 : 0;
    score += subQuestion.falsificationFocus.trim() ? 2 : 0;
    score += subQuestion.positiveAnalysisFocus.trim() ? 1 : 0;
  }
  score += dimensions.size * 2;
  score += input.qualitySelfCheck.isReadyForPositiveAndFalsification ? 2 : 0;
  return {
    status: score >= passScore ? "passed" : "failed",
    score,
    passScore,
  };
};
