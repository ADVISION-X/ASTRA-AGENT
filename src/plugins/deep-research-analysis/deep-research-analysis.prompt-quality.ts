import type { DeepResearchDecompositionResponse } from "./deep-research-analysis.decomposition-schema.js";

const finalSynthesisLeakagePatterns = [
  /最终判断/u,
  /最终概率/u,
  /最终结论/u,
  /最终答案/u,
  /是否值得买入/u,
  /应该买入/u,
  /最终路径是什么/u,
  /最终会如何结束/u,
  /最终.*怎么结束/u,
  /综合判断/u,
  /综合所有因素/u,
  /final judgment/iu,
  /final probability/iu,
  /final conclusion/iu,
  /final answer/iu,
  /most likely final outcome/iu,
] as const;

const allowedFinalSynthesisFeederPatterns = [
  /哪些变量/u,
  /哪些条件/u,
  /触发条件/u,
  /反转条件/u,
  /证据/u,
  /variables/iu,
  /conditions/iu,
  /triggers/iu,
  /evidence/iu,
] as const;

const currentEventSignals = [
  /当前/u,
  /最新/u,
  /现在/u,
  /today/iu,
  /now/iu,
  /current/iu,
  /latest/iu,
  /recent/iu,
  /ongoing/iu,
] as const;

const currentDateSignals = [/current date/iu, /date\/time/iu, /当前日期/u, /时间点/u] as const;
const latestSourceSignals = [/latest reliable sources/iu, /latest source/iu, /最新可靠来源/u, /最新来源/u] as const;
const scopeSignals = [/scope/iu, /conflict scope/iu, /event scope/iu, /事件范围/u, /冲突范围/u] as const;

const matchesAny = (value: string, patterns: readonly RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(value));

export const detectFinalAdjudicationLeakage = (questionText: string): boolean => {
  if (matchesAny(questionText, allowedFinalSynthesisFeederPatterns)) {
    return false;
  }
  return matchesAny(questionText, finalSynthesisLeakagePatterns);
};

export const detectCurrentEventMissingInfo = (input: DeepResearchDecompositionResponse): boolean => {
  if (!matchesAny(input.mainQuestion, currentEventSignals)) {
    return false;
  }
  const missingInfoText = input.missingInfo.join("\n");
  return !matchesAny(missingInfoText, currentDateSignals)
    || !matchesAny(missingInfoText, latestSourceSignals)
    || !matchesAny(missingInfoText, scopeSignals);
};

export const scoreDecompositionQuality = (input: DeepResearchDecompositionResponse): {
  status: "passed" | "failed";
  score: number;
  passScore: number;
} => {
  const passScore = 16;
  let score = 0;
  let hasHardFailure = false;
  for (const subQuestion of input.subQuestions) {
    score += subQuestion.requiredEvidence.length >= 2 ? 2 : 0;
    score += subQuestion.whyItMatters.trim() ? 1 : 0;
    score += subQuestion.analysisFocus.trim() ? 2 : 0;
    score += subQuestion.omissionRisk.trim() ? 1 : 0;
    if (
      subQuestion.requiredEvidence.length < 2
      || !subQuestion.whyItMatters.trim()
      || !subQuestion.analysisFocus.trim()
      || !subQuestion.omissionRisk.trim()
      || detectFinalAdjudicationLeakage(subQuestion.questionText)
    ) {
      hasHardFailure = true;
    }
  }
  score += Math.min(input.exhaustivenessCheck.keyDimensionsCovered.length, 6);
  score += input.exhaustivenessCheck.knownBlindSpots.length > 0 ? 1 : 0;
  score += input.qualitySelfCheck.isNeutral ? 1 : 0;
  score += input.qualitySelfCheck.hasNoDuplicateQuestions ? 1 : 0;
  score += input.qualitySelfCheck.hasNoPureFalsificationQuestions ? 1 : 0;
  score += input.qualitySelfCheck.isReadyForIndependentAnalysis ? 1 : 0;
  score += input.qualitySelfCheck.isReadyForFinalAdjudication ? 1 : 0;
  if (
    !input.qualitySelfCheck.isNeutral
    || !input.qualitySelfCheck.hasNoDuplicateQuestions
    || !input.qualitySelfCheck.hasNoPureFalsificationQuestions
    || !input.qualitySelfCheck.isReadyForIndependentAnalysis
    || !input.qualitySelfCheck.isReadyForFinalAdjudication
    || detectCurrentEventMissingInfo(input)
  ) {
    hasHardFailure = true;
  }
  return {
    status: !hasHardFailure && score >= passScore ? "passed" : "failed",
    score,
    passScore,
  };
};
