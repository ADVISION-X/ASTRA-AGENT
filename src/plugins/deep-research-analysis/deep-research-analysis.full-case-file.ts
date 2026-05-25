import { isDeepResearchSuccessfulParseStatus } from "./deep-research-analysis.parser-support.js";
import {
  DeepResearchFullCaseFileSchema,
  type DeepResearchFullCaseFile,
} from "./deep-research-analysis.full-case-file-schema.js";
import type {
  DeepResearchStructuredIndex,
} from "./deep-research-analysis.structured-index.js";
import type {
  DeepResearchRecordStore,
  ResearchAnswer,
  ResearchInteraction,
  ResearchJob,
  ResearchSubQuestion,
} from "./deep-research-analysis.records.js";

const hasNonEmptyRawResponse = (interaction: ResearchInteraction): boolean =>
  interaction.rawResponseText.trim().length > 0;

const isRawAvailableParseFailure = (interaction: ResearchInteraction): boolean =>
  hasNonEmptyRawResponse(interaction)
  && !isDeepResearchSuccessfulParseStatus(interaction.parseStatus);

const buildStructuredAnswer = (answer: ResearchAnswer | null): unknown | null => {
  if (!answer) {
    return null;
  }
  return {
    id: answer.id,
    interactionId: answer.interactionId,
    answerKind: answer.answerKind,
    answerText: answer.answerText,
    keyPoints: answer.keyPoints,
    evidenceMentions: answer.evidenceMentions,
    assumptions: answer.assumptions,
    limitations: answer.limitations,
    contradictionPoints: answer.contradictionPoints,
    parsedPayload: answer.parsedPayload,
    confidence: answer.confidence,
  };
};

const buildAnalysisInteractionBySubQuestionId = (
  interactions: readonly ResearchInteraction[],
): Map<string, ResearchInteraction> => {
  const map = new Map<string, ResearchInteraction>();
  for (const interaction of interactions) {
    if (interaction.phase !== "analysis" || !interaction.subQuestionId) {
      continue;
    }
    map.set(interaction.subQuestionId, interaction);
  }
  return map;
};

const buildAnswerBySubQuestionId = (
  answers: readonly ResearchAnswer[],
): Map<string, ResearchAnswer> => {
  const map = new Map<string, ResearchAnswer>();
  for (const answer of answers) {
    map.set(answer.subQuestionId, answer);
  }
  return map;
};

const buildInteractionById = (
  interactions: readonly ResearchInteraction[],
): Map<string, ResearchInteraction> =>
  new Map(interactions.map((interaction) => [interaction.id, interaction]));

const buildPromptInteraction = (interaction: ResearchInteraction | null) => {
  if (!interaction) {
    return null;
  }
  return {
    interactionId: interaction.id,
    promptId: interaction.promptId,
    promptVersion: interaction.promptVersion,
    renderedPromptText: interaction.renderedPromptText,
    rawResponseText: interaction.rawResponseText,
    rawResponseHash: interaction.rawResponseHash,
    normalizedText: interaction.normalizedText,
    parseStatus: interaction.parseStatus,
    providerProofJson: interaction.providerProofJson,
  };
};

const buildCoverage = (input: {
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  interactions: readonly ResearchInteraction[];
}) => {
  const totalSubQuestionCount = input.subQuestions.length;
  const structuredAnalysisCount = new Set(
    input.answers.map((answer) => answer.subQuestionId),
  ).size;
  const rawAnalysisInteractionCount = new Set(
    input.interactions
      .filter((interaction) => interaction.phase === "analysis" && interaction.subQuestionId && hasNonEmptyRawResponse(interaction))
      .map((interaction) => interaction.subQuestionId),
  ).size;
  return {
    totalSubQuestionCount,
    structuredAnalysisCount,
    rawAnalysisInteractionCount,
    rawCoverageRatio: totalSubQuestionCount === 0
      ? 0
      : rawAnalysisInteractionCount / totalSubQuestionCount,
    structuredCoverageRatio: totalSubQuestionCount === 0
      ? 0
      : structuredAnalysisCount / totalSubQuestionCount,
  };
};

const buildDecompositionCase = (input: {
  interactions: readonly ResearchInteraction[];
  structuredIndex: DeepResearchStructuredIndex;
}) => {
  const interaction = input.interactions.find((entry) => entry.phase === "decomposition") ?? null;
  if (!interaction) {
    return null;
  }
  return {
    interactionId: interaction.id,
    promptId: interaction.promptId,
    promptVersion: interaction.promptVersion,
    renderedPromptText: interaction.renderedPromptText,
    rawResponseText: interaction.rawResponseText,
    rawResponseHash: interaction.rawResponseHash,
    normalizedText: interaction.normalizedText,
    parseStatus: interaction.parseStatus,
    parsedSubQuestions: input.structuredIndex.decompositionRecords,
  };
};

