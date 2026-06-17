import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import {
  PICK3_JOB_ID,
  PICK3_LOTTERY_TYPE,
  PICK3_OFFICIAL_SOURCE,
  PICK3_WINDOW_SIZE,
  type Pick3Draw,
  type Pick3ImageRecord,
  type Pick3TaskRecord,
} from "./pick3-is-blind-eval.schema.js";
import type { Pick3PlaybookRecord } from "./pick3-is-blind-eval.playbook.js";

export type Pick3Storage = {
  close: () => void;
  dataRoot: string;
  dbPath: string;
  upsertDraws: (draws: readonly Pick3Draw[]) => { inserted: number; updated: number };
  listDrawsAscending: () => Pick3Draw[];
  listTargetDraws: (input: { phases?: readonly string[]; batchSize: number }) => Pick3Draw[];
  insertBatch: (input: {
    batchId: string;
    artifactDir: string;
    targetPhase: string | null;
    sealedAnswersHash: string;
  }) => void;
  insertImages: (images: readonly Pick3ImageRecord[]) => void;
  upsertPlaybooks: (playbooks: readonly Pick3PlaybookRecord[]) => void;
  listActivePlaybooks: () => Pick3PlaybookRecord[];
  writeTask: (record: Pick3TaskRecord) => void;
  readLatestTask: () => Pick3TaskRecord | null;
};

const createSchema = (db: Database.Database): void => {
  db.exec(`
CREATE TABLE IF NOT EXISTS pick3_draws (
  source TEXT NOT NULL,
  lottery_type INTEGER NOT NULL,
  phase TEXT NOT NULL,
  expected_prize_time TEXT NOT NULL,
  expected_prize_timestamp TEXT NOT NULL,
  result_text TEXT NOT NULL,
  hundreds INTEGER NOT NULL,
  tens INTEGER NOT NULL,
  ones INTEGER NOT NULL,
  total_winning_bet_count INTEGER,
  result_detail_json TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  raw_hash TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source, lottery_type, phase)
);
CREATE TABLE IF NOT EXISTS is_blind_batches (
  batch_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  source TEXT NOT NULL,
  lottery_type INTEGER NOT NULL,
  window_size INTEGER NOT NULL,
  target_phase TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sealed_answers_hash TEXT,
  prediction_hash TEXT,
  reveal_hash TEXT,
  artifact_dir TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS is_blind_images (
  image_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  position TEXT NOT NULL,
  target_phase TEXT NOT NULL,
  target_expected_prize_time TEXT NOT NULL,
  visible_start_phase TEXT NOT NULL,
  visible_end_phase TEXT NOT NULL,
  image_path TEXT NOT NULL,
  image_sha256 TEXT NOT NULL,
  answer_digit INTEGER NOT NULL,
  answer_label TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pick3_playbooks (
  playbook_version_id TEXT PRIMARY KEY,
  position TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  content_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  system_prompt_hash TEXT NOT NULL,
  visual_grammar_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  parent_playbook_version_id TEXT,
  created_from_failure_review_id TEXT,
  notes TEXT
);
`);
};

const rowToDraw = (row: Record<string, unknown>): Pick3Draw => ({
  source: PICK3_OFFICIAL_SOURCE,
  lotteryType: PICK3_LOTTERY_TYPE,
  phase: String(row.phase),
  expectedPrizeTime: String(row.expected_prize_time),
  expectedPrizeTimestamp: String(row.expected_prize_timestamp),
  resultText: String(row.result_text),
  hundreds: Number(row.hundreds),
  tens: Number(row.tens),
  ones: Number(row.ones),
  totalWinningBetCount: row.total_winning_bet_count === null ? null : Number(row.total_winning_bet_count),
  resultDetailJson: String(row.result_detail_json),
  rawJson: String(row.raw_json),
  rawHash: String(row.raw_hash),
});

const rowToPlaybook = (row: Record<string, unknown>): Pick3PlaybookRecord => ({
  playbookVersionId: String(row.playbook_version_id),
  position: row.position as Pick3PlaybookRecord["position"],
  version: Number(row.version),
  status: row.status as Pick3PlaybookRecord["status"],
  sourceKind: row.source_kind as Pick3PlaybookRecord["sourceKind"],
  contentPath: String(row.content_path),
  contentHash: String(row.content_hash),
  systemPromptHash: String(row.system_prompt_hash),
  visualGrammarHash: String(row.visual_grammar_hash),
  parentPlaybookVersionId: row.parent_playbook_version_id === null ? null : String(row.parent_playbook_version_id),
  createdFromFailureReviewId: row.created_from_failure_review_id === null ? null : String(row.created_from_failure_review_id),
  notes: row.notes === null ? null : String(row.notes),
});

type Pick3Statements = {
  drawExists: Database.Statement;
  insertBatch: Database.Statement;
  insertDraw: Database.Statement;
  insertImage: Database.Statement;
  listActivePlaybooks: Database.Statement;
  listDrawsAscending: Database.Statement;
  updateDraw: Database.Statement;
  upsertPlaybook: Database.Statement;
};

const prepareStatements = (db: Database.Database): Pick3Statements => ({
  drawExists: db.prepare("SELECT raw_hash FROM pick3_draws WHERE source = ? AND lottery_type = ? AND phase = ?"),
  insertDraw: db.prepare(`
INSERT INTO pick3_draws (
  source, lottery_type, phase, expected_prize_time, expected_prize_timestamp, result_text,
  hundreds, tens, ones, total_winning_bet_count, result_detail_json, raw_json, raw_hash,
  fetched_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`),
  updateDraw: db.prepare(`
UPDATE pick3_draws SET
  expected_prize_time = ?, expected_prize_timestamp = ?, result_text = ?,
  hundreds = ?, tens = ?, ones = ?, total_winning_bet_count = ?,
  result_detail_json = ?, raw_json = ?, raw_hash = ?, fetched_at = ?, updated_at = ?
WHERE source = ? AND lottery_type = ? AND phase = ?
`),
  upsertPlaybook: db.prepare(`
INSERT INTO pick3_playbooks (
  playbook_version_id, position, version, status, source_kind, content_path,
  content_hash, system_prompt_hash, visual_grammar_hash, created_at,
  parent_playbook_version_id, created_from_failure_review_id, notes
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(playbook_version_id) DO UPDATE SET
  status = excluded.status,
  content_path = excluded.content_path,
  content_hash = excluded.content_hash,
  system_prompt_hash = excluded.system_prompt_hash,
  visual_grammar_hash = excluded.visual_grammar_hash,
  notes = excluded.notes
`),
  insertBatch: db.prepare(`
INSERT OR REPLACE INTO is_blind_batches (
  batch_id, mode, source, lottery_type, window_size, target_phase, status, created_at,
  sealed_answers_hash, prediction_hash, reveal_hash, artifact_dir
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`),
  insertImage: db.prepare(`
INSERT OR REPLACE INTO is_blind_images (
  image_id, batch_id, position, target_phase, target_expected_prize_time,
  visible_start_phase, visible_end_phase, image_path, image_sha256, answer_digit, answer_label
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`),
  listDrawsAscending: db.prepare("SELECT * FROM pick3_draws ORDER BY expected_prize_timestamp ASC, phase ASC"),
  listActivePlaybooks: db.prepare("SELECT * FROM pick3_playbooks WHERE status = 'active' ORDER BY position ASC, version DESC"),
});

const upsertDraws = (
  db: Database.Database,
  statements: Pick3Statements,
  draws: readonly Pick3Draw[],
): { inserted: number; updated: number } => {
  let inserted = 0;
  let updated = 0;
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const draw of draws) {
      const existing = statements.drawExists.get(draw.source, draw.lotteryType, draw.phase) as { raw_hash: string } | undefined;
      if (!existing) {
        statements.insertDraw.run(
          draw.source,
          draw.lotteryType,
          draw.phase,
          draw.expectedPrizeTime,
          draw.expectedPrizeTimestamp,
          draw.resultText,
          draw.hundreds,
          draw.tens,
          draw.ones,
          draw.totalWinningBetCount,
          draw.resultDetailJson,
          draw.rawJson,
          draw.rawHash,
          now,
          now,
          now,
        );
        inserted += 1;
      } else if (existing.raw_hash !== draw.rawHash) {
        statements.updateDraw.run(
          draw.expectedPrizeTime,
          draw.expectedPrizeTimestamp,
          draw.resultText,
          draw.hundreds,
          draw.tens,
          draw.ones,
          draw.totalWinningBetCount,
          draw.resultDetailJson,
          draw.rawJson,
          draw.rawHash,
          now,
          now,
          draw.source,
          draw.lotteryType,
          draw.phase,
        );
        updated += 1;
      }
    }
  });
  run();
  return { inserted, updated };
};

const listDrawsAscending = (statements: Pick3Statements): Pick3Draw[] =>
  statements.listDrawsAscending.all().map((row) => rowToDraw(row as Record<string, unknown>));

const listTargetDraws = (
  statements: Pick3Statements,
  input: { phases?: readonly string[]; batchSize: number },
): Pick3Draw[] => {
  const draws = listDrawsAscending(statements);
  if (input.phases && input.phases.length > 0) {
    const wanted = new Set(input.phases);
    return draws.filter((draw, index) => wanted.has(draw.phase) && index >= PICK3_WINDOW_SIZE);
  }
  return draws.filter((_, index) => index >= PICK3_WINDOW_SIZE).slice(-input.batchSize);
};

const insertBatch = (
  statements: Pick3Statements,
  input: { batchId: string; artifactDir: string; targetPhase: string | null; sealedAnswersHash: string },
): void => {
  statements.insertBatch.run(
    input.batchId,
    "generate_batch",
    PICK3_OFFICIAL_SOURCE,
    PICK3_LOTTERY_TYPE,
    PICK3_WINDOW_SIZE,
    input.targetPhase,
    "success",
    new Date().toISOString(),
    input.sealedAnswersHash,
    null,
    null,
    input.artifactDir,
  );
};

const insertImages = (db: Database.Database, statements: Pick3Statements, images: readonly Pick3ImageRecord[]): void => {
  const run = db.transaction(() => {
    for (const image of images) {
      statements.insertImage.run(
        image.imageId,
        image.batchId,
        image.position,
        image.targetPhase,
        image.targetExpectedPrizeTime,
        image.visibleStartPhase,
        image.visibleEndPhase,
        image.imagePath,
        image.imageSha256,
        image.answerDigit,
        image.answerLabel,
      );
    }
  });
  run();
};

const upsertPlaybooks = (
  db: Database.Database,
  statements: Pick3Statements,
  playbooks: readonly Pick3PlaybookRecord[],
): void => {
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const playbook of playbooks) {
      statements.upsertPlaybook.run(
        playbook.playbookVersionId,
        playbook.position,
        playbook.version,
        playbook.status,
        playbook.sourceKind,
        playbook.contentPath,
        playbook.contentHash,
        playbook.systemPromptHash,
        playbook.visualGrammarHash,
        now,
        playbook.parentPlaybookVersionId,
        playbook.createdFromFailureReviewId,
        playbook.notes,
      );
    }
  });
  run();
};

const listActivePlaybooks = (statements: Pick3Statements): Pick3PlaybookRecord[] =>
  statements.listActivePlaybooks.all().map((row) => rowToPlaybook(row as Record<string, unknown>));

const writeTaskRecord = (dataRoot: string, record: Pick3TaskRecord): void => {
  const taskDir = path.join(dataRoot, "tasks", record.taskId);
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(path.join(taskDir, "task.json"), `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(path.join(dataRoot, "latest-task.json"), `${JSON.stringify(record, null, 2)}\n`);
};

const readLatestTaskRecord = (dataRoot: string): Pick3TaskRecord | null => {
  try {
    return JSON.parse(readFileSync(path.join(dataRoot, "latest-task.json"), "utf8")) as Pick3TaskRecord;
  } catch {
    return null;
  }
};

export const openPick3Storage = (dataDir: string): Pick3Storage => {
  const dataRoot = path.join(dataDir, "runtime-data", PICK3_JOB_ID);
  mkdirSync(dataRoot, { recursive: true });
  const dbPath = path.join(dataRoot, "pick3.sqlite");
  const db = new Database(dbPath);
  createSchema(db);
  const statements = prepareStatements(db);
  return {
    close: () => db.close(),
    dataRoot,
    dbPath,
    upsertDraws: (draws) => upsertDraws(db, statements, draws),
    listDrawsAscending: () => listDrawsAscending(statements),
    listTargetDraws: (input) => listTargetDraws(statements, input),
    insertBatch: (input) => insertBatch(statements, input),
    insertImages: (images) => insertImages(db, statements, images),
    upsertPlaybooks: (playbooks) => upsertPlaybooks(db, statements, playbooks),
    listActivePlaybooks: () => listActivePlaybooks(statements),
    writeTask: (record) => writeTaskRecord(dataRoot, record),
    readLatestTask: () => readLatestTaskRecord(dataRoot),
  };
};
