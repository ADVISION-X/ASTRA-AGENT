import { z } from "zod";
import { stableJsonHash } from "../../lib/storage/hash.js";
import type { DeepResearchSourceNote } from "./deep-research-analysis.parser.js";
import { DeepResearchSourceNoteSchema } from "./deep-research-analysis.parser.js";
import type {
    DeepResearchPromptOutputContract,
} from "./deep-research-analysis.prompt-bundle-shell.js";
import {
    buildFinalAdjudicationOutputContract,
} from "./deep-research-analysis.prompts.js";
import { buildDeepResearchPromptBundleExport } from "./deep-research-analysis.record-interaction-ops.js";
import type {
    DeepResearchRecordStore, ResearchAnswer, ResearchInteraction,
    ResearchJob,
    ResearchSubQuestion
} from "./deep-research-analysis.records.js";
import type { DeepResearchPlan } from "./deep-research-analysis.schema.js";

type SourceNoteInput = {
  note: string;
  sourceType: DeepResearchSourceNote["sourceType"];
  subQuestionId?: string | null;
};

const normalizeSourceNoteText = (value: string): string =>
  value.trim().split(/\s+/u).join(" ");

const buildSourceNoteId = (index: number): string =>
  `source-note-${String(index + 1).padStart(3, "0")}`;

const readUrl = (note: string): string | null => {
  const token = note.split(/\s+/u).find((part) =>
    part.startsWith("https://") || part.startsWith("http://"));
  return token ?? null;
};

export const buildDeepResearchSourceNotes = (
  inputs: readonly SourceNoteInput[],
): DeepResearchSourceNote[] => {
  const grouped = new Map<string, { note: string; sourceType: DeepResearchSourceNote["sourceType"]; subQuestionIds: Set<string> }>();
  for (const input of inputs) {
    const note = normalizeSourceNoteText(input.note);
    if (!note) continue;
    const key = note.toLocaleLowerCase();
    const existing = grouped.get(key) ?? {
      note,
      sourceType: input.sourceType,
      subQuestionIds: new Set<string>(),
    };
    if (input.subQuestionId) {
      existing.subQuestionIds.add(input.subQuestionId);
    }
    grouped.set(key, existing);
  }
  return [...grouped.values()].map((entry, index) => ({
    sourceNoteId: buildSourceNoteId(index),
    label: `Source Note ${index + 1}`,
    note: entry.note,
    sourceType: entry.sourceType,
    subQuestionIds: [...entry.subQuestionIds].sort(),
    url: readUrl(entry.note),
  }));
};

export const buildDeepResearchSourceNotesFromAnswers = (
  answers: readonly ResearchAnswer[],
): DeepResearchSourceNote[] =>
  buildDeepResearchSourceNotes(
    answers.flatMap((answer) =>
      answer.evidenceMentions.map((note) => ({
        note,
        sourceType: "analysis_evidence_mention",
        subQuestionId: answer.subQuestionId,
      }))),
  );

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
    format: z.literal("structured_text"),
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
  outputContract: buildFinalAdjudicationOutputContract(),
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
