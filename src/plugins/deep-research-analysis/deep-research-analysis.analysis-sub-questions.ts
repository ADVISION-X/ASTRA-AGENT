import type {
  DeepResearchSubQuestionAnalysisAnswer,
} from "./deep-research-analysis.parser.js";
import type { DeepResearchDecompositionResponse } from "./deep-research-analysis.decomposition-schema.js";
import {
  parseDeepResearchDecompositionResponse,
  parseDeepResearchSubQuestionAnalysisResponse,
} from "./deep-research-analysis.parser.js";
import {
  decompositionPrompt,
  renderDeepResearchDecompositionPrompt,
  renderDeepResearchSubQuestionAnalysisPrompt,
  subQuestionAnalysisPrompt,
} from "./deep-research-analysis.prompts.js";
import type { DeepResearchSubQuestion } from "./deep-research-analysis.schema.js";
import type { ResearchSubQuestion } from "./deep-research-analysis.records.js";
import {
  persistAnalysisAnswer,
  runPromptExchange,
} from "./deep-research-analysis.prompt-exchange.js";
import {
  finishPromptFailure,
  type AnalysisExecutionContext,
  type AnalysisFailure,
  type AnalysisOutcome,
} from "./deep-research-analysis.analysis-support.js";

type DecompositionSuccess = {
  ok: true;
  subQuestions: readonly ResearchSubQuestion[];
};

const toPersistedSubQuestion = (
  subQuestion: DeepResearchDecompositionResponse["subQuestions"][number],
): DeepResearchSubQuestion => ({
  id: subQuestion.id,
  title: subQuestion.title,
  questionText: subQuestion.questionText,
  purpose: subQuestion.whyItMatters,
  whyItMatters: subQuestion.whyItMatters,
  decisionWeight: subQuestion.decisionWeight,
  analysisFocus: subQuestion.analysisFocus,
  requiredEvidence: [...subQuestion.requiredEvidence],
  scope: subQuestion.scope,
  expectedAnswerShape: subQuestion.expectedAnswerShape,
  priority: subQuestion.priority,
  omissionRisk: subQuestion.omissionRisk,
});

export const runDecompositionPhase = async (
  context: AnalysisExecutionContext,
): Promise<DecompositionSuccess | AnalysisFailure> => {
  const decomposition = await runPromptExchange<DeepResearchDecompositionResponse>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt: decompositionPrompt,
    promptKey: "decomposition",
    renderedPromptText: renderDeepResearchDecompositionPrompt(context.input),
    inputRefs: [`job:${context.jobId}:user-question`],
    stages: {
      send: "DECOMPOSE_SEND",
      capture: "DECOMPOSE_CAPTURE",
      parse: "DECOMPOSE_PARSE",
      persist: "DECOMPOSE_PERSIST",
    },
    parse: (rawText) =>
      parseDeepResearchDecompositionResponse({
        rawText,
        maxSubQuestions: context.input.maxSubQuestions,
      }),
    successRecordCount: (parsed) => parsed.subQuestions.length,
    persist: ({ interaction, parsed }) => {
      const subQuestions = context.store.saveSubQuestions({
        jobId: context.jobId,
        interactionId: interaction.id,
        subQuestions: parsed.subQuestions.map(toPersistedSubQuestion),
      });
      return {
        recordType: "sub-question",
        recordId: subQuestions[0] ? subQuestions[0].id : interaction.id,
        recordIds: subQuestions.map((record) => record.id),
        count: subQuestions.length,
      };
    },
  });
  if (decomposition.status !== "parsed") {
    if (decomposition.rawResponseHash) {
      context.recordHashes.decompositionPromptHash = decomposition.promptHash;
      context.recordHashes.decompositionRawResponseHash =
        decomposition.rawResponseHash;
    }
    return finishPromptFailure(context, decomposition);
  }
  return { ok: true, subQuestions: context.store.listSubQuestions(context.jobId) };
};

const runAnalysisPhase = async (
  context: AnalysisExecutionContext,
  subQuestion: ResearchSubQuestion,
) =>
  runPromptExchange<DeepResearchSubQuestionAnalysisAnswer>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt: subQuestionAnalysisPrompt,
    promptKey: `analysis:${subQuestion.id}`,
    renderedPromptText: renderDeepResearchSubQuestionAnalysisPrompt({
      userQuestion: context.input.userQuestion,
      analysisGoal: context.input.analysisGoal,
      language: context.input.language,
      subQuestion: subQuestion.question,
    }),
    inputRefs: [`job:${context.jobId}:user-question`, `sub-question:${subQuestion.id}`],
    stages: {
      send: "ANALYSIS_SEND",
      capture: "ANALYSIS_CAPTURE",
      parse: "ANALYSIS_PARSE",
      persist: "ANALYSIS_PERSIST",
    },
    subQuestionId: subQuestion.id,
    timeoutMs: 600_000,
    parse: (rawText) => parseDeepResearchSubQuestionAnalysisResponse({
      rawText,
      subQuestionId: subQuestion.id,
    }),
    successRecordCount: () => 1,
    persist: ({ interaction, parsed }) =>
      persistAnalysisAnswer({
        store: context.store,
        jobId: context.jobId,
        interaction,
        subQuestionId: subQuestion.id,
        parsed,
      }),
  });

const rememberFailedAnalysisHashes = (input: {
  context: AnalysisExecutionContext;
  subQuestionId: string;
  promptHash: string;
  rawResponseHash: string | undefined;
}): void => {
  input.context.recordHashes[`analysis-failure:${input.subQuestionId}:prompt`] = input.promptHash;
  if (input.rawResponseHash) {
    input.context.recordHashes[`analysis-failure:${input.subQuestionId}:response`] = input.rawResponseHash;
  }
};

type SubQuestionPhaseOutcome = {
  completed: boolean;
};

const runSubQuestionPhase = async (
  context: AnalysisExecutionContext,
  subQuestion: ResearchSubQuestion,
) : Promise<SubQuestionPhaseOutcome> => {
  const analysis = await runAnalysisPhase(context, subQuestion);
  if (analysis.status !== "parsed") {
    rememberFailedAnalysisHashes({
      context,
      subQuestionId: subQuestion.id,
      promptHash: analysis.promptHash,
      rawResponseHash: analysis.rawResponseHash,
    });
    return { completed: false };
  }
  return { completed: true };
};

export const runSubQuestionPhases = async (
  context: AnalysisExecutionContext,
  subQuestions: readonly ResearchSubQuestion[],
): Promise<AnalysisOutcome> => {
  for (const subQuestion of subQuestions) {
    await runSubQuestionPhase(context, subQuestion);
  }
  return { ok: true };
};
