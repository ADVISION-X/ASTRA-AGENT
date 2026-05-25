import { z } from "zod";

import { stableJsonHash } from "../../lib/storage/hash.js";
import {
  finalAdjudicationPrompt,
} from "./deep-research-analysis.prompts.js";
import type { DeepResearchSourceNote } from "./deep-research-analysis.result.js";
import { DeepResearchSourceNoteSchema } from "./deep-research-analysis.result.js";
import type {
  DeepResearchPromptOutputContract,
} from "./deep-research-analysis.prompt-contracts.js";
import type {
  DeepResearchRecordStore,
  ResearchAnswer,
  ResearchInteraction,
  ResearchJob,
  ResearchSubQuestion,
} from "./deep-research-analysis.records.js";
import { buildDeepResearchSourceNotesFromAnswers } from "./deep-research-analysis.source-notes.js";

const DeepResearchAnalysisCoverageSchema = z.object({
  totalSubQuestionCount: z.number().int().nonnegative(),
  analyzedSubQuestionCount: z.number().int().nonnegative(),
  missingAnalysisSubQuestionCount: z.number().int().nonnegative(),
  coverageRatio: z.number().min(0).max(1),
}).strict();

const DeepResearchFinalPackageBaseSchema = z.object({
  jobId: z.string().trim().min(1),
  userQuestion: z.string().trim().min(1),
  analysisGoal: z.string().trim().min(1).nullable(),
  decompositionRecords: z.array(z.unknown()),
  analysisRecords: z.array(z.unknown()),
  analysisCoverage: DeepResearchAnalysisCoverageSchema,
  missingAnalysisSubQuestionIds: z.array(z.string().trim().min(1)).default([]),
  sourceNotes: z.array(DeepResearchSourceNoteSchema).default([]),
  recordHashes: z.record(z.string(), z.string()),
  promptVersions: z.record(z.string(), z.string()),
  outputContract: z.object({
    contractId: z.string().trim().min(1),
    format: z.literal("json_object"),
    requiredFields: z.array(z.string().trim().min(1)).min(1),
    forbiddenFields: z.array(z.string().trim().min(1)).min(1),
  }).strict(),
  flowMode: z.literal("default_1_n_1_1"),
}).strict();

const DeepResearchFinalPackageSchema = DeepResearchFinalPackageBaseSchema;

type DeepResearchFinalPackageBase = {
  jobId: string;
  userQuestion: string;
  analysisGoal: string | null;
  decompositionRecords: ResearchSubQuestion[];
  analysisRecords: ResearchAnswer[];
  analysisCoverage: {
    totalSubQuestionCount: number;
    analyzedSubQuestionCount: number;
    missingAnalysisSubQuestionCount: number;
    coverageRatio: number;
  };
  missingAnalysisSubQuestionIds: string[];
  sourceNotes: DeepResearchSourceNote[];
  recordHashes: Record<string, string>;
  promptVersions: Record<string, string>;
  outputContract: DeepResearchPromptOutputContract;
  flowMode: "default_1_n_1_1";
};

export type DeepResearchFinalPackage = DeepResearchFinalPackageBase;

const buildPromptVersionMap = (interactions: readonly ResearchInteraction[]): Record<string, string> =>
  interactions.reduce<Record<string, string>>((accumulator, interaction) => {
    accumulator[interaction.promptId] = interaction.promptVersion;
    return accumulator;
  }, {});

const appendHashes = (hashes: Record<string, string>, prefix: string, value: unknown): void => {
  hashes[prefix] = stableJsonHash(value);
};

const buildRecordHashes = (input: {
  job: ResearchJob;
  subQuestions: readonly ResearchSubQuestion[];
  analysisAnswers: readonly ResearchAnswer[];
  missingAnalysisSubQuestionIds: readonly string[];
  interactions: readonly ResearchInteraction[];
}): Record<string, string> => {
  const hashes: Record<string, string> = {};
  appendHashes(hashes, `job:${input.job.id}`, input.job);
  input.subQuestions.forEach((record) => appendHashes(hashes, `subQuestion:${record.id}`, record));
  input.analysisAnswers.forEach((record) => appendHashes(hashes, `analysis:${record.id}`, record));
  appendHashes(hashes, `missing-analysis-sub-questions:${input.job.id}`, input.missingAnalysisSubQuestionIds);
  input.interactions.forEach((record) => {
    hashes[`interaction:${record.id}:prompt`] = record.promptHash;
    hashes[`interaction:${record.id}:response`] = record.rawResponseHash;
  });
  return hashes;
};

const buildAnalysisCoverage = (
  subQuestions: readonly ResearchSubQuestion[],
  analysisAnswers: readonly ResearchAnswer[],
) => {
  const totalSubQuestionCount = subQuestions.length;
  const analyzedSubQuestionCount = new Set(
    analysisAnswers.map((answer) => answer.subQuestionId),
  ).size;
  const missingAnalysisSubQuestionCount = Math.max(
    0,
    totalSubQuestionCount - analyzedSubQuestionCount,
  );
  return {
    totalSubQuestionCount,
    analyzedSubQuestionCount,
    missingAnalysisSubQuestionCount,
    coverageRatio: totalSubQuestionCount === 0
      ? 0
      : analyzedSubQuestionCount / totalSubQuestionCount,
  };
};

type DeepResearchFinalPackageState = {
  job: ResearchJob;
  subQuestions: ResearchSubQuestion[];
  analysisAnswers: ResearchAnswer[];
  interactions: ResearchInteraction[];
  missingAnalysisSubQuestionIds: string[];
};

const loadDeepResearchFinalPackageState = (
  store: DeepResearchRecordStore,
  jobId: string,
): DeepResearchFinalPackageState => {
  const job = store.getJob(jobId);
  if (!job) {
    throw new Error(`Deep research job ${jobId} was not found.`);
  }
  const subQuestions = store.listSubQuestions(jobId);
  const analysisAnswers = store.listAnswers({ jobId, answerKind: "analysis" });
  const interactions = store.listInteractions(jobId);
  const analysisSubQuestionIds = new Set(analysisAnswers.map((answer) => answer.subQuestionId));
  return {
    job,
    subQuestions,
    analysisAnswers,
    interactions,
    missingAnalysisSubQuestionIds: subQuestions
      .filter((subQuestion) => !analysisSubQuestionIds.has(subQuestion.id))
      .map((subQuestion) => subQuestion.id),
  };
};

const validateDeepResearchFinalPackageState = (
  jobId: string,
  state: DeepResearchFinalPackageState,
): void => {
  if (state.subQuestions.length === 0) {
    throw new Error(`Deep research job ${jobId} has no persisted sub-question records.`);
  }
  const rawAnalysisInteractionCount = state.interactions.filter((interaction) =>
    interaction.phase === "analysis" && interaction.rawResponseText.trim().length > 0,
  ).length;
  if (
    state.analysisAnswers.length === 0
    && rawAnalysisInteractionCount === 0
  ) {
    throw new Error(`Deep research job ${jobId} is missing both persisted and raw independent analysis records.`);
  }
};

const buildDeepResearchFinalPackageBase = (
  state: DeepResearchFinalPackageState,
): DeepResearchFinalPackageBase => ({
  jobId: state.job.id,
  userQuestion: state.job.userQuestion,
  analysisGoal: state.job.analysisGoal,
  decompositionRecords: state.subQuestions,
  analysisRecords: state.analysisAnswers,
  analysisCoverage: buildAnalysisCoverage(state.subQuestions, state.analysisAnswers),
  missingAnalysisSubQuestionIds: state.missingAnalysisSubQuestionIds,
  sourceNotes: buildDeepResearchSourceNotesFromAnswers(state.analysisAnswers),
  recordHashes: {},
  promptVersions: buildPromptVersionMap(state.interactions),
  outputContract: finalAdjudicationPrompt.expectedOutputContract,
  flowMode: "default_1_n_1_1",
});

const buildSingleFlowFinalPackage = (
  baseFinalPackage: DeepResearchFinalPackageBase,
  state: DeepResearchFinalPackageState,
): DeepResearchFinalPackage => ({
  ...baseFinalPackage,
  flowMode: "default_1_n_1_1",
  recordHashes: buildRecordHashes({
    job: state.job,
    subQuestions: state.subQuestions,
    analysisAnswers: state.analysisAnswers,
    missingAnalysisSubQuestionIds: state.missingAnalysisSubQuestionIds,
    interactions: state.interactions,
  }),
});

export const buildDeepResearchFinalPackage = (input: {
  store: DeepResearchRecordStore;
  jobId: string;
}): DeepResearchFinalPackage => {
  const state = loadDeepResearchFinalPackageState(input.store, input.jobId);
  validateDeepResearchFinalPackageState(input.jobId, state);
  const baseFinalPackage = buildDeepResearchFinalPackageBase(state);
  const finalPackage = buildSingleFlowFinalPackage(baseFinalPackage, state);
  return DeepResearchFinalPackageSchema.parse(finalPackage) as DeepResearchFinalPackage;
};
