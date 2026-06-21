import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { PICK3_JOB_ID, PICK3_LOTTERY_TYPE, PICK3_OFFICIAL_SOURCE, PICK3_WINDOW_SIZE, type Pick3AiInteractionRecord, type Pick3Draw, type Pick3FailureReviewRecord, type Pick3ImageRecord, type Pick3PredictionRecord, type Pick3RevealRecord, type Pick3TaskRecord } from "./pick3-is-blind-eval.schema.js";
import type { Pick3PlaybookLessonRecord } from "./pick3-is-blind-eval.playbook-lesson-types.js";
import { insertPlaybookLessons, listPlaybookLessons, listPlaybookLessonsByPosition } from "./pick3-is-blind-eval.playbook-lesson-storage.js";
import type { Pick3PlaybookRecord } from "./pick3-is-blind-eval.playbook.js";
import { createPick3Schema, preparePick3Statements, type Pick3Statements } from "./pick3-is-blind-eval.storage-schema.js";

export type Pick3Storage = {
  close: () => void;
  dataRoot: string;
  dbPath: string;
  upsertDraws: (draws: readonly Pick3Draw[]) => { inserted: number; updated: number };
  listDrawsAscending: () => Pick3Draw[];
  listTargetDraws: (input: { lastPhase?: string; phases?: readonly string[]; batchSize: number }) => Pick3Draw[];
  insertBatch: (input: {
    batchId: string;
    artifactDir: string;
    targetPhase: string | null;
    sealedAnswersHash: string;
  }) => void;
  insertImages: (images: readonly Pick3ImageRecord[]) => void;
  insertAiInteractions: (interactions: readonly Pick3AiInteractionRecord[]) => void;
  insertPredictions: (predictions: readonly Pick3PredictionRecord[]) => void;
  insertReveals: (reveals: readonly Pick3RevealRecord[]) => void;
  insertFailureReviews: (reviews: readonly Pick3FailureReviewRecord[]) => void;
  insertPlaybookLessons: (lessons: readonly Pick3PlaybookLessonRecord[]) => void;
  upsertPlaybooks: (playbooks: readonly Pick3PlaybookRecord[]) => void;
  listActivePlaybooks: () => Pick3PlaybookRecord[];
  listAiInteractions: (batchId: string) => Pick3AiInteractionRecord[];
  listPredictions: (batchId: string) => Pick3PredictionRecord[];
  listReveals: (batchId: string) => Pick3RevealRecord[];
  listFailureReviews: (batchId: string) => Pick3FailureReviewRecord[];
  listPlaybookLessons: (batchId: string) => Pick3PlaybookLessonRecord[];
  listPlaybookLessonsByPosition: (position: Pick3PlaybookLessonRecord["position"]) => Pick3PlaybookLessonRecord[];
  writeTask: (record: Pick3TaskRecord) => void;
  readLatestTask: () => Pick3TaskRecord | null;
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

const rowToAiInteraction = (row: Record<string, unknown>): Pick3AiInteractionRecord => ({
  interactionId: String(row.interaction_id),
  batchId: String(row.batch_id),
  imageId: String(row.image_id),
  position: row.position as Pick3AiInteractionRecord["position"],
  promptPackageId: String(row.prompt_package_id),
  promptContractId: String(row.prompt_contract_id),
  playbookVersionId: String(row.playbook_version_id),
  providerKind: row.provider_kind as Pick3AiInteractionRecord["providerKind"],
  modelId: String(row.model_id),
  temperature: Number(row.temperature),
  imageDetail: String(row.image_detail),
  promptHash: String(row.prompt_hash),
  renderedPromptText: String(row.rendered_prompt_text),
  inputRefsJson: String(row.input_refs_json),
  rawResponseText: String(row.raw_response_text),
  rawResponseHash: String(row.raw_response_hash),
  rawOutputRef: String(row.raw_output_ref),
  providerProofJson: String(row.provider_proof_json),
  parseStatus: row.parse_status as Pick3AiInteractionRecord["parseStatus"],
  parseFailureReason: row.parse_failure_reason === null ? null : String(row.parse_failure_reason),
  createdAt: String(row.created_at),
});

const rowToPrediction = (row: Record<string, unknown>): Pick3PredictionRecord => ({
  predictionId: String(row.prediction_id),
  interactionId: String(row.interaction_id),
  batchId: String(row.batch_id),
  imageId: String(row.image_id),
  position: row.position as Pick3PredictionRecord["position"],
  playbookVersionId: String(row.prompt_version_id),
  providerKind: row.provider_kind as Pick3PredictionRecord["providerKind"],
  modelId: String(row.model_id),
  temperature: Number(row.temperature),
  imageDetail: String(row.image_detail),
  systemPromptVersionId: String(row.system_prompt_version_id),
  businessPromptVersionId: String(row.business_prompt_version_id),
  systemPromptHash: String(row.system_prompt_hash),
  businessPromptHash: String(row.business_prompt_hash),
  rawPromptHash: String(row.raw_prompt_hash),
  rawResponseRef: String(row.raw_response_ref),
  rawResponseHash: String(row.raw_response_hash),
  predictionLabel: row.prediction_label as Pick3PredictionRecord["predictionLabel"],
  confidence: row.confidence === null ? null : Number(row.confidence),
  confidenceIsProbability: false,
  tailShapes: row.tail_shapes === null ? null : JSON.parse(String(row.tail_shapes)) as string[],
  zoneWeight: (row.zone_weight ?? null) as Pick3PredictionRecord["zoneWeight"],
  drivingEvidence: row.driving_evidence === null ? null : String(row.driving_evidence),
  discountedEvidence: row.discounted_evidence === null ? null : String(row.discounted_evidence),
  abstainReason: row.abstain_reason === null ? null : String(row.abstain_reason),
  reason: row.reason === null ? null : String(row.reason),
  predictedAt: String(row.predicted_at),
  sealedBeforeReveal: true,
});

const rowToReveal = (row: Record<string, unknown>): Pick3RevealRecord => ({
  revealId: String(row.reveal_id),
  predictionId: String(row.prediction_id),
  imageId: String(row.image_id),
  answerDigit: Number(row.answer_digit),
  answerLabel: row.answer_label as Pick3RevealRecord["answerLabel"],
  hit: Number(row.hit) === 1,
  revealedAt: String(row.revealed_at),
  officialRawHash: String(row.official_raw_hash),
});

const rowToFailureReview = (row: Record<string, unknown>): Pick3FailureReviewRecord => ({
  failureReviewId: String(row.failure_review_id),
  batchId: String(row.batch_id),
  imageId: String(row.image_id),
  position: row.position as Pick3FailureReviewRecord["position"],
  predictionId: String(row.prediction_id),
  answerLabel: row.answer_label as Pick3FailureReviewRecord["answerLabel"],
  answerDigit: Number(row.answer_digit),
  providerKind: row.provider_kind as Pick3FailureReviewRecord["providerKind"],
  modelId: String(row.model_id),
  temperature: Number(row.temperature),
  imageDetail: String(row.image_detail),
  systemPromptVersionId: String(row.system_prompt_version_id),
  businessPromptVersionId: String(row.business_prompt_version_id),
  rawPromptHash: String(row.raw_prompt_hash),
  rawResponseRef: String(row.raw_response_ref),
  failureType: String(row.failure_type),
  promptProblem: String(row.prompt_problem),
  repairInstruction: String(row.repair_instruction),
  createdAt: String(row.created_at),
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
  input: { lastPhase?: string; phases?: readonly string[]; batchSize: number },
): Pick3Draw[] => {
  const draws = listDrawsAscending(statements);
  if (input.phases && input.phases.length > 0) {
    const wanted = new Set(input.phases);
    return draws.filter((draw, index) => wanted.has(draw.phase) && index >= PICK3_WINDOW_SIZE);
  }
  const lastIndex = input.lastPhase
    ? draws.findIndex((draw) => draw.phase === input.lastPhase)
    : draws.length - 1;
  if (lastIndex < PICK3_WINDOW_SIZE) return [];
  return draws
    .filter((_, index) => index >= PICK3_WINDOW_SIZE && index <= lastIndex)
    .slice(-input.batchSize);
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

const insertAiInteractions = (
  db: Database.Database,
  statements: Pick3Statements,
  interactions: readonly Pick3AiInteractionRecord[],
): void => {
  const run = db.transaction(() => {
    for (const interaction of interactions) {
      statements.insertAiInteraction.run(
        interaction.interactionId,
        interaction.batchId,
        interaction.imageId,
        interaction.position,
        interaction.promptPackageId,
        interaction.promptContractId,
        interaction.playbookVersionId,
        interaction.providerKind,
        interaction.modelId,
        interaction.temperature,
        interaction.imageDetail,
        interaction.promptHash,
        interaction.renderedPromptText,
        interaction.inputRefsJson,
        interaction.rawResponseText,
        interaction.rawResponseHash,
        interaction.rawOutputRef,
        interaction.providerProofJson,
        interaction.parseStatus,
        interaction.parseFailureReason,
        interaction.createdAt,
      );
    }
  });
  run();
};

const insertPredictions = (
  db: Database.Database,
  statements: Pick3Statements,
  predictions: readonly Pick3PredictionRecord[],
): void => {
  const run = db.transaction(() => {
    for (const prediction of predictions) {
      statements.insertPrediction.run(
        prediction.predictionId,
        prediction.interactionId,
        prediction.batchId,
        prediction.imageId,
        prediction.position,
        prediction.playbookVersionId,
        prediction.providerKind,
        prediction.modelId,
        prediction.temperature,
        prediction.imageDetail,
        prediction.systemPromptVersionId,
        prediction.businessPromptVersionId,
        prediction.systemPromptHash,
        prediction.businessPromptHash,
        prediction.rawPromptHash,
        prediction.rawResponseRef,
        prediction.rawResponseHash,
        prediction.predictionLabel,
        prediction.confidence,
        0,
        prediction.tailShapes !== null ? JSON.stringify(prediction.tailShapes) : null,
        prediction.zoneWeight ?? null,
        prediction.drivingEvidence ?? null,
        prediction.discountedEvidence ?? null,
        prediction.abstainReason,
        prediction.reason,
        prediction.predictedAt,
        1,
      );
    }
  });
  run();
};

const insertReveals = (db: Database.Database, statements: Pick3Statements, reveals: readonly Pick3RevealRecord[]): void => {
  const run = db.transaction(() => {
    for (const reveal of reveals) {
      statements.insertReveal.run(
        reveal.revealId,
        reveal.predictionId,
        reveal.imageId,
        reveal.answerDigit,
        reveal.answerLabel,
        reveal.hit ? 1 : 0,
        reveal.revealedAt,
        reveal.officialRawHash,
      );
    }
  });
  run();
};

const insertFailureReviews = (
  db: Database.Database,
  statements: Pick3Statements,
  reviews: readonly Pick3FailureReviewRecord[],
): void => {
  const run = db.transaction(() => {
    for (const review of reviews) {
      statements.insertFailureReview.run(
        review.failureReviewId,
        review.batchId,
        review.imageId,
        review.position,
        review.predictionId,
        review.answerLabel,
        review.answerDigit,
        review.providerKind,
        review.modelId,
        review.temperature,
        review.imageDetail,
        review.systemPromptVersionId,
        review.businessPromptVersionId,
        review.rawPromptHash,
        review.rawResponseRef,
        review.failureType,
        review.promptProblem,
        review.repairInstruction,
        review.createdAt,
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

const listAiInteractions = (statements: Pick3Statements, batchId: string): Pick3AiInteractionRecord[] =>
  statements.listAiInteractions.all(batchId).map((row) => rowToAiInteraction(row as Record<string, unknown>));

const listPredictions = (statements: Pick3Statements, batchId: string): Pick3PredictionRecord[] =>
  statements.listPredictions.all(batchId).map((row) => rowToPrediction(row as Record<string, unknown>));

const listReveals = (statements: Pick3Statements, batchId: string): Pick3RevealRecord[] =>
  statements.listReveals.all(batchId).map((row) => rowToReveal(row as Record<string, unknown>));

const listFailureReviews = (statements: Pick3Statements, batchId: string): Pick3FailureReviewRecord[] =>
  statements.listFailureReviews.all(batchId).map((row) => rowToFailureReview(row as Record<string, unknown>));

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
  createPick3Schema(db);
  const statements = preparePick3Statements(db);
  return {
    close: () => db.close(),
    dataRoot,
    dbPath,
    upsertDraws: (draws) => upsertDraws(db, statements, draws),
    listDrawsAscending: () => listDrawsAscending(statements),
    listTargetDraws: (input) => listTargetDraws(statements, input),
    insertBatch: (input) => insertBatch(statements, input),
    insertImages: (images) => insertImages(db, statements, images),
    insertAiInteractions: (interactions) => insertAiInteractions(db, statements, interactions),
    insertPredictions: (predictions) => insertPredictions(db, statements, predictions),
    insertReveals: (reveals) => insertReveals(db, statements, reveals),
    insertFailureReviews: (reviews) => insertFailureReviews(db, statements, reviews),
    insertPlaybookLessons: (lessons) => insertPlaybookLessons(db, statements, lessons),
    upsertPlaybooks: (playbooks) => upsertPlaybooks(db, statements, playbooks),
    listActivePlaybooks: () => listActivePlaybooks(statements),
    listAiInteractions: (batchId) => listAiInteractions(statements, batchId),
    listPredictions: (batchId) => listPredictions(statements, batchId),
    listReveals: (batchId) => listReveals(statements, batchId),
    listFailureReviews: (batchId) => listFailureReviews(statements, batchId),
    listPlaybookLessons: (batchId) => listPlaybookLessons(statements, batchId),
    listPlaybookLessonsByPosition: (position) => listPlaybookLessonsByPosition(statements, position),
    writeTask: (record) => writeTaskRecord(dataRoot, record),
    readLatestTask: () => readLatestTaskRecord(dataRoot),
  };
};
