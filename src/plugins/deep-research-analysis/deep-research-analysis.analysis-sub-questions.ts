import type {
  DeepResearchDecompositionResponse,
  DeepResearchFalsificationAnswer,
  DeepResearchPositiveAnswer,
} from "./deep-research-analysis.parser.js";
import {
  parseDeepResearchDecompositionResponse,
  parseDeepResearchFalsificationResponse,
  parseDeepResearchPositiveResponse,
} from "./deep-research-analysis.parser.js";
import {
  decompositionPrompt,
  falsificationPrompt,
  positiveAnalysisPrompt,
  renderDeepResearchDecompositionPrompt,
  renderDeepResearchFalsificationPrompt,
  renderDeepResearchPositivePrompt,
} from "./deep-research-analysis.prompts.js";
import type { ResearchSubQuestion } from "./deep-research-analysis.records.js";
import {
  persistFalsificationAnswer,
  persistPositiveAnswer,
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
        subQuestions: parsed.subQuestions,
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

const runPositivePhase = async (
  context: AnalysisExecutionContext,
  subQuestion: ResearchSubQuestion,
) =>
  runPromptExchange<DeepResearchPositiveAnswer>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt: positiveAnalysisPrompt,
    promptKey: `positive:${subQuestion.id}`,
    renderedPromptText: renderDeepResearchPositivePrompt({
      userQuestion: context.input.userQuestion,
      analysisGoal: context.input.analysisGoal,
      language: context.input.language,
      subQuestion: subQuestion.question,
    }),
    inputRefs: [`job:${context.jobId}:user-question`, `sub-question:${subQuestion.id}`],
    stages: {
      send: "POSITIVE_SEND",
      capture: "POSITIVE_CAPTURE",
      parse: "POSITIVE_PARSE",
      persist: "POSITIVE_PERSIST",
    },
    subQuestionId: subQuestion.id,
    parse: parseDeepResearchPositiveResponse,
    successRecordCount: () => 1,
    persist: ({ interaction, parsed }) =>
      persistPositiveAnswer({
        store: context.store,
        jobId: context.jobId,
        interaction,
        subQuestionId: subQuestion.id,
        parsed,
      }),
  });

const runFalsificationPhase = async (
  context: AnalysisExecutionContext,
  subQuestion: ResearchSubQuestion,
  positiveAnswer: DeepResearchPositiveAnswer,
) =>
  runPromptExchange<DeepResearchFalsificationAnswer>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    prompt: falsificationPrompt,
    promptKey: `falsification:${subQuestion.id}`,
    renderedPromptText: renderDeepResearchFalsificationPrompt({
      userQuestion: context.input.userQuestion,
      analysisGoal: context.input.analysisGoal,
      language: context.input.language,
      subQuestion: subQuestion.question,
      positiveAnswer,
    }),
    inputRefs: [`job:${context.jobId}:user-question`, `sub-question:${subQuestion.id}`],
    stages: {
      send: "FALSIFY_SEND",
      capture: "FALSIFY_CAPTURE",
      parse: "FALSIFY_PARSE",
      persist: "FALSIFY_PERSIST",
    },
    subQuestionId: subQuestion.id,
    parse: parseDeepResearchFalsificationResponse,
    successRecordCount: () => 1,
    persist: ({ interaction, parsed }) =>
      persistFalsificationAnswer({
        store: context.store,
        jobId: context.jobId,
        interaction,
        subQuestionId: subQuestion.id,
        parsed,
      }),
  });

const runSubQuestionPhase = async (
  context: AnalysisExecutionContext,
  subQuestion: ResearchSubQuestion,
): Promise<{ completed: boolean }> => {
  const positive = await runPositivePhase(context, subQuestion);
  if (positive.status !== "parsed") {
    return { completed: false };
  }
  const falsification = await runFalsificationPhase(
    context,
    subQuestion,
    positive.parsed,
  );
  if (falsification.status !== "parsed") {
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
