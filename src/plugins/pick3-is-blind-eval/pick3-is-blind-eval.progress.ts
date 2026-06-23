import type { BuiltPick3Batch } from "./pick3-is-blind-eval.flow-types.js";
import type {
  Pick3Input,
  Pick3SyncSummary,
  Pick3TaskRecord,
} from "./pick3-is-blind-eval.schema.js";
import type { Pick3TaskProgress } from "./pick3-is-blind-eval.checkpoint-types.js";
import type { Pick3Storage } from "./pick3-is-blind-eval.storage.js";

const buildProgressFromStorage = (
  storage: Pick3Storage,
  taskId: string,
): Pick3TaskProgress => {
  const checkpoints = storage.listPromptExchangeCheckpoints(taskId);
  const completedCount = checkpoints.filter((checkpoint) => checkpoint.status === "completed").length;
  const skippedCount = checkpoints.filter((checkpoint) => checkpoint.status === "skipped").length;
  const unresolvedCount = checkpoints.filter((checkpoint) => checkpoint.status === "unresolved").length;
  const paused = checkpoints.find((checkpoint) => checkpoint.status === "paused_rate_limited");
  const active = checkpoints.find((checkpoint) => checkpoint.status === "running") ?? paused ?? checkpoints.find((checkpoint) => checkpoint.status === "pending") ?? null;
  return {
    completedCount,
    currentImageId: active?.imageId ?? null,
    currentSequence: active?.sequence ?? null,
    expectedCount: checkpoints.length,
    pendingCount: checkpoints.filter((checkpoint) => checkpoint.status === "pending" || checkpoint.status === "paused_rate_limited").length,
    resumeAfter: paused?.resumeAfter ?? null,
    skippedCount,
    unresolvedCount,
  };
};

export const updateTaskProgress = (input: {
  batch: BuiltPick3Batch | null;
  createdAt: string;
  mode: Pick3Input["mode"];
  promptMode: Pick3Input["promptMode"];
  reason: string | null;
  status: Pick3TaskRecord["status"];
  storage: Pick3Storage;
  summary: Pick3SyncSummary;
  taskId: string;
}): void => {
  input.storage.writeTask({
    taskId: input.taskId,
    mode: input.mode,
    promptMode: input.promptMode,
    status: input.status,
    reachedStep: input.status === "paused_rate_limited" ? "ai_prompt_exchange_paused" : "ai_prompt_exchange_running",
    reason: input.reason,
    progress: buildProgressFromStorage(input.storage, input.taskId),
    createdAt: input.createdAt,
    updatedAt: new Date().toISOString(),
    sync: input.summary,
    batch: input.batch,
    scoring: null,
    stability: null,
  });
};
