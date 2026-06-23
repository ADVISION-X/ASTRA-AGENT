import type Database from "better-sqlite3";

import type { Pick3PromptExchangeCheckpoint } from "./pick3-is-blind-eval.checkpoint-types.js";
import type { Pick3Statements } from "./pick3-is-blind-eval.storage-schema.js";

export type Pick3PromptExchangeCheckpointPatch = Pick<
  Pick3PromptExchangeCheckpoint,
  "completionRound" | "imageId" | "interactionId" | "pauseReason" | "predictionId" | "repeatIndex" | "resumeAfter" | "status" | "taskId"
>;

const rowToPromptExchangeCheckpoint = (row: Record<string, unknown>): Pick3PromptExchangeCheckpoint => ({
  taskId: String(row.task_id),
  batchId: String(row.batch_id),
  imageId: String(row.image_id),
  promptPackageId: String(row.prompt_package_id),
  repeatIndex: Number(row.repeat_index),
  sequence: Number(row.sequence),
  completionRound: Number(row.completion_round),
  status: row.status as Pick3PromptExchangeCheckpoint["status"],
  interactionId: row.interaction_id === null ? null : String(row.interaction_id),
  predictionId: row.prediction_id === null ? null : String(row.prediction_id),
  pauseReason: row.pause_reason === null ? null : String(row.pause_reason),
  resumeAfter: row.resume_after === null ? null : String(row.resume_after),
  updatedAt: String(row.updated_at),
});

export const insertPromptExchangeCheckpoints = (
  db: Database.Database,
  statements: Pick3Statements,
  checkpoints: readonly Pick3PromptExchangeCheckpoint[],
): void => {
  const run = db.transaction(() => {
    for (const checkpoint of checkpoints) {
      statements.insertPromptExchangeCheckpoint.run(
        checkpoint.taskId,
        checkpoint.batchId,
        checkpoint.imageId,
        checkpoint.promptPackageId,
        checkpoint.repeatIndex,
        checkpoint.sequence,
        checkpoint.completionRound,
        checkpoint.status,
        checkpoint.interactionId,
        checkpoint.predictionId,
        checkpoint.pauseReason,
        checkpoint.resumeAfter,
        checkpoint.updatedAt,
      );
    }
  });
  run();
};

export const listPromptExchangeCheckpoints = (
  statements: Pick3Statements,
  taskId: string,
): Pick3PromptExchangeCheckpoint[] =>
  statements.listPromptExchangeCheckpoints.all(taskId).map((row) => rowToPromptExchangeCheckpoint(row as Record<string, unknown>));

export const markPromptExchangeCheckpoint = (
  statements: Pick3Statements,
  checkpoint: Pick3PromptExchangeCheckpointPatch,
): void => {
  statements.markPromptExchangeCheckpoint.run(
    checkpoint.status,
    checkpoint.interactionId,
    checkpoint.predictionId,
    checkpoint.pauseReason,
    checkpoint.resumeAfter,
    new Date().toISOString(),
    checkpoint.taskId,
    checkpoint.imageId,
    checkpoint.repeatIndex,
    checkpoint.completionRound,
  );
};
