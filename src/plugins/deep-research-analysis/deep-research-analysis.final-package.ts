import { z } from "zod";

import { stableJsonHash } from "../../lib/storage/hash.js";
import {
  finalAdjudicationPrompt,
  finalSynthesisPrompt,
} from "./deep-research-analysis.prompts.js";
import type {
  DeepResearchConflictMatrixRow,
} from "./deep-research-analysis.result.js";
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
  recordHashes: z.record(z.string(), z.string()),
  promptVersions: z.record(z.string(), z.string()),
  outputContract: z.object({
    contractId: z.string().trim().min(1),
    format: z.literal("json_object"),
    requiredFields: z.array(z.string().trim().min(1)).min(1),
    forbiddenFields: z.array(z.string().trim().min(1)).min(1),
  }).strict(),
}).strict();

const DeepResearchDefaultFinalPackageSchema = DeepResearchFinalPackageBaseSchema.extend({
  flowMode: z.literal("default_1_n_1"),
}).strict();

const DeepResearchBusinessDeckFinalPackageSchema = DeepResearchFinalPackageBaseSchema.extend({
  flowMode: z.literal("default_1_n_1_1"),
}).strict();

const DeepResearchLegacyFinalPackageSchema = DeepResearchFinalPackageBaseSchema.extend({
  flowMode: z.literal("legacy_1_n_n_1"),
  positiveAnswerRecords: z.array(z.unknown()).default([]),
  falsificationAnswerRecords: z.array(z.unknown()).default([]),
  conflictMatrix: z.array(z.unknown()).default([]),
  legacyMissingPositiveFalsificationSubQuestionIds: z.array(z.string().trim().min(1)).default([]),
}).strict();

const DeepResearchFinalPackageSchema = z.discriminatedUnion("flowMode", [
  DeepResearchDefaultFinalPackageSchema,
  DeepResearchBusinessDeckFinalPackageSchema,
  DeepResearchLegacyFinalPackageSchema,
]);

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
  recordHashes: Record<string, string>;
  promptVersions: Record<string, string>;
  outputContract: DeepResearchPromptOutputContract;
};

export type DeepResearchDefaultFinalPackage = DeepResearchFinalPackageBase & {
  flowMode: "default_1_n_1" | "default_1_n_1_1";
};

export type DeepResearchLegacyFinalPackage = DeepResearchFinalPackageBase & {
  flowMode: "legacy_1_n_n_1";
  positiveAnswerRecords: ResearchAnswer[];
  falsificationAnswerRecords: ResearchAnswer[];
  conflictMatrix: DeepResearchConflictMatrixRow[];
  legacyMissingPositiveFalsificationSubQuestionIds: string[];
};

export type DeepResearchFinalPackage = DeepResearchDefaultFinalPackage | DeepResearchLegacyFinalPackage;

type LegacyHashInput = {
  positiveAnswers: readonly ResearchAnswer[];
  falsificationAnswers: readonly ResearchAnswer[];
  conflictMatrix: readonly DeepResearchConflictMatrixRow[];
  legacyMissingPositiveFalsificationSubQuestionIds: readonly string[];
};

