import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { z } from "zod";

import { createId } from "../../lib/local-runtime/ids.js";
import type {
  DeepResearchInput,
  DeepResearchInteractionPhase,
  DeepResearchJobStatus,
  DeepResearchParseStatus,
  DeepResearchPhase,
} from "./deep-research-analysis.schema.js";
import type {
  DeepResearchConflictMatrixRow,
} from "./deep-research-analysis.result.js";
import {
  DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH,
  DeepResearchProviderKindSchema,
  ResearchAnswerSchema,
  ResearchConflictMatrixSchema,
  ResearchExportSchema,
  ResearchFinalReportRecordSchema,
  ResearchInteractionSchema,
  ResearchJobSchema,
  ResearchSubQuestionSchema,
  type ResearchAnswer,
  type ResearchAnswerKind,
  type ResearchConflictMatrix,
  type ResearchExport,
  type ResearchExportKind,
  type ResearchFinalReportRecord,
  type ResearchInteraction,
  type ResearchJob,
  type ResearchSubQuestion,
} from "./deep-research-analysis.record-contracts.js";
import { DeepResearchFinalReportSchema } from "./deep-research-analysis.result.js";

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
    model_question_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    title TEXT NOT NULL,
    question_text TEXT NOT NULL,
    purpose TEXT NOT NULL,
    scope TEXT NOT NULL,
    expected_answer_shape TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(job_id, model_question_id),
    UNIQUE(job_id, ordinal)
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

export const getCurrentTimestamp = (): string => new Date().toISOString();

type SqliteColumnInfo = {
  name: string;
};

type LegacySubQuestionRow = {
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
};

const hasColumn = (
  db: Database.Database,
  tableName: string,
  columnName: string,
): boolean =>
  (db.prepare(`PRAGMA table_info(${tableName})`).all() as SqliteColumnInfo[])
    .some((column) => column.name === columnName);

const migrateResearchSubQuestionsSchema = (db: Database.Database): void => {
  if (hasColumn(db, "research_sub_questions", "model_question_id")) return;

  const legacyRows = db.prepare(
    `SELECT id, job_id, interaction_id, ordinal, title, question_text, purpose, scope,
      expected_answer_shape, created_at
    FROM research_sub_questions
    ORDER BY job_id ASC, ordinal ASC`,
  ).all() as LegacySubQuestionRow[];

  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE research_sub_questions_v2 (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        interaction_id TEXT NOT NULL,
        model_question_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        title TEXT NOT NULL,
        question_text TEXT NOT NULL,
        purpose TEXT NOT NULL,
        scope TEXT NOT NULL,
        expected_answer_shape TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(job_id, model_question_id),
        UNIQUE(job_id, ordinal)
      )
    `);
    const insert = db.prepare(
      `INSERT INTO research_sub_questions_v2 (
        id, job_id, interaction_id, model_question_id, ordinal, title, question_text,
        purpose, scope, expected_answer_shape, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const idRemap = new Map<string, string>();
    for (const row of legacyRows) {
      const systemId = createId("deep_research_sub_question");
      idRemap.set(`${row.job_id}\u0000${row.id}`, systemId);
      insert.run(
        systemId,
        row.job_id,
        row.interaction_id,
        row.id,
        row.ordinal,
        row.title,
        row.question_text,
        row.purpose,
        row.scope,
        row.expected_answer_shape,
        row.created_at,
      );
    }
    for (const row of legacyRows) {
      const systemId = idRemap.get(`${row.job_id}\u0000${row.id}`);
      if (!systemId) continue;
      db.prepare(
        `UPDATE research_interactions
          SET sub_question_id = ?
          WHERE job_id = ? AND sub_question_id = ?`,
      ).run(systemId, row.job_id, row.id);
      db.prepare(
        `UPDATE research_answers
          SET sub_question_id = ?
          WHERE job_id = ? AND sub_question_id = ?`,
      ).run(systemId, row.job_id, row.id);
      db.prepare(
        `UPDATE research_conflict_matrix
          SET sub_question_id = ?
          WHERE job_id = ? AND sub_question_id = ?`,
      ).run(systemId, row.job_id, row.id);
    }
    db.exec("DROP TABLE research_sub_questions");
    db.exec("ALTER TABLE research_sub_questions_v2 RENAME TO research_sub_questions");
  });
  migrate();
};

const parseStringArray = (value: string): string[] =>
  z.array(z.string().trim().min(1)).parse(JSON.parse(value));

export const resolveDeepResearchDbPath = (dataDir: string): string =>
  path.join(dataDir, DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH);

export const createDeepResearchDatabase = (dataDir: string): Database.Database => {
  const dbPath = resolveDeepResearchDbPath(dataDir);
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  for (const statement of DEEP_RESEARCH_ANALYSIS_SCHEMA_SQL) {
    db.exec(statement);
  }
  migrateResearchSubQuestionsSchema(db);
  for (const statement of DEEP_RESEARCH_ANALYSIS_SCHEMA_SQL) {
    db.exec(statement);
  }
  return db;
};

export const mapJobRow = (row: {
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

export const mapSubQuestionRow = (row: {
  id: string;
  job_id: string;
  interaction_id: string;
  model_question_id: string;
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
    modelQuestionId: row.model_question_id,
    ordinal: row.ordinal,
    question: {
      id: row.model_question_id,
      title: row.title,
      questionText: row.question_text,
      purpose: row.purpose,
      scope: row.scope,
      expectedAnswerShape: row.expected_answer_shape,
    },
    createdAt: row.created_at,
  });

export const mapInteractionRow = (row: {
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

export const mapAnswerRow = (row: {
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

export const mapConflictRow = (row: {
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

export const mapFinalReportRow = (row: {
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

export const mapExportRow = (row: {
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
