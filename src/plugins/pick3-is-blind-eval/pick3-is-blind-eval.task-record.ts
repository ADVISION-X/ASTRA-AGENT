import type { BuiltPick3Batch } from "./pick3-is-blind-eval.flow-types.js";
import type {
  Pick3Input,
  Pick3ScoringSummary,
  Pick3SyncSummary,
  Pick3TaskRecord,
} from "./pick3-is-blind-eval.schema.js";
import type { Pick3StabilitySummary } from "./pick3-is-blind-eval.stability.js";

export const buildPick3SuccessTaskRecord = (input: {
  batch: BuiltPick3Batch | null;
  createdAt: string;
  mode: Pick3Input["mode"];
  promptMode: Pick3Input["promptMode"];
  scoring: Pick3ScoringSummary | null;
  stability: Pick3StabilitySummary | null;
  summary: Pick3SyncSummary;
  taskId: string;
}): Pick3TaskRecord => ({
  taskId: input.taskId,
  mode: input.mode,
  promptMode: input.promptMode,
  status: input.summary.status,
  reachedStep: input.mode === "next_prediction_stability" && input.batch ? "stability_completed" : input.mode === "full_pipeline" && input.batch ? "scoring_completed" : input.batch ? "images_generated" : "official_sync_completed",
  reason: null,
  progress: null,
  createdAt: input.createdAt,
  updatedAt: new Date().toISOString(),
  sync: input.summary,
  batch: input.batch,
  scoring: input.scoring,
  stability: input.stability,
});

export const buildPick3ReviewRequiredTaskRecord = (input: {
  batch: BuiltPick3Batch | null;
  createdAt: string;
  mode: Pick3Input["mode"];
  promptMode: Pick3Input["promptMode"];
  reason: string;
  summary: Pick3SyncSummary;
  taskId: string;
}): Pick3TaskRecord => ({
  taskId: input.taskId,
  mode: input.mode,
  promptMode: input.promptMode,
  status: "review_required",
  reachedStep: input.reason.startsWith("pick3_prompt_exchange_parse_failed")
    || input.reason.startsWith("pick3_next_stability_exchange_incomplete")
    ? "ai_prompt_exchange_failed"
    : input.batch ? "full_pipeline_failed" : "batch_generation",
  reason: input.reason,
  progress: null,
  createdAt: input.createdAt,
  updatedAt: new Date().toISOString(),
  sync: input.summary,
  batch: input.batch,
  scoring: null,
  stability: null,
});

export const emptyRunningSyncSummary = (taskId: string): Pick3SyncSummary => ({
  runId: taskId,
  status: "success",
  officialStartTime: "",
  officialEndTime: "",
  rowsSeen: 0,
  rowsInserted: 0,
  rowsUpdated: 0,
  newestPhase: null,
  oldestPhase: null,
  reason: null,
  officialApiResponseHash: null,
});
