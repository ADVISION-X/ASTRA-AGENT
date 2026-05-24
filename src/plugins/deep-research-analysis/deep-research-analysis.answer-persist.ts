import type { ExchangePersistSummary } from "./deep-research-analysis.flow-shared.js";
import {
  type DeepResearchRecordStore,
  type ResearchInteraction,
} from "./deep-research-analysis.records.js";
import type {
  DeepResearchSubQuestionAnalysisAnswer,
  DeepResearchFalsificationAnswer,
  DeepResearchPositiveAnswer,
} from "./deep-research-analysis.parser.js";

export const persistAnalysisAnswer = (input: {
  store: DeepResearchRecordStore;
  jobId: string;
  interaction: ResearchInteraction;
  subQuestionId: string;
  parsed: DeepResearchSubQuestionAnalysisAnswer;
}): ExchangePersistSummary => {
  const answer = input.store.saveAnswer({
    jobId: input.jobId,
    interactionId: input.interaction.id,
    subQuestionId: input.subQuestionId,
    answerKind: "analysis",
    answerText: input.parsed.answer,
    keyPoints: input.parsed.keyClaims,
    evidenceMentions: input.parsed.evidenceMentions,
    assumptions: input.parsed.assumptions,
    limitations: input.parsed.limitations,
    contradictionPoints: input.parsed.counterConditions,
    parsedPayload: input.parsed,
    confidence: input.parsed.confidence,
  });
  return {
    recordType: "analysis-answer",
    recordId: answer.id,
    count: 1,
  };
};