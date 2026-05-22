import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { z } from "zod";

import { createId } from "../../lib/local-runtime/ids.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import {
  DeepResearchInputSchema,
  DeepResearchInteractionPhaseSchema,
  DeepResearchJobStatusSchema,
  DeepResearchParseStatusSchema,
  DeepResearchPhaseSchema,
  DeepResearchSubQuestionSchema,
  type DeepResearchInput,
  type DeepResearchInteractionPhase,
  type DeepResearchJobStatus,
  type DeepResearchParseStatus,
  type DeepResearchPhase,
  type DeepResearchSubQuestion,
} from "./deep-research-analysis.schema.js";
import {
  DeepResearchConflictMatrixRowSchema,
  DeepResearchFinalReportSchema,
  type DeepResearchConflictMatrixRow,
  type DeepResearchFinalReport,
} from "./deep-research-analysis.result.js";

const DeepResearchProviderKindSchema = z.enum([
  "gemini-api",
  "gemini-web-chat",
  "gpt-web-chat",
]);

const ResearchAnswerKindSchema = z.enum(["positive", "falsification"]);

const ResearchExportKindSchema = z.enum([
  "final-report.md",
  "research-bundle.json",
  "evidence-index.json",
]);

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
  ordinal: z.number().int().nonnegative(),
  question: DeepResearchSubQuestionSchema,
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
  limitations: z.array(z.string().trim().min(1)).min(1),
  contradictionPoints: z.array(z.string().trim().min(1)).default([]),
  confidence: z.enum(["low", "medium", "high"]),
  createdAt: z.string().datetime(),
}).strict();

export const ResearchConflictMatrixSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  row: DeepResearchConflictMatrixRowSchema.extend({
    subQuestionId: z.string().trim().min(1),
  }),
  createdAt: z.string().datetime(),
}).strict();

export const ResearchFinalReportRecordSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  interactionId: z.string().trim().min(1),
  report: DeepResearchFinalReportSchema,
  reportHash: z.string().trim().min(1),
  createdAt: z.string().datetime(),
}).strict();

export const ResearchExportSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  exportKind: ResearchExportKindSchema,
  filePath: z.string().trim().min(1),
  fileHash: z.string().trim().min(1),
  payloadHash: z.string().trim().min(1),
  createdAt: z.string().datetime(),
}).strict();

export type ResearchJob = z.infer<typeof ResearchJobSchema>;
export type ResearchSubQuestion = z.infer<typeof ResearchSubQuestionSchema>;
export type ResearchInteraction = z.infer<typeof ResearchInteractionSchema>;
export type ResearchAnswer = z.infer<typeof ResearchAnswerSchema>;
export type ResearchAnswerKind = z.infer<typeof ResearchAnswerKindSchema>;
export type ResearchConflictMatrix = z.infer<typeof ResearchConflictMatrixSchema>;
export type ResearchFinalReportRecord = z.infer<typeof ResearchFinalReportRecordSchema>;
export type ResearchExport = z.infer<typeof ResearchExportSchema>;
export type ResearchExportKind = z.infer<typeof ResearchExportKindSchema>;

export const DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH =
  "deep-research-analysis/deep_research_analysis.sqlite";

