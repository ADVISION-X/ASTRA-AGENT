import type { ExchangePersistSummary } from "./deep-research-analysis.analysis-runner.js";
import {
    finishPromptFailure,
    type AnalysisExecutionContext,
    type AnalysisFailure,
    type AnalysisOutcome,
} from "./deep-research-analysis.analysis-runner.js";
import type { DeepResearchSubQuestionAnalysisAnswer } from "./deep-research-analysis.parser.js";
import {
    parseDeepResearchDecompositionResponse,
    parseDeepResearchSubQuestionAnalysisResponse,
} from "./deep-research-analysis.parser.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-bundle-shell.js";
import {
    renderSubQuestionAnalysisFromPromptBundle,
    SUB_QUESTION_ANSWER_TEXT_BEGIN,
    SUB_QUESTION_ANSWER_TEXT_END,
} from "./deep-research-analysis.prompt-bundle-shell.js";
import { runPromptExchange } from "./deep-research-analysis.prompt-exchange.js";
import {
    buildDecompositionPrompt,
    renderDeepResearchDecompositionPrompt,
    requireSubQuestionPromptBundle,
} from "./deep-research-analysis.prompts.js";
import type { ResearchSubQuestion } from "./deep-research-analysis.records.js";
import { type DeepResearchRecordStore, type ResearchInteraction } from "./deep-research-analysis.records.js";
import type { DeepResearchDecompositionResponse, DeepResearchSubQuestion } from "./deep-research-analysis.schema.js";

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
  analysisFocus: subQuestion.promptBundle.questionSpecificFocus.join("; "),
  requiredEvidence: [...subQuestion.promptBundle.evidenceOrReasoningNeeds],
  scope: subQuestion.scope,
  expectedAnswerShape: subQuestion.promptBundle.outputGuidance.preferredFormat,
  omissionRisk: subQuestion.omissionRisk,
  promptBundle: subQuestion.promptBundle,
});

const buildPromptBundleShellPrompt = (input: {
  promptVersion: string;
  phase: DeepResearchPrompt["phase"];
}): DeepResearchPrompt => ({
  promptId: "deep-research.sub-question-analysis",
  promptVersion: input.promptVersion,
  phase: input.phase,
  promptText: "Runtime shell for AI-generated promptBundle.",
  expectedOutputContract: {
    contractId: `deep-research.sub-question-analysis.shell.${input.promptVersion}`,
    format: "structured_text",
    requiredFields: [SUB_QUESTION_ANSWER_TEXT_BEGIN, SUB_QUESTION_ANSWER_TEXT_END],
    forbiddenFields: [
      "browserCommand",
      "selector",
      "coordinate",
      "workflow",
      "multiStepPlan",
      "runNext",
      "databaseCommand",
      "filePath",
    ],
  },
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
    prompt: buildDecompositionPrompt(),
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
      context.store.saveResearchPlan({
        jobId: context.jobId,
        interactionId: interaction.id,
        researchPlan: parsed,
      });
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
): Promise<Awaited<ReturnType<typeof runPromptExchange<DeepResearchSubQuestionAnalysisAnswer>>>> => {
  const promptBundle = subQuestion.question.promptBundle ?? requireSubQuestionPromptBundle(subQuestion.question);
  return runPromptExchange<DeepResearchSubQuestionAnalysisAnswer>({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    stageLogger: context.stageLogger,
    sender: context.sender,
    recordHashes: context.recordHashes,
    jobId: context.jobId,
    providerKind: context.providerKind,
    promptKey: `analysis:${subQuestion.id}`,
    prompt: buildPromptBundleShellPrompt({
      promptVersion: "v2.0.0",
      phase: "analysis",
    }),
    renderedPromptText: renderSubQuestionAnalysisFromPromptBundle({
      userQuestion: context.input.userQuestion,
      analysisGoal: context.input.analysisGoal,
      language: context.input.language,
      subQuestion: subQuestion.question,
      promptBundle,
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
};

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
  ok: true;
};

const runSubQuestionPhase = async (
  context: AnalysisExecutionContext,
  subQuestion: ResearchSubQuestion,
): Promise<SubQuestionPhaseOutcome | AnalysisFailure> => {
  const analysis = await runAnalysisPhase(context, subQuestion);
  if ("rawAvailableForCaseFile" in analysis) {
    context.recordHashes[`analysis-raw-available:${subQuestion.id}:prompt`] = analysis.promptHash;
    context.recordHashes[`analysis-raw-available:${subQuestion.id}:response`] = analysis.rawResponseHash;
    return { ok: true };
  }
  if (analysis.status !== "parsed") {
    rememberFailedAnalysisHashes({
      context,
      subQuestionId: subQuestion.id,
      promptHash: analysis.promptHash,
      rawResponseHash: analysis.rawResponseHash,
    });
    return finishPromptFailure(context, analysis);
  }
  return { ok: true };
};

export const runSubQuestionPhases = async (
  context: AnalysisExecutionContext,
  subQuestions: readonly ResearchSubQuestion[],
): Promise<AnalysisOutcome> => {
  for (const subQuestion of subQuestions) {
    const outcome = await runSubQuestionPhase(context, subQuestion);
    if (!outcome.ok) {
      return outcome;
    }
  }
  return { ok: true };
};
