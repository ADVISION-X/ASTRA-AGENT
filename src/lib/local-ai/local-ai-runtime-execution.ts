import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import type { RuntimeExecutionInput } from "./local-ai-runtime-task-support.js";
import { executeCommentSignalRuntimeTask } from "./local-ai-runtime-comment-signal-task.js";
import { executeOcrCleanupRuntimeTask } from "./local-ai-runtime-ocr-task.js";
import { executePagePreparationRuntimeTask } from "./local-ai-runtime-page-preparation-task.js";
import { executeVisionRuntimeTask } from "./local-ai-runtime-vision-task.js";

export async function executeRuntimeTask(input: RuntimeExecutionInput) {
  const createdAt = new Date().toISOString();
  if (input.request.taskType === "product.signal_summary") {
    throw new LocalAiRuntimeError("disabled_by_policy", "product.signal_summary is not allowed in phase-04 runtime flow.");
  }

  if (input.request.taskType === "vision.pagePreparation") {
    return executePagePreparationRuntimeTask(input, createdAt);
  }

  if (
    input.request.taskType === "vision.productPresence"
    || input.request.taskType === "vision.nextItemTargetCandidate"
    || input.request.taskType === "vision.commentsEntryTargetCandidate"
  ) {
    return executeVisionRuntimeTask(input, createdAt);
  }

  if (input.request.taskType === "comments.ocr_cleanup") {
    return executeOcrCleanupRuntimeTask(input, createdAt);
  }

  return executeCommentSignalRuntimeTask(input, createdAt);
}