const isDefaultFlowMode = (flowMode: ResearchJob["flowMode"]): boolean =>
  flowMode === "default_1_n_1" || flowMode === "default_1_n_1_1";

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
  legacy?: LegacyHashInput;
}): Record<string, string> => {
  const hashes: Record<string, string> = {};
  appendHashes(hashes, `job:${input.job.id}`, input.job);
  input.subQuestions.forEach((record) => appendHashes(hashes, `subQuestion:${record.id}`, record));
  input.analysisAnswers.forEach((record) => appendHashes(hashes, `analysis:${record.id}`, record));
  appendHashes(hashes, `missing-analysis-sub-questions:${input.job.id}`, input.missingAnalysisSubQuestionIds);
  if (input.legacy) {
    input.legacy.positiveAnswers.forEach((record) => appendHashes(hashes, `positive:${record.id}`, record));
    input.legacy.falsificationAnswers.forEach((record) => appendHashes(hashes, `falsification:${record.id}`, record));
    input.legacy.conflictMatrix.forEach((record) => appendHashes(hashes, `conflict:${record.subQuestionId}`, record));
    appendHashes(
      hashes,
      `legacy-missing-positive-falsification-sub-questions:${input.job.id}`,
      input.legacy.legacyMissingPositiveFalsificationSubQuestionIds,
    );
  }
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
  positiveAnswers: ResearchAnswer[];
  falsificationAnswers: ResearchAnswer[];
  conflictMatrix: DeepResearchConflictMatrixRow[];
  interactions: ResearchInteraction[];
  missingAnalysisSubQuestionIds: string[];
  legacyMissingPositiveFalsificationSubQuestionIds: string[];
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
  const positiveAnswers = store.listAnswers({ jobId, answerKind: "positive" });
  const falsificationAnswers = store.listAnswers({ jobId, answerKind: "falsification" });
  const conflictMatrix = store.listConflictMatrix(jobId).map((record) => record.row);
  const interactions = store.listInteractions(jobId);
  const analysisSubQuestionIds = new Set(analysisAnswers.map((answer) => answer.subQuestionId));
  const positiveSubQuestionIds = new Set(positiveAnswers.map((answer) => answer.subQuestionId));
  const falsificationSubQuestionIds = new Set(falsificationAnswers.map((answer) => answer.subQuestionId));
  return {
    job,
    subQuestions,
    analysisAnswers,
    positiveAnswers,
    falsificationAnswers,
    conflictMatrix,
    interactions,
    missingAnalysisSubQuestionIds: subQuestions
      .filter((subQuestion) => !analysisSubQuestionIds.has(subQuestion.id))
      .map((subQuestion) => subQuestion.id),
    legacyMissingPositiveFalsificationSubQuestionIds: subQuestions
      .filter((subQuestion) =>
        !positiveSubQuestionIds.has(subQuestion.id)
        || !falsificationSubQuestionIds.has(subQuestion.id))
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
  if (isDefaultFlowMode(state.job.flowMode) && state.analysisAnswers.length === 0) {
    throw new Error(`Deep research job ${jobId} is missing persisted independent analysis records.`);
  }
  if (
    state.job.flowMode === "legacy_1_n_n_1"
    && (
      state.positiveAnswers.length === 0
      || state.falsificationAnswers.length === 0
      || state.conflictMatrix.length === 0
    )
  ) {
    throw new Error(`Deep research job ${jobId} has no persisted conflict matrix.`);
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
  recordHashes: {},
  promptVersions: buildPromptVersionMap(state.interactions),
  outputContract: state.job.flowMode === "legacy_1_n_n_1"
    ? finalSynthesisPrompt.expectedOutputContract
    : finalAdjudicationPrompt.expectedOutputContract,
});

const buildLegacyFinalPackage = (
  baseFinalPackage: DeepResearchFinalPackageBase,
  state: DeepResearchFinalPackageState,
): DeepResearchLegacyFinalPackage => ({
  ...baseFinalPackage,
  flowMode: "legacy_1_n_n_1",
  positiveAnswerRecords: state.positiveAnswers,
  falsificationAnswerRecords: state.falsificationAnswers,
  conflictMatrix: state.conflictMatrix,
  legacyMissingPositiveFalsificationSubQuestionIds:
    state.legacyMissingPositiveFalsificationSubQuestionIds,
  recordHashes: buildRecordHashes({
    job: state.job,
    subQuestions: state.subQuestions,
    analysisAnswers: state.analysisAnswers,
    missingAnalysisSubQuestionIds: state.missingAnalysisSubQuestionIds,
    interactions: state.interactions,
    legacy: {
      positiveAnswers: state.positiveAnswers,
      falsificationAnswers: state.falsificationAnswers,
      conflictMatrix: state.conflictMatrix,
      legacyMissingPositiveFalsificationSubQuestionIds:
        state.legacyMissingPositiveFalsificationSubQuestionIds,
    },
  }),
});

const buildDefaultFinalPackage = (
  baseFinalPackage: DeepResearchFinalPackageBase,
  state: DeepResearchFinalPackageState,
): DeepResearchDefaultFinalPackage => ({
  ...baseFinalPackage,
  flowMode: state.job.flowMode === "default_1_n_1_1" ? "default_1_n_1_1" : "default_1_n_1",
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
  const finalPackage: DeepResearchFinalPackage = state.job.flowMode === "legacy_1_n_n_1"
    ? buildLegacyFinalPackage(baseFinalPackage, state)
    : buildDefaultFinalPackage(baseFinalPackage, state);
  return DeepResearchFinalPackageSchema.parse(finalPackage) as DeepResearchFinalPackage;
};