const DEEP_RESEARCH_ANALYSIS_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS research_jobs (
    id TEXT PRIMARY KEY,
    user_question TEXT NOT NULL,
    analysis_goal TEXT,
    language TEXT NOT NULL,
    max_sub_questions INTEGER NOT NULL,
    output_format TEXT NOT NULL,
    status TEXT NOT NULL,
    phase TEXT NOT NULL,
    failure_reason TEXT,
    review_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS research_sub_questions (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    interaction_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    title TEXT NOT NULL,
    question_text TEXT NOT NULL,
    purpose TEXT NOT NULL,
    scope TEXT NOT NULL,
    expected_answer_shape TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS research_interactions (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    sub_question_id TEXT,
    prompt_id TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    dom_ref TEXT,
    raw_response_text TEXT NOT NULL,
    raw_response_hash TEXT NOT NULL,
    normalized_text TEXT,
    parse_status TEXT NOT NULL,
    provider_kind TEXT,
    provider_proof_json TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS research_answers (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    interaction_id TEXT NOT NULL,
    sub_question_id TEXT NOT NULL,
    answer_kind TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    key_points_json TEXT NOT NULL,
    evidence_mentions_json TEXT NOT NULL,
    assumptions_json TEXT NOT NULL,
    limitations_json TEXT NOT NULL,
    contradiction_points_json TEXT NOT NULL,
    confidence TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS research_conflict_matrix (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    sub_question_id TEXT NOT NULL,
    positive_claim_summary TEXT NOT NULL,
    falsification_summary TEXT NOT NULL,
    conflict_level TEXT NOT NULL,
    evidence_gap TEXT NOT NULL,
    needs_human_review INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS research_final_reports (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    interaction_id TEXT NOT NULL,
    report_json TEXT NOT NULL,
    report_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS research_exports (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    export_kind TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_research_sub_questions_job ON research_sub_questions(job_id, ordinal)`,
  `CREATE INDEX IF NOT EXISTS idx_research_interactions_job ON research_interactions(job_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_research_answers_job ON research_answers(job_id, answer_kind, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_research_conflict_job ON research_conflict_matrix(job_id, sub_question_id)`,
  `CREATE INDEX IF NOT EXISTS idx_research_exports_job ON research_exports(job_id, export_kind, created_at)`,
] as const;

const now = (): string => new Date().toISOString();

const parseStringArray = (value: string): string[] =>
  z.array(z.string().trim().min(1)).parse(JSON.parse(value));

const resolveDbPath = (dataDir: string): string =>
  path.join(dataDir, DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH);

const createDatabase = (dataDir: string): Database.Database => {
  const dbPath = resolveDbPath(dataDir);
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  for (const statement of DEEP_RESEARCH_ANALYSIS_SCHEMA_SQL) {
    db.exec(statement);
  }
  return db;
};

const mapJobRow = (row: {
  id: string;
  user_question: string;
  analysis_goal: string | null;
  language: DeepResearchInput["language"];
  max_sub_questions: number;
  output_format: DeepResearchInput["outputFormat"];
  status: DeepResearchJobStatus;
  phase: DeepResearchPhase;
  failure_reason: string | null;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
}): ResearchJob =>
  ResearchJobSchema.parse({
    id: row.id,
    userQuestion: row.user_question,
    analysisGoal: row.analysis_goal,
    language: row.language,
    maxSubQuestions: row.max_sub_questions,
    outputFormat: row.output_format,
    status: row.status,
    phase: row.phase,
    failureReason: row.failure_reason,
    reviewReason: row.review_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

const mapSubQuestionRow = (row: {
  id: string;
  job_id: string;
  interaction_id: string;
  ordinal: number;
  title: string;
  question_text: string;
  purpose: string;
  scope: string;
  expected_answer_shape: string;
  created_at: string;
}): ResearchSubQuestion =>
  ResearchSubQuestionSchema.parse({
    id: row.id,
    jobId: row.job_id,
    interactionId: row.interaction_id,
    ordinal: row.ordinal,
    question: {
      id: row.id,
      title: row.title,
      questionText: row.question_text,
      purpose: row.purpose,
      scope: row.scope,
      expectedAnswerShape: row.expected_answer_shape,
    },
    createdAt: row.created_at,
  });

const mapInteractionRow = (row: {
  id: string;
  job_id: string;
  phase: DeepResearchInteractionPhase;
  sub_question_id: string | null;
  prompt_id: string;
  prompt_version: string;
  prompt_hash: string;
  dom_ref: string | null;
  raw_response_text: string;
  raw_response_hash: string;
  normalized_text: string | null;
  parse_status: DeepResearchParseStatus;
  provider_kind: z.infer<typeof DeepResearchProviderKindSchema> | null;
  provider_proof_json: string | null;
  created_at: string;
}): ResearchInteraction =>
  ResearchInteractionSchema.parse({
    id: row.id,
    jobId: row.job_id,
    phase: row.phase,
    subQuestionId: row.sub_question_id,
    promptId: row.prompt_id,
    promptVersion: row.prompt_version,
    promptHash: row.prompt_hash,
    domRef: row.dom_ref,
    rawResponseText: row.raw_response_text,
    rawResponseHash: row.raw_response_hash,
    normalizedText: row.normalized_text,
    parseStatus: row.parse_status,
    providerKind: row.provider_kind,
    providerProofJson: row.provider_proof_json,
    createdAt: row.created_at,
  });

const mapAnswerRow = (row: {
  id: string;
  job_id: string;
  interaction_id: string;
  sub_question_id: string;
  answer_kind: ResearchAnswerKind;
  answer_text: string;
  key_points_json: string;
  evidence_mentions_json: string;
  assumptions_json: string;
  limitations_json: string;
  contradiction_points_json: string;
  confidence: "low" | "medium" | "high";
  created_at: string;
}): ResearchAnswer =>
  ResearchAnswerSchema.parse({
    id: row.id,
    jobId: row.job_id,
    interactionId: row.interaction_id,
    subQuestionId: row.sub_question_id,
    answerKind: row.answer_kind,
    answerText: row.answer_text,
    keyPoints: parseStringArray(row.key_points_json),
    evidenceMentions: parseStringArray(row.evidence_mentions_json),
    assumptions: parseStringArray(row.assumptions_json),
    limitations: parseStringArray(row.limitations_json),
    contradictionPoints: parseStringArray(row.contradiction_points_json),
    confidence: row.confidence,
    createdAt: row.created_at,
  });

const mapConflictRow = (row: {
  id: string;
  job_id: string;
  sub_question_id: string;
  positive_claim_summary: string;
  falsification_summary: string;
  conflict_level: DeepResearchConflictMatrixRow["conflictLevel"];
  evidence_gap: string;
  needs_human_review: number;
  created_at: string;
}): ResearchConflictMatrix =>
  ResearchConflictMatrixSchema.parse({
    id: row.id,
    jobId: row.job_id,
    row: {
      subQuestionId: row.sub_question_id,
      positiveClaimSummary: row.positive_claim_summary,
      falsificationSummary: row.falsification_summary,
      conflictLevel: row.conflict_level,
      evidenceGap: row.evidence_gap,
      needsHumanReview: row.needs_human_review === 1,
    },
    createdAt: row.created_at,
  });

const mapFinalReportRow = (row: {
  id: string;
  job_id: string;
  interaction_id: string;
  report_json: string;
  report_hash: string;
  created_at: string;
}): ResearchFinalReportRecord =>
  ResearchFinalReportRecordSchema.parse({
    id: row.id,
    jobId: row.job_id,
    interactionId: row.interaction_id,
    report: DeepResearchFinalReportSchema.parse(JSON.parse(row.report_json)),
    reportHash: row.report_hash,
    createdAt: row.created_at,
  });

const mapExportRow = (row: {
  id: string;
  job_id: string;
  export_kind: ResearchExportKind;
  file_path: string;
  file_hash: string;
  payload_hash: string;
  created_at: string;
}): ResearchExport =>
  ResearchExportSchema.parse({
    id: row.id,
    jobId: row.job_id,
    exportKind: row.export_kind,
    filePath: row.file_path,
    fileHash: row.file_hash,
    payloadHash: row.payload_hash,
    createdAt: row.created_at,
  });

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
  createInteraction(input: {
    jobId: string;
    phase: DeepResearchInteractionPhase;
    subQuestionId?: string | null;
    promptId: string;
    promptVersion: string;
    promptHash: string;
    domRef?: string | null;
    rawResponseText: string;
    rawResponseHash: string;
    normalizedText?: string | null;
    parseStatus: DeepResearchParseStatus;
    providerKind?: z.infer<typeof DeepResearchProviderKindSchema> | null;
    providerProofJson?: string | null;
  }): ResearchInteraction;
  listInteractions(jobId: string): ResearchInteraction[];
  saveSubQuestions(input: {
    jobId: string;
    interactionId: string;
    subQuestions: readonly DeepResearchSubQuestion[];
  }): ResearchSubQuestion[];
  listSubQuestions(jobId: string): ResearchSubQuestion[];
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
    confidence: ResearchAnswer["confidence"];
  }): ResearchAnswer;
  listAnswers(input: {
    jobId: string;
    answerKind?: ResearchAnswerKind;
  }): ResearchAnswer[];
  saveConflictMatrixRows(input: {
    jobId: string;
    rows: readonly DeepResearchConflictMatrixRow[];
  }): ResearchConflictMatrix[];
  listConflictMatrix(jobId: string): ResearchConflictMatrix[];
  saveFinalReport(input: {
    jobId: string;
    interactionId: string;
    report: DeepResearchFinalReport;
  }): ResearchFinalReportRecord;
  getLatestFinalReport(jobId: string): ResearchFinalReportRecord | null;
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
  const db = createDatabase(dataDir);
  const dbPath = resolveDbPath(dataDir);

  const createJob = (input: DeepResearchInput): ResearchJob => {
    const parsedInput = DeepResearchInputSchema.parse(input);
    const id = createId("deep_research_job");
    const createdAt = now();
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

  const updateJobState = (input: {
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
      now(),
      input.jobId,
    );
    const job = getJob(input.jobId);
    if (!job) {
      throw new Error(`Deep research job ${input.jobId} was not found after update.`);
    }
    return job;
  };

  const getJob = (jobId: string): ResearchJob | null => {
    const row = db.prepare(`SELECT * FROM research_jobs WHERE id = ?`).get(jobId) as Parameters<typeof mapJobRow>[0] | undefined;
    return row ? mapJobRow(row) : null;
  };

  const createInteraction = (input: {
    jobId: string;
    phase: DeepResearchInteractionPhase;
    subQuestionId?: string | null;
    promptId: string;
    promptVersion: string;
    promptHash: string;
    domRef?: string | null;
    rawResponseText: string;
    rawResponseHash: string;
    normalizedText?: string | null;
    parseStatus: DeepResearchParseStatus;
    providerKind?: z.infer<typeof DeepResearchProviderKindSchema> | null;
    providerProofJson?: string | null;
  }): ResearchInteraction => {
    const id = createId("deep_research_interaction");
    const createdAt = now();
    db.prepare(
      `INSERT INTO research_interactions (
        id, job_id, phase, sub_question_id, prompt_id, prompt_version, prompt_hash,
        dom_ref, raw_response_text, raw_response_hash, normalized_text, parse_status,
        provider_kind, provider_proof_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.jobId,
      input.phase,
      input.subQuestionId ?? null,
      input.promptId,
      input.promptVersion,
      input.promptHash,
      input.domRef ?? null,
      input.rawResponseText,
      input.rawResponseHash,
      input.normalizedText ?? null,
      input.parseStatus,
      input.providerKind ?? null,
      input.providerProofJson ?? null,
      createdAt,
    );
    const row = db.prepare(`SELECT * FROM research_interactions WHERE id = ?`).get(id) as Parameters<typeof mapInteractionRow>[0] | undefined;
    if (!row) {
      throw new Error(`Deep research interaction ${id} was not persisted.`);
    }
    return mapInteractionRow(row);
  };

  const listInteractions = (jobId: string): ResearchInteraction[] =>
    (db.prepare(`SELECT * FROM research_interactions WHERE job_id = ? ORDER BY created_at ASC`).all(jobId) as Parameters<typeof mapInteractionRow>[0][])
      .map(mapInteractionRow);

  const saveSubQuestions = (input: {
    jobId: string;
    interactionId: string;
    subQuestions: readonly DeepResearchSubQuestion[];
  }): ResearchSubQuestion[] => {
    const insert = db.prepare(
      `INSERT INTO research_sub_questions (
        id, job_id, interaction_id, ordinal, title, question_text, purpose, scope,
        expected_answer_shape, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const createdAt = now();
    const rows: ResearchSubQuestion[] = [];
    input.subQuestions.forEach((subQuestion, ordinal) => {
      const parsed = DeepResearchSubQuestionSchema.parse(subQuestion);
      insert.run(
        parsed.id,
        input.jobId,
        input.interactionId,
        ordinal,
        parsed.title,
        parsed.questionText,
        parsed.purpose,
        parsed.scope,
        parsed.expectedAnswerShape,
        createdAt,
      );
      rows.push(ResearchSubQuestionSchema.parse({
        id: parsed.id,
        jobId: input.jobId,
        interactionId: input.interactionId,
        ordinal,
        question: parsed,
        createdAt,
      }));
    });
    return rows;
  };

  const listSubQuestions = (jobId: string): ResearchSubQuestion[] =>
    (db.prepare(`SELECT * FROM research_sub_questions WHERE job_id = ? ORDER BY ordinal ASC`).all(jobId) as Parameters<typeof mapSubQuestionRow>[0][])
      .map(mapSubQuestionRow);

  const saveAnswer = (input: {
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
    confidence: ResearchAnswer["confidence"];
  }): ResearchAnswer => {
    const id = createId(`deep_research_${input.answerKind}`);
    const createdAt = now();
    db.prepare(
      `INSERT INTO research_answers (
        id, job_id, interaction_id, sub_question_id, answer_kind, answer_text,
        key_points_json, evidence_mentions_json, assumptions_json, limitations_json,
        contradiction_points_json, confidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.jobId,
      input.interactionId,
      input.subQuestionId,
      input.answerKind,
      input.answerText,
      JSON.stringify(input.keyPoints ?? []),
      JSON.stringify(input.evidenceMentions ?? []),
      JSON.stringify(input.assumptions ?? []),
      JSON.stringify(input.limitations),
      JSON.stringify(input.contradictionPoints ?? []),
      input.confidence,
      createdAt,
    );
    const row = db.prepare(`SELECT * FROM research_answers WHERE id = ?`).get(id) as Parameters<typeof mapAnswerRow>[0] | undefined;
    if (!row) {
      throw new Error(`Deep research answer ${id} was not persisted.`);
    }
    return mapAnswerRow(row);
  };

  const listAnswers = (input: {
    jobId: string;
    answerKind?: ResearchAnswerKind;
  }): ResearchAnswer[] => {
    const rows = input.answerKind
      ? (db.prepare(`SELECT * FROM research_answers WHERE job_id = ? AND answer_kind = ? ORDER BY created_at ASC`).all(input.jobId, input.answerKind) as Parameters<typeof mapAnswerRow>[0][])
      : (db.prepare(`SELECT * FROM research_answers WHERE job_id = ? ORDER BY created_at ASC`).all(input.jobId) as Parameters<typeof mapAnswerRow>[0][]);
    return rows.map(mapAnswerRow);
  };

  const saveConflictMatrixRows = (input: {
    jobId: string;
    rows: readonly DeepResearchConflictMatrixRow[];
  }): ResearchConflictMatrix[] => {
    const insert = db.prepare(
      `INSERT INTO research_conflict_matrix (
        id, job_id, sub_question_id, positive_claim_summary, falsification_summary,
        conflict_level, evidence_gap, needs_human_review, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const createdAt = now();
    return input.rows.map((row) => {
      const parsed = DeepResearchConflictMatrixRowSchema.parse(row);
      const id = createId("deep_research_conflict");
      insert.run(
        id,
        input.jobId,
        parsed.subQuestionId,
        parsed.positiveClaimSummary,
        parsed.falsificationSummary,
        parsed.conflictLevel,
        parsed.evidenceGap,
        parsed.needsHumanReview ? 1 : 0,
        createdAt,
      );
      return ResearchConflictMatrixSchema.parse({
        id,
        jobId: input.jobId,
        row: parsed,
        createdAt,
      });
    });
  };

  const listConflictMatrix = (jobId: string): ResearchConflictMatrix[] =>
    (db.prepare(`SELECT * FROM research_conflict_matrix WHERE job_id = ? ORDER BY created_at ASC, sub_question_id ASC`).all(jobId) as Parameters<typeof mapConflictRow>[0][])
      .map(mapConflictRow);

  const saveFinalReport = (input: {
    jobId: string;
    interactionId: string;
    report: DeepResearchFinalReport;
  }): ResearchFinalReportRecord => {
    const id = createId("deep_research_final_report");
    const createdAt = now();
    const report = DeepResearchFinalReportSchema.parse(input.report);
    const reportHash = stableJsonHash(report);
    db.prepare(
      `INSERT INTO research_final_reports (
        id, job_id, interaction_id, report_json, report_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.jobId,
      input.interactionId,
      JSON.stringify(report),
      reportHash,
      createdAt,
    );
    return ResearchFinalReportRecordSchema.parse({
      id,
      jobId: input.jobId,
      interactionId: input.interactionId,
      report,
      reportHash,
      createdAt,
    });
  };

  const getLatestFinalReport = (jobId: string): ResearchFinalReportRecord | null => {
    const row = db.prepare(
      `SELECT * FROM research_final_reports WHERE job_id = ? ORDER BY created_at DESC LIMIT 1`,
    ).get(jobId) as Parameters<typeof mapFinalReportRow>[0] | undefined;
    return row ? mapFinalReportRow(row) : null;
  };

  const saveExport = (input: {
    jobId: string;
    exportKind: ResearchExportKind;
    filePath: string;
    fileHash: string;
    payload: unknown;
  }): ResearchExport => {
    const id = createId("deep_research_export");
    const createdAt = now();
    const payloadHash = stableJsonHash(input.payload);
    db.prepare(
      `INSERT INTO research_exports (
        id, job_id, export_kind, file_path, file_hash, payload_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.jobId,
      input.exportKind,
      input.filePath,
      input.fileHash,
      payloadHash,
      createdAt,
    );
    return ResearchExportSchema.parse({
      id,
      jobId: input.jobId,
      exportKind: input.exportKind,
      filePath: input.filePath,
      fileHash: input.fileHash,
      payloadHash,
      createdAt,
    });
  };

  const listExports = (jobId: string): ResearchExport[] =>
    (db.prepare(`SELECT * FROM research_exports WHERE job_id = ? ORDER BY created_at ASC`).all(jobId) as Parameters<typeof mapExportRow>[0][])
      .map(mapExportRow);

  return {
    dbPath,
    createJob,
    updateJobState,
    getJob,
    createInteraction,
    listInteractions,
    saveSubQuestions,
    listSubQuestions,
    saveAnswer,
    listAnswers,
    saveConflictMatrixRows,
    listConflictMatrix,
    saveFinalReport,
    getLatestFinalReport,
    saveExport,
    listExports,
    close() {
      db.close();
    },
  };
};