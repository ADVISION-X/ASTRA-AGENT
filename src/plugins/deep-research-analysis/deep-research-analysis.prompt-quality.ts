import type {
  DecompositionOutput,
  DecompositionPromptQualityScore,
} from "./deep-research-analysis.prompt-contracts.js";

const scoreBoolean = (value: boolean): 0 | 2 => value ? 2 : 0;

const scoreArrayCoverage = (items: readonly unknown[], minimum: number): 0 | 1 | 2 => {
  if (items.length >= minimum) return 2;
  return items.length > 0 ? 1 : 0;
};

const scoreNonEmptyText = (value: string): 0 | 2 => value.trim().length > 0 ? 2 : 0;

const hasDuplicateQuestionText = (output: DecompositionOutput): boolean => {
  const normalized = output.subQuestions.map((item) => item.questionText.trim().toLocaleLowerCase());
  return new Set(normalized).size !== normalized.length;
};

const scoreDimensionPresence = (output: DecompositionOutput, keyword: string): 0 | 1 | 2 => {
  const hitCount = output.subQuestions.filter((item) => {
    const combined = [
      item.dimension,
      item.purpose,
      item.questionText,
      item.positiveAnalysisFocus,
      item.falsificationFocus,
    ].join(" ").toLocaleLowerCase();
    return combined.includes(keyword);
  }).length;
  if (hitCount >= 2) return 2;
  return hitCount === 1 ? 1 : 0;
};

export const scoreDecompositionQuality = (
  output: DecompositionOutput,
): DecompositionPromptQualityScore => {
  const dimensions: DecompositionPromptQualityScore["dimensions"] = {
    coversFacts: scoreBoolean(output.qualitySelfCheck.coversFacts),
    coversCausality: scoreBoolean(output.qualitySelfCheck.coversCausality),
    coversImpact: scoreBoolean(output.qualitySelfCheck.coversImpact),
    coversEvidence: scoreArrayCoverage(output.subQuestions.flatMap((item) => item.requiredEvidence), output.subQuestions.length),
    coversFalsification: scoreBoolean(output.qualitySelfCheck.coversFalsification),
    coversRisks: Math.max(
      scoreBoolean(output.qualitySelfCheck.coversRisks),
      scoreDimensionPresence(output, "risk"),
    ) as 0 | 1 | 2,
    noDuplicateQuestions: hasDuplicateQuestionText(output) ? 0 : 2,
    independentAnswerability: Math.min(
      scoreArrayCoverage(output.subQuestions, 2),
      Math.min(
        ...output.subQuestions.map((item) =>
          Math.min(scoreNonEmptyText(item.questionText), scoreNonEmptyText(item.expectedAnswerShape)),
        ),
      ),
    ) as 0 | 1 | 2,
    falsifiability: Math.min(
      scoreBoolean(output.qualitySelfCheck.isReadyForPositiveAndFalsification),
      Math.min(...output.subQuestions.map((item) => scoreNonEmptyText(item.falsificationFocus))),
    ) as 0 | 1 | 2,
  };
  const score = Object.values(dimensions).reduce<number>((sum, value) => sum + value, 0);
  const passScore = 14;
  return {
    status: score >= passScore ? "passed" : "review_required",
    score,
    maxScore: 18,
    passScore,
    dimensions,
  };
};
