import { createId } from "../../lib/local-runtime/ids.js";
import {
  DeepResearchInputSchema,
  type DeepResearchInput,
  type DeepResearchInteractionPhase,
  type DeepResearchJobStatus,
  type DeepResearchParseStatus,
  type DeepResearchPhase,
  type DeepResearchSubQuestion,
} from "./deep-research-analysis.schema.js";
import type { DeepResearchFinalAdjudicationParse } from "./deep-research-analysis.result.js";
import type { DeepResearchPlan } from "./deep-research-analysis.research-plan-schema.js";
import {
  DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH,
  type ResearchAnswer,
  type ResearchAnswerKind,
  type ResearchExport,
  type ResearchExportKind,
  type ResearchFinalAdjudicationRecord,
  type ResearchInteraction,
  type ResearchJob,
  type ResearchPlanRecord,
  type ResearchSubQuestion,
} from "./deep-research-analysis.record-contracts.js";
import {
  createDeepResearchDatabase,
  getCurrentTimestamp,
  mapJobRow,
  resolveDeepResearchDbPath,
} from "./deep-research-analysis.record-db.js";
import {
  createInteraction,
  getResearchPlan,
  listAnswers,
  listInteractions,
  listSubQuestions,
  saveAnswer,
  saveResearchPlan,
  saveSubQuestions,
} from "./deep-research-analysis.record-interaction-ops.js";
import {
  getLatestFinalAdjudication,
  listExports,
  saveExport,
  saveFinalAdjudication,
} from "./deep-research-analysis.record-result-ops.js";

export { DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH };
export type {
  ResearchAnswer,
  ResearchExport,
  ResearchExportKind,
  ResearchFinalAdjudicationRecord,
  ResearchInteraction,
  ResearchJob,
  ResearchPlanRecord,
  ResearchSubQuestion,
} from "./deep-research-analysis.record-contracts.js";

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