const buildSubQuestionAnalyses = (input: {
  subQuestions: readonly ResearchSubQuestion[];
  interactions: readonly ResearchInteraction[];
  answers: readonly ResearchAnswer[];
}): DeepResearchFullCaseFile["subQuestionAnalyses"] => {
  const interactionById = buildInteractionById(input.interactions);
  const analysisInteractionBySubQuestionId = buildAnalysisInteractionBySubQuestionId(input.interactions);
  const answerBySubQuestionId = buildAnswerBySubQuestionId(input.answers);
  return input.subQuestions.map((subQuestion) => {
    const answer = answerBySubQuestionId.get(subQuestion.id) ?? null;
    const interaction = answer
      ? interactionById.get(answer.interactionId) ?? null
      : analysisInteractionBySubQuestionId.get(subQuestion.id) ?? null;
    return {
      subQuestionId: subQuestion.id,
      modelQuestionId: subQuestion.modelQuestionId,
      title: subQuestion.question.title,
      questionText: subQuestion.question.questionText,
      promptInteraction: buildPromptInteraction(interaction),
      structuredAnswer: buildStructuredAnswer(answer),
      structuredAnswerStatus: answer
        ? "parsed"
        : interaction && isRawAvailableParseFailure(interaction)
          ? "parse_failed_raw_available"
          : "missing",
    };
  });
};

const buildFailedButRawAvailableInteractions = (
  interactions: readonly ResearchInteraction[],
): DeepResearchFullCaseFile["failedButRawAvailableInteractions"] =>
  interactions
    .filter(isRawAvailableParseFailure)
    .map((interaction) => ({
      interactionId: interaction.id,
      phase: interaction.phase,
      subQuestionId: interaction.subQuestionId,
      promptId: interaction.promptId,
      renderedPromptText: interaction.renderedPromptText,
      rawResponseText: interaction.rawResponseText,
      rawResponseHash: interaction.rawResponseHash,
      parseStatus: interaction.parseStatus,
    }));

const loadFullCaseFileState = (store: DeepResearchRecordStore, jobId: string): {
  job: ResearchJob;
  researchPlan: DeepResearchFullCaseFile["researchPlan"];
  interactions: ResearchInteraction[];
  subQuestions: ResearchSubQuestion[];
  answers: ResearchAnswer[];
} => {
  const job = store.getJob(jobId);
  const researchPlan = store.getResearchPlan(jobId);
  if (!job) {
    throw new Error(`Deep research job ${jobId} was not found.`);
  }
  if (!researchPlan) {
    throw new Error(`Deep research job ${jobId} has no persisted ResearchPlan.`);
  }
  return {
    job,
    researchPlan,
    interactions: store.listInteractions(jobId),
    subQuestions: store.listSubQuestions(jobId),
    answers: store.listAnswers({ jobId, answerKind: "analysis" }),
  };
};

export const buildDeepResearchFullCaseFile = (input: {
  store: DeepResearchRecordStore;
  jobId: string;
  structuredIndex: DeepResearchStructuredIndex;
}): DeepResearchFullCaseFile => {
  const state = loadFullCaseFileState(input.store, input.jobId);
  const fullCaseFile: DeepResearchFullCaseFile = {
    caseFileVersion: "v1",
    job: {
      jobId: state.job.id,
      userQuestion: state.job.userQuestion,
      analysisGoal: state.job.analysisGoal,
      language: state.job.language,
      createdAt: state.job.createdAt,
    },
    researchPlan: state.researchPlan,
    decomposition: buildDecompositionCase({
      interactions: state.interactions,
      structuredIndex: input.structuredIndex,
    }),
    subQuestionAnalyses: buildSubQuestionAnalyses({
      subQuestions: state.subQuestions,
      interactions: state.interactions,
      answers: state.answers,
    }),
    failedButRawAvailableInteractions: buildFailedButRawAvailableInteractions(state.interactions),
    structuredIndex: input.structuredIndex,
    sourceNotes: input.structuredIndex.sourceNotes,
    recordHashes: input.structuredIndex.recordHashes,
    coverage: buildCoverage({
      subQuestions: state.subQuestions,
      answers: state.answers,
      interactions: state.interactions,
    }),
  };
  return DeepResearchFullCaseFileSchema.parse(fullCaseFile) as DeepResearchFullCaseFile;
};
