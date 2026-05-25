import { z } from "zod";

import { stableJsonHash } from "../../lib/storage/hash.js";
import {
  finalAdjudicationShellPrompt,
} from "./deep-research-analysis.final-adjudication-prompt.js";
import type { DeepResearchSourceNote } from "./deep-research-analysis.result.js";
import { DeepResearchSourceNoteSchema } from "./deep-research-analysis.result.js";
import type {
  DeepResearchPromptOutputContract,
} from "./deep-research-analysis.prompt-contracts.js";
import { buildDeepResearchPromptBundleExport } from "./deep-research-analysis.research-plan-persist.js";
import type { DeepResearchPlan } from "./deep-research-analysis.research-plan-schema.js";
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

const DeepResearchStructuredIndexBaseSchema = z.object({
  jobId: z.string().trim().min(1),
  userQuestion: z.string().trim().min(1),
  analysisGoal: z.string().trim().min(1).nullable(),
  researchPlan: z.unknown(),
  promptBundles: z.unknown(),
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
}).strict();

const DeepResearchStructuredIndexSchema = DeepResearchStructuredIndexBaseSchema;

type DeepResearchStructuredIndexBase = {
  jobId: string;
  userQuestion: string;
  analysisGoal: string | null;
  researchPlan: DeepResearchPlan;
  promptBundles: ReturnType<typeof buildDeepResearchPromptBundleExport>;
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
};

export type DeepResearchStructuredIndex = DeepResearchStructuredIndexBase;

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

type DeepResearchStructuredIndexState = {
  job: ResearchJob;
  researchPlan: DeepResearchPlan;
  subQuestions: ResearchSubQuestion[];
  analysisAnswers: ResearchAnswer[];
  interactions: ResearchInteraction[];
  missingAnalysisSubQuestionIds: string[];
};

const loadDeepResearchStructuredIndexState = (
  store: DeepResearchRecordStore,
  jobId: string,
): DeepResearchStructuredIndexState => {
  const job = store.getJob(jobId);
  if (!job) {
    throw new Error(`Deep research job ${jobId} was not found.`);
  }
  const subQuestions = store.listSubQuestions(jobId);
  const researchPlan = store.getResearchPlan(jobId);
  if (!researchPlan) {
    throw new Error(`Deep research job ${jobId} has no persisted ResearchPlan.`);
  }
  const analysisAnswers = store.listAnswers({ jobId, answerKind: "analysis" });
  const interactions = store.listInteractions(jobId);
  const analysisSubQuestionIds = new Set(analysisAnswers.map((answer) => answer.subQuestionId));
  return {
    job,
    researchPlan,
    subQuestions,
    analysisAnswers,
    interactions,
    missingAnalysisSubQuestionIds: subQuestions
      .filter((subQuestion) => !analysisSubQuestionIds.has(subQuestion.id))
      .map((subQuestion) => subQuestion.id),
  };
};

const validateDeepResearchStructuredIndexState = (
  jobId: string,
  state: DeepResearchStructuredIndexState,
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

const buildDeepResearchStructuredIndexBase = (
  state: DeepResearchStructuredIndexState,
): DeepResearchStructuredIndexBase => ({
  jobId: state.job.id,
  userQuestion: state.job.userQuestion,
  analysisGoal: state.job.analysisGoal,
  researchPlan: state.researchPlan,
  promptBundles: buildDeepResearchPromptBundleExport({
    researchPlan: state.researchPlan,
    subQuestions: state.subQuestions,
  }),
  decompositionRecords: state.subQuestions,
  analysisRecords: state.analysisAnswers,
  analysisCoverage: buildAnalysisCoverage(state.subQuestions, state.analysisAnswers),
  missingAnalysisSubQuestionIds: state.missingAnalysisSubQuestionIds,
  sourceNotes: buildDeepResearchSourceNotesFromAnswers(state.analysisAnswers),
  recordHashes: {},
  promptVersions: buildPromptVersionMap(state.interactions),
  outputContract: finalAdjudicationShellPrompt.expectedOutputContract,
});

const buildSingleFlowStructuredIndex = (
  baseStructuredIndex: DeepResearchStructuredIndexBase,
  state: DeepResearchStructuredIndexState,
): DeepResearchStructuredIndex => ({
  ...baseStructuredIndex,
  recordHashes: buildRecordHashes({
    job: state.job,
    subQuestions: state.subQuestions,
    analysisAnswers: state.analysisAnswers,
    missingAnalysisSubQuestionIds: state.missingAnalysisSubQuestionIds,
    interactions: state.interactions,
  }),
});

export const buildDeepResearchStructuredIndex = (input: {
  store: DeepResearchRecordStore;
  jobId: string;
}): DeepResearchStructuredIndex => {
  const state = loadDeepResearchStructuredIndexState(input.store, input.jobId);
  validateDeepResearchStructuredIndexState(input.jobId, state);
  const baseStructuredIndex = buildDeepResearchStructuredIndexBase(state);
  const structuredIndex = buildSingleFlowStructuredIndex(baseStructuredIndex, state);
  return DeepResearchStructuredIndexSchema.parse(structuredIndex) as DeepResearchStructuredIndex;
};