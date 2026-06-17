import Database from "better-sqlite3";

export type Pick3Statements = {
  drawExists: Database.Statement;
  insertAiInteraction: Database.Statement;
  insertBatch: Database.Statement;
  insertDraw: Database.Statement;
  insertFailureReview: Database.Statement;
  insertImage: Database.Statement;
  insertPrediction: Database.Statement;
  insertReveal: Database.Statement;
  listActivePlaybooks: Database.Statement;
  listAiInteractions: Database.Statement;
  listDrawsAscending: Database.Statement;
  listFailureReviews: Database.Statement;
  listPredictions: Database.Statement;
  listReveals: Database.Statement;
  updateDraw: Database.Statement;
  upsertPlaybook: Database.Statement;
};

const schemaSql = [
  `CREATE TABLE IF NOT EXISTS pick3_draws (
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
)`,
  `CREATE TABLE IF NOT EXISTS is_blind_batches (
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
)`,
  `CREATE TABLE IF NOT EXISTS is_blind_images (
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
)`,
  `CREATE TABLE IF NOT EXISTS pick3_playbooks (
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
)`,
  `CREATE TABLE IF NOT EXISTS pick3_ai_interactions (
  interaction_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  position TEXT NOT NULL,
  prompt_package_id TEXT NOT NULL,
  prompt_contract_id TEXT NOT NULL,
  playbook_version_id TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  model_id TEXT NOT NULL,
  temperature REAL NOT NULL,
  image_detail TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  rendered_prompt_text TEXT NOT NULL,
  input_refs_json TEXT NOT NULL,
  raw_response_text TEXT NOT NULL,
  raw_response_hash TEXT NOT NULL,
  raw_output_ref TEXT NOT NULL,
  provider_proof_json TEXT NOT NULL,
  parse_status TEXT NOT NULL,
  parse_failure_reason TEXT,
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS ai_predictions (
  prediction_id TEXT PRIMARY KEY,
  interaction_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  position TEXT NOT NULL,
  prompt_version_id TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  model_id TEXT NOT NULL,
  temperature REAL NOT NULL,
  image_detail TEXT NOT NULL,
  system_prompt_version_id TEXT NOT NULL,
  business_prompt_version_id TEXT NOT NULL,
  system_prompt_hash TEXT NOT NULL,
  business_prompt_hash TEXT NOT NULL,
  raw_prompt_hash TEXT NOT NULL,
  raw_response_ref TEXT NOT NULL,
  raw_response_hash TEXT NOT NULL,
  prediction_label TEXT NOT NULL,
  confidence REAL,
  confidence_is_probability INTEGER NOT NULL,
  abstain_reason TEXT,
  reason TEXT,
  predicted_at TEXT NOT NULL,
  sealed_before_reveal INTEGER NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS ai_reveals (
  reveal_id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  answer_digit INTEGER NOT NULL,
  answer_label TEXT NOT NULL,
  hit INTEGER NOT NULL,
  revealed_at TEXT NOT NULL,
  official_raw_hash TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS failure_reviews (
  failure_review_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  position TEXT NOT NULL,
  prediction_id TEXT NOT NULL,
  answer_label TEXT NOT NULL,
  answer_digit INTEGER NOT NULL,
  provider_kind TEXT NOT NULL,
  model_id TEXT NOT NULL,
  temperature REAL NOT NULL,
  image_detail TEXT NOT NULL,
  system_prompt_version_id TEXT NOT NULL,
  business_prompt_version_id TEXT NOT NULL,
  raw_prompt_hash TEXT NOT NULL,
  raw_response_ref TEXT NOT NULL,
  failure_type TEXT NOT NULL,
  prompt_problem TEXT NOT NULL,
  repair_instruction TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,
] as const;

export const createPick3Schema = (db: Database.Database): void => {
  for (const sql of schemaSql) db.exec(sql);
};

const preparePick3DrawStatements = (db: Database.Database): Pick<
  Pick3Statements,
  "drawExists" | "insertDraw" | "updateDraw"
> => ({
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
});

const preparePick3BatchStatements = (db: Database.Database): Pick<
  Pick3Statements,
  "insertBatch" | "insertImage" | "upsertPlaybook"
> => ({
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
});

const preparePick3AiWriteStatements = (db: Database.Database): Pick<
  Pick3Statements,
  "insertAiInteraction" | "insertFailureReview" | "insertPrediction" | "insertReveal"
> => ({
  insertAiInteraction: db.prepare(`
INSERT OR REPLACE INTO pick3_ai_interactions (
  interaction_id, batch_id, image_id, position, prompt_package_id, prompt_contract_id,
  playbook_version_id, provider_kind, model_id, temperature, image_detail, prompt_hash,
  rendered_prompt_text, input_refs_json, raw_response_text, raw_response_hash, raw_output_ref,
  provider_proof_json, parse_status, parse_failure_reason, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`),
  insertPrediction: db.prepare(`
INSERT OR REPLACE INTO ai_predictions (
  prediction_id, interaction_id, batch_id, image_id, position, prompt_version_id, provider_kind, model_id,
  temperature, image_detail, system_prompt_version_id, business_prompt_version_id,
  system_prompt_hash, business_prompt_hash, raw_prompt_hash, raw_response_ref, raw_response_hash,
  prediction_label, confidence, confidence_is_probability, abstain_reason, reason, predicted_at,
  sealed_before_reveal
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`),
  insertReveal: db.prepare(`
INSERT OR REPLACE INTO ai_reveals (
  reveal_id, prediction_id, image_id, answer_digit, answer_label, hit, revealed_at, official_raw_hash
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`),
  insertFailureReview: db.prepare(`
INSERT OR REPLACE INTO failure_reviews (
  failure_review_id, batch_id, image_id, position, prediction_id, answer_label, answer_digit,
  provider_kind, model_id, temperature, image_detail, system_prompt_version_id,
  business_prompt_version_id, raw_prompt_hash, raw_response_ref, failure_type,
  prompt_problem, repair_instruction, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`),
});

const preparePick3WriteStatements = (db: Database.Database): Pick<
  Pick3Statements,
  | "drawExists"
  | "insertAiInteraction"
  | "insertBatch"
  | "insertDraw"
  | "insertFailureReview"
  | "insertImage"
  | "insertPrediction"
  | "insertReveal"
  | "updateDraw"
  | "upsertPlaybook"
> => ({
  ...preparePick3DrawStatements(db),
  ...preparePick3BatchStatements(db),
  ...preparePick3AiWriteStatements(db),
});

const preparePick3ReadStatements = (db: Database.Database): Pick<
  Pick3Statements,
  "listActivePlaybooks" | "listAiInteractions" | "listDrawsAscending" | "listFailureReviews" | "listPredictions" | "listReveals"
> => ({
  listDrawsAscending: db.prepare("SELECT * FROM pick3_draws ORDER BY expected_prize_timestamp ASC, phase ASC"),
  listActivePlaybooks: db.prepare("SELECT * FROM pick3_playbooks WHERE status = 'active' ORDER BY position ASC, version DESC"),
  listAiInteractions: db.prepare("SELECT * FROM pick3_ai_interactions WHERE batch_id = ? ORDER BY created_at ASC, image_id ASC"),
  listPredictions: db.prepare("SELECT * FROM ai_predictions WHERE batch_id = ? ORDER BY predicted_at ASC, image_id ASC"),
  listReveals: db.prepare(`
SELECT ai_reveals.* FROM ai_reveals
JOIN ai_predictions ON ai_predictions.prediction_id = ai_reveals.prediction_id
WHERE ai_predictions.batch_id = ?
ORDER BY ai_reveals.revealed_at ASC, ai_reveals.image_id ASC
`),
  listFailureReviews: db.prepare("SELECT * FROM failure_reviews WHERE batch_id = ? ORDER BY created_at ASC, image_id ASC"),
});

export const preparePick3Statements = (db: Database.Database): Pick3Statements => ({
  ...preparePick3WriteStatements(db),
  ...preparePick3ReadStatements(db),
});
