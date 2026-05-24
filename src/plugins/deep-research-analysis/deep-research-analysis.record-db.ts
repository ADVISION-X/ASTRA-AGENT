import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { createId } from "../../lib/local-runtime/ids.js";
import {
  DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH,
  LEGACY_RENDERED_PROMPT_TEXT,
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
export {
  mapAnswerRow,
  mapConflictRow,
  mapExportRow,
  mapFinalReportRow,
  mapInteractionRow,
  mapJobRow,
  mapSubQuestionRow,
} from "./deep-research-analysis.record-db-mappers.js";

const DEEP_RESEARCH_ANALYSIS_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS research_jobs (
    id TEXT PRIMARY KEY,
    user_question TEXT NOT NULL,
    analysis_goal TEXT,
    language TEXT NOT NULL,
    max_sub_questions INTEGER NOT NULL,
    output_format TEXT NOT NULL,
    flow_mode TEXT NOT NULL DEFAULT 'default_1_n_1_1',
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
    why_it_matters TEXT,
    decision_weight TEXT,
    analysis_focus TEXT,
    required_evidence_json TEXT NOT NULL DEFAULT '[]',
    scope TEXT NOT NULL,
    expected_answer_shape TEXT NOT NULL,
    priority TEXT,
    omission_risk TEXT,
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
    rendered_prompt_text TEXT NOT NULL,
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
    parsed_payload_json TEXT NOT NULL DEFAULT '{}',
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

const listLegacySubQuestionRows = (db: Database.Database): LegacySubQuestionRow[] =>
  db.prepare(
    `SELECT id, job_id, interaction_id, ordinal, title, question_text, purpose, scope,
      expected_answer_shape, created_at
    FROM research_sub_questions
    ORDER BY job_id ASC, ordinal ASC`,
  ).all() as LegacySubQuestionRow[];

const createSubQuestionsV2Table = (db: Database.Database): void => {
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
      why_it_matters TEXT,
      decision_weight TEXT,
      analysis_focus TEXT,
      required_evidence_json TEXT NOT NULL DEFAULT '[]',
      scope TEXT NOT NULL,
      expected_answer_shape TEXT NOT NULL,
      priority TEXT,
      omission_risk TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(job_id, model_question_id),
      UNIQUE(job_id, ordinal)
    )
  `);
};

const copyLegacySubQuestionRows = (
  db: Database.Database,
  legacyRows: readonly LegacySubQuestionRow[],
): Map<string, string> => {
  const insert = db.prepare(
    `INSERT INTO research_sub_questions_v2 (
      id, job_id, interaction_id, model_question_id, ordinal, title, question_text,
      purpose, why_it_matters, decision_weight, analysis_focus, required_evidence_json,
      scope, expected_answer_shape, priority, omission_risk, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      null,
      null,
      null,
      "[]",
      row.scope,
      row.expected_answer_shape,
      null,
      null,
      row.created_at,
    );
  }
  return idRemap;
};

const remapSubQuestionReferences = (
  db: Database.Database,
  legacyRows: readonly LegacySubQuestionRow[],
  idRemap: ReadonlyMap<string, string>,
): void => {
  const updateInteractions = db.prepare(
    `UPDATE research_interactions SET sub_question_id = ? WHERE job_id = ? AND sub_question_id = ?`,
  );
  const updateAnswers = db.prepare(
    `UPDATE research_answers SET sub_question_id = ? WHERE job_id = ? AND sub_question_id = ?`,
  );
  const updateConflictRows = db.prepare(
    `UPDATE research_conflict_matrix SET sub_question_id = ? WHERE job_id = ? AND sub_question_id = ?`,
  );
  for (const row of legacyRows) {
    const systemId = idRemap.get(`${row.job_id}\u0000${row.id}`);
    if (!systemId) continue;
    updateInteractions.run(systemId, row.job_id, row.id);
    updateAnswers.run(systemId, row.job_id, row.id);
    updateConflictRows.run(systemId, row.job_id, row.id);
  }
};

const migrateResearchSubQuestionsSchema = (db: Database.Database): void => {
  if (hasColumn(db, "research_sub_questions", "model_question_id")) return;
  const legacyRows = listLegacySubQuestionRows(db);
  const migrate = db.transaction(() => {
    createSubQuestionsV2Table(db);
    const idRemap = copyLegacySubQuestionRows(db, legacyRows);
    remapSubQuestionReferences(db, legacyRows, idRemap);
    db.exec("DROP TABLE research_sub_questions");
    db.exec("ALTER TABLE research_sub_questions_v2 RENAME TO research_sub_questions");
  });
  migrate();
};

const migrateResearchInteractionsRenderedPromptText = (db: Database.Database): void => {
  if (!hasColumn(db, "research_interactions", "rendered_prompt_text")) {
    db.exec("ALTER TABLE research_interactions ADD COLUMN rendered_prompt_text TEXT");
  }
  db.prepare(
    `UPDATE research_interactions
     SET rendered_prompt_text = ?
     WHERE rendered_prompt_text IS NULL OR trim(rendered_prompt_text) = ''`,
  ).run(LEGACY_RENDERED_PROMPT_TEXT);
};

const migrateResearchJobsFlowMode = (db: Database.Database): void => {
  if (!hasColumn(db, "research_jobs", "flow_mode")) {
    db.exec("ALTER TABLE research_jobs ADD COLUMN flow_mode TEXT");
  }
  db.prepare(
    `UPDATE research_jobs
     SET flow_mode = ?
     WHERE flow_mode IS NULL OR trim(flow_mode) = ''`,
  ).run("legacy_1_n_n_1");
};

const migrateResearchSubQuestionStructuredFields = (db: Database.Database): void => {
  if (!hasColumn(db, "research_sub_questions", "why_it_matters")) {
    db.exec("ALTER TABLE research_sub_questions ADD COLUMN why_it_matters TEXT");
  }
  if (!hasColumn(db, "research_sub_questions", "decision_weight")) {
    db.exec("ALTER TABLE research_sub_questions ADD COLUMN decision_weight TEXT");
  }
  if (!hasColumn(db, "research_sub_questions", "analysis_focus")) {
    db.exec("ALTER TABLE research_sub_questions ADD COLUMN analysis_focus TEXT");
  }
  if (!hasColumn(db, "research_sub_questions", "required_evidence_json")) {
    db.exec("ALTER TABLE research_sub_questions ADD COLUMN required_evidence_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!hasColumn(db, "research_sub_questions", "priority")) {
    db.exec("ALTER TABLE research_sub_questions ADD COLUMN priority TEXT");
  }
  if (!hasColumn(db, "research_sub_questions", "omission_risk")) {
    db.exec("ALTER TABLE research_sub_questions ADD COLUMN omission_risk TEXT");
  }
  db.prepare(
    `UPDATE research_sub_questions
     SET required_evidence_json = '[]'
     WHERE required_evidence_json IS NULL OR trim(required_evidence_json) = ''`,
  ).run();
};

const migrateResearchAnswersParsedPayload = (db: Database.Database): void => {
  if (!hasColumn(db, "research_answers", "parsed_payload_json")) {
    db.exec("ALTER TABLE research_answers ADD COLUMN parsed_payload_json TEXT NOT NULL DEFAULT '{}' ");
  }
  db.prepare(
    `UPDATE research_answers
     SET parsed_payload_json = '{}'
     WHERE parsed_payload_json IS NULL OR trim(parsed_payload_json) = ''`,
  ).run();
};

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
  migrateResearchInteractionsRenderedPromptText(db);
  migrateResearchJobsFlowMode(db);
  migrateResearchSubQuestionStructuredFields(db);
  migrateResearchAnswersParsedPayload(db);
  for (const statement of DEEP_RESEARCH_ANALYSIS_SCHEMA_SQL) {
    db.exec(statement);
  }
  return db;
};
