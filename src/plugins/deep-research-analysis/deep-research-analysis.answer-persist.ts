import type { ExchangePersistSummary } from "./deep-research-analysis.flow-shared.js";
import { type DeepResearchRecordStore, type ResearchInteraction } from "./deep-research-analysis.records.js";
import type { DeepResearchSubQuestionAnalysisAnswer } from "./deep-research-analysis.parser.js";

const coerceParsedPayload = (
  parsedJsonIndex: DeepResearchSubQuestionAnalysisAnswer["parsedJsonIndex"],
): Record<string, unknown> =>
  typeof parsedJsonIndex === "object" && parsedJsonIndex !== null && !Array.isArray(parsedJsonIndex)
    ? parsedJsonIndex as Record<string, unknown>
    : {};

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
    answerText: input.parsed.answerText,
    keyPoints: input.parsed.indexNotes,
    evidenceMentions: input.parsed.indexNotes,
    assumptions: [],
    limitations: [],
    contradictionPoints: [],
    parsedPayload: coerceParsedPayload(input.parsed.parsedJsonIndex),
  });
  return { recordType: "analysis-answer", recordId: answer.id, count: 1 };
};
