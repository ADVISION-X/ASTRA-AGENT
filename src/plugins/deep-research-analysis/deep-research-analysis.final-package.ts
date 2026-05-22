import { z } from "zod";

import { stableJsonHash } from "../../lib/storage/hash.js";
import { finalSynthesisPrompt } from "./deep-research-analysis.prompts.js";
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

export const DeepResearchFinalPackageSchema = z.object({
  jobId: z.string().trim().min(1),
  userQuestion: z.string().trim().min(1),
  decompositionRecords: z.array(z.unknown()),
  positiveAnswerRecords: z.array(z.unknown()),
  falsificationAnswerRecords: z.array(z.unknown()),
  conflictMatrix: z.array(z.unknown()).min(1),
  recordHashes: z.record(z.string(), z.string()),
  promptVersions: z.record(z.string(), z.string()),
  outputContract: z.object({
    contractId: z.string().trim().min(1),
    format: z.literal("json_object"),
    requiredFields: z.array(z.string().trim().min(1)).min(1),
    forbiddenFields: z.array(z.string().trim().min(1)).min(1),
  }).strict(),
}).strict();

export type DeepResearchFinalPackage = {
  jobId: string;
  userQuestion: string;
  decompositionRecords: ResearchSubQuestion[];
  positiveAnswerRecords: ResearchAnswer[];
  falsificationAnswerRecords: ResearchAnswer[];
  conflictMatrix: DeepResearchConflictMatrixRow[];
  recordHashes: Record<string, string>;
  promptVersions: Record<string, string>;
  outputContract: DeepResearchPromptOutputContract;
};

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
  positiveAnswers: readonly ResearchAnswer[];
  falsificationAnswers: readonly ResearchAnswer[];
  conflictMatrix: readonly DeepResearchConflictMatrixRow[];
  interactions: readonly ResearchInteraction[];
}): Record<string, string> => {
  const hashes: Record<string, string> = {};
  appendHashes(hashes, `job:${input.job.id}`, input.job);
  input.subQuestions.forEach((record) => appendHashes(hashes, `subQuestion:${record.id}`, record));
  input.positiveAnswers.forEach((record) => appendHashes(hashes, `positive:${record.id}`, record));
  input.falsificationAnswers.forEach((record) => appendHashes(hashes, `falsification:${record.id}`, record));
  input.conflictMatrix.forEach((record) => appendHashes(hashes, `conflict:${record.subQuestionId}`, record));
  input.interactions.forEach((record) => {
    hashes[`interaction:${record.id}:prompt`] = record.promptHash;
    hashes[`interaction:${record.id}:response`] = record.rawResponseHash;
  });
  return hashes;
};

export const buildDeepResearchFinalPackage = (input: {
  store: DeepResearchRecordStore;
  jobId: string;
}): DeepResearchFinalPackage => {
  const job = input.store.getJob(input.jobId);
  if (!job) {
    throw new Error(`Deep research job ${input.jobId} was not found.`);
  }

  const subQuestions = input.store.listSubQuestions(input.jobId);
  const positiveAnswers = input.store.listAnswers({ jobId: input.jobId, answerKind: "positive" });
  const falsificationAnswers = input.store.listAnswers({ jobId: input.jobId, answerKind: "falsification" });
  const conflictMatrix = input.store.listConflictMatrix(input.jobId).map((record) => record.row);
  const interactions = input.store.listInteractions(input.jobId);

  if (subQuestions.length === 0) {
    throw new Error(`Deep research job ${input.jobId} has no persisted sub-question records.`);
  }
  if (positiveAnswers.length === 0 || falsificationAnswers.length === 0) {
    throw new Error(`Deep research job ${input.jobId} is missing persisted answer records.`);
  }
  if (conflictMatrix.length === 0) {
    throw new Error(`Deep research job ${input.jobId} has no persisted conflict matrix.`);
  }

  const finalPackage: DeepResearchFinalPackage = {
    jobId: job.id,
    userQuestion: job.userQuestion,
    decompositionRecords: subQuestions,
    positiveAnswerRecords: positiveAnswers,
    falsificationAnswerRecords: falsificationAnswers,
    conflictMatrix,
    recordHashes: buildRecordHashes({
      job,
      subQuestions,
      positiveAnswers,
      falsificationAnswers,
      conflictMatrix,
      interactions,
    }),
    promptVersions: buildPromptVersionMap(interactions),
    outputContract: finalSynthesisPrompt.expectedOutputContract,
  };

  DeepResearchFinalPackageSchema.parse(finalPackage);
  return finalPackage;
};