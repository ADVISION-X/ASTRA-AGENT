import { z } from "zod";
import { createId } from "../../lib/local-runtime/ids.js";
import type { DeepResearchFinalAdjudicationParse } from "./deep-research-analysis.parser.js";
import { DeepResearchFinalAdjudicationRecordSchema } from "./deep-research-analysis.parser.js";
import {
    createDeepResearchDatabase,
    getCurrentTimestamp,
    mapJobRow,
    resolveDeepResearchDbPath,
} from "./deep-research-analysis.record-db.js";
import {
    createInteraction,
    getLatestFinalAdjudication,
    getResearchPlan,
    listAnswers,
    listExports,
    listInteractions,
    listSubQuestions,
    saveAnswer,
    saveExport,
    saveFinalAdjudication,
    saveResearchPlan,
    saveSubQuestions,
} from "./deep-research-analysis.record-interaction-ops.js";
import type { DeepResearchPlan } from "./deep-research-analysis.schema.js";
import {
    DeepResearchInputSchema,
    DeepResearchInteractionPhaseSchema,
    DeepResearchJobStatusSchema,
    DeepResearchParseStatusSchema,
    DeepResearchPhaseSchema,
    DeepResearchPlanSchema,
    DeepResearchSubQuestionSchema,
    type DeepResearchInput,
    type DeepResearchInteractionPhase,
    type DeepResearchJobStatus,
    type DeepResearchParseStatus,
    type DeepResearchPhase,
    type DeepResearchSubQuestion,
} from "./deep-research-analysis.schema.js";

export const DeepResearchProviderKindSchema = z.enum([
  "gemini-api",
  "gemini-web-chat",
  "gpt-web-chat",
]);

const ResearchAnswerKindSchema = z.enum(["analysis"]);

const ResearchExportKindSchema = z.enum([
  "final-adjudication-raw.md",
  "full-case-file.md",
  "full-case-file.json",
  "structured-index.json",
  "business-report.html",
  "evidence-index.json",
]);

const ResearchParsedPayloadSchema = z.record(z.string(), z.unknown()).default({});

export const MISSING_RENDERED_PROMPT_TEXT =
  "[interaction did not persist rendered prompt text]";

export const ResearchJobSchema = z.object({
  id: z.string().trim().min(1),
  userQuestion: DeepResearchInputSchema.shape.userQuestion,
  analysisGoal: DeepResearchInputSchema.shape.analysisGoal,
  language: DeepResearchInputSchema.shape.language,
  maxSubQuestions: DeepResearchInputSchema.shape.maxSubQuestions,
  outputFormat: DeepResearchInputSchema.shape.outputFormat,
  status: DeepResearchJobStatusSchema,
  phase: DeepResearchPhaseSchema,
  failureReason: z.string().trim().min(1).nullable().default(null),
  reviewReason: z.string().trim().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export const ResearchSubQuestionSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  interactionId: z.string().trim().min(1),
  modelQuestionId: z.string().trim().min(1),
  ordinal: z.number().int().nonnegative(),
  question: DeepResearchSubQuestionSchema,
  createdAt: z.string().datetime(),
}).strict();

export const ResearchPlanRecordSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  interactionId: z.string().trim().min(1),
  researchPlan: DeepResearchPlanSchema,
  planHash: z.string().trim().min(1),
  createdAt: z.string().datetime(),
}).strict();

export const ResearchInteractionSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  phase: DeepResearchInteractionPhaseSchema,
  subQuestionId: z.string().trim().min(1).nullable().default(null),
  promptId: z.string().trim().min(1),
  promptVersion: z.string().trim().min(1),
  promptHash: z.string().trim().min(1),
  renderedPromptText: z.string().trim().min(1),
  domRef: z.string().trim().min(1).nullable().default(null),
  rawResponseText: z.string().trim().min(1),
  rawResponseHash: z.string().trim().min(1),
  normalizedText: z.string().trim().min(1).nullable().default(null),
  parseStatus: DeepResearchParseStatusSchema,
  providerKind: DeepResearchProviderKindSchema.nullable().default(null),
  providerProofJson: z.string().trim().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
}).strict();

export const ResearchAnswerSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  interactionId: z.string().trim().min(1),
  subQuestionId: z.string().trim().min(1),
  answerKind: ResearchAnswerKindSchema,
  answerText: z.string().trim().min(1),
  keyPoints: z.array(z.string().trim().min(1)).default([]),
  evidenceMentions: z.array(z.string().trim().min(1)).default([]),
  assumptions: z.array(z.string().trim().min(1)).default([]),
  limitations: z.array(z.string().trim().min(1)).default([]),
  contradictionPoints: z.array(z.string().trim().min(1)).default([]),
  parsedPayload: ResearchParsedPayloadSchema,
  createdAt: z.string().datetime(),
}).strict();

export const ResearchFinalAdjudicationRecordSchema = DeepResearchFinalAdjudicationRecordSchema.extend({
  id: z.string().trim().min(1),
}).strict();

export const ResearchExportSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  exportKind: ResearchExportKindSchema,
  filePath: z.string().trim().min(1),
  fileHash: z.string().trim().min(1),
  payloadHash: z.string().trim().min(1),
  payloadJson: z.string().trim().min(1),
  createdAt: z.string().datetime(),
}).strict();

export type ResearchJob = z.infer<typeof ResearchJobSchema>;
export type ResearchSubQuestion = z.infer<typeof ResearchSubQuestionSchema>;
export type ResearchPlanRecord = z.infer<typeof ResearchPlanRecordSchema>;
export type ResearchInteraction = z.infer<typeof ResearchInteractionSchema>;
export type ResearchAnswer = z.infer<typeof ResearchAnswerSchema>;
export type ResearchAnswerKind = z.infer<typeof ResearchAnswerKindSchema>;
export type ResearchFinalAdjudicationRecord = z.infer<typeof ResearchFinalAdjudicationRecordSchema>;
export type ResearchExport = z.infer<typeof ResearchExportSchema>;
export type ResearchExportKind = z.infer<typeof ResearchExportKindSchema>;

export const DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH = "deep-research-analysis/deep_research_analysis.sqlite";

type DeepResearchDatabaseHandle = ReturnType<typeof createDeepResearchDatabase>;

const createGetJobOperation = (db: DeepResearchDatabaseHandle) =>
  (jobId: string): ResearchJob | null => {
    const row = db.prepare(`SELECT * FROM research_jobs WHERE id = ?`).get(jobId) as Parameters<typeof mapJobRow>[0] | undefined;
    return row ? mapJobRow(row) : null;
  };

const createCreateJobOperation = (
  db: DeepResearchDatabaseHandle,
  getJob: (jobId: string) => ResearchJob | null,
) => (input: DeepResearchInput): ResearchJob => {
  const parsedInput = DeepResearchInputSchema.parse(input);
  const id = createId("deep_research_job");
  const createdAt = getCurrentTimestamp();
  db.prepare(
    `INSERT INTO research_jobs (
      id, user_question, analysis_goal, language, max_sub_questions, output_format,
      status, phase, failure_reason, review_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    parsedInput.userQuestion,
    parsedInput.analysisGoal,
    parsedInput.language,
    parsedInput.maxSubQuestions,
    parsedInput.outputFormat,
    "queued",
    "INTAKE",
    null,
    null,
    createdAt,
    createdAt,
  );
  const job = getJob(id);
  if (!job) {
    throw new Error(`Deep research job ${id} was not persisted.`);
  }
  return job;
};

const createUpdateJobStateOperation = (
  db: DeepResearchDatabaseHandle,
  getJob: (jobId: string) => ResearchJob | null,
) => (input: {
  jobId: string;
  status: DeepResearchJobStatus;
  phase: DeepResearchPhase;
  failureReason?: string | null;
  reviewReason?: string | null;
}): ResearchJob => {
  db.prepare(
    `UPDATE research_jobs
     SET status = ?, phase = ?, failure_reason = ?, review_reason = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.status,
    input.phase,
    input.failureReason ?? null,
    input.reviewReason ?? null,
    getCurrentTimestamp(),
    input.jobId,
  );
  const job = getJob(input.jobId);
  if (!job) {
    throw new Error(`Deep research job ${input.jobId} was not found after update.`);
  }
  return job;
};

const createDeleteJobOperation = (db: DeepResearchDatabaseHandle) =>
  (jobId: string): boolean => {
    const deleted = db.transaction(() => {
      db.prepare(`DELETE FROM research_exports WHERE job_id = ?`).run(jobId);
      db.prepare(`DELETE FROM research_final_adjudications WHERE job_id = ?`).run(jobId);
      db.prepare(`DELETE FROM research_answers WHERE job_id = ?`).run(jobId);
      db.prepare(`DELETE FROM research_sub_questions WHERE job_id = ?`).run(jobId);
      db.prepare(`DELETE FROM research_interactions WHERE job_id = ?`).run(jobId);
      return db.prepare(`DELETE FROM research_jobs WHERE id = ?`).run(jobId).changes;
    })();
    return deleted > 0;
  };

const createJobOperations = (db: DeepResearchDatabaseHandle): Pick<DeepResearchRecordStore, "createJob" | "updateJobState" | "getJob" | "deleteJob"> => {
  const getJob = createGetJobOperation(db);
  return {
    createJob: createCreateJobOperation(db, getJob),
    updateJobState: createUpdateJobStateOperation(db, getJob),
    getJob,
    deleteJob: createDeleteJobOperation(db),
  };
};

export type DeepResearchRecordStore = {
  dbPath: string;
  createJob(input: DeepResearchInput): ResearchJob;
  updateJobState(input: {
    jobId: string;
    status: DeepResearchJobStatus;
    phase: DeepResearchPhase;
    failureReason?: string | null;
    reviewReason?: string | null;
  }): ResearchJob;
  getJob(jobId: string): ResearchJob | null;
  deleteJob(jobId: string): boolean;
  createInteraction(input: {
    jobId: string;
    phase: DeepResearchInteractionPhase;
    subQuestionId?: string | null;
    promptId: string;
    promptVersion: string;
    promptHash: string;
    renderedPromptText: string;
    domRef?: string | null;
    rawResponseText: string;
    rawResponseHash: string;
    normalizedText?: string | null;
    parseStatus: DeepResearchParseStatus;
    providerKind?: ResearchInteraction["providerKind"];
    providerProofJson?: string | null;
  }): ResearchInteraction;
  listInteractions(jobId: string): ResearchInteraction[];
  saveSubQuestions(input: {
    jobId: string;
    interactionId: string;
    subQuestions: readonly DeepResearchSubQuestion[];
  }): ResearchSubQuestion[];
  listSubQuestions(jobId: string): ResearchSubQuestion[];
  saveResearchPlan(input: {
    jobId: string;
    interactionId: string;
    researchPlan: DeepResearchPlan;
  }): ResearchPlanRecord;
  getResearchPlan(jobId: string): DeepResearchPlan | null;
  saveAnswer(input: {
    jobId: string;
    interactionId: string;
    subQuestionId: string;
    answerKind: ResearchAnswerKind;
    answerText: string;
    keyPoints?: readonly string[];
    evidenceMentions?: readonly string[];
    assumptions?: readonly string[];
    limitations: readonly string[];
    contradictionPoints?: readonly string[];
    parsedPayload?: Record<string, unknown>;
  }): ResearchAnswer;
  listAnswers(input: {
    jobId: string;
    answerKind?: ResearchAnswerKind;
  }): ResearchAnswer[];
  saveFinalAdjudication(input: {
    jobId: string;
    interactionId: string;
    promptId: string;
    promptVersion: string;
    parsed: DeepResearchFinalAdjudicationParse;
    promptBundleSnapshot: unknown;
  }): ResearchFinalAdjudicationRecord;
  getLatestFinalAdjudication(jobId: string): ResearchFinalAdjudicationRecord | null;
  saveExport(input: {
    jobId: string;
    exportKind: ResearchExportKind;
    filePath: string;
    fileHash: string;
    payload: unknown;
  }): ResearchExport;
  listExports(jobId: string): ResearchExport[];
  close(): void;
};

export const createDeepResearchRecordStore = (dataDir: string): DeepResearchRecordStore => {
  const db = createDeepResearchDatabase(dataDir);
  const dbPath = resolveDeepResearchDbPath(dataDir);
  const jobOperations = createJobOperations(db);

  return {
    dbPath,
    ...jobOperations,
    createInteraction: (input) => createInteraction(db, input),
    listInteractions: (jobId) => listInteractions(db, jobId),
    saveSubQuestions: (input) => saveSubQuestions(db, input),
    listSubQuestions: (jobId) => listSubQuestions(db, jobId),
    saveResearchPlan: (input) => saveResearchPlan(db, input),
    getResearchPlan: (jobId) => getResearchPlan(db, jobId),
    saveAnswer: (input) => saveAnswer(db, input),
    listAnswers: (input) => listAnswers(db, input),
    saveFinalAdjudication: (input) => saveFinalAdjudication(db, input),
    getLatestFinalAdjudication: (jobId) => getLatestFinalAdjudication(db, jobId),
    saveExport: (input) => saveExport(db, input),
    listExports: (jobId) => listExports(db, jobId),
    close() {
      db.close();
    },
  };
};
