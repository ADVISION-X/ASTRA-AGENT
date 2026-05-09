import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import type { RuntimeExecutionInput } from "./local-ai-runtime-task-support.js";
import { executeNextItemAdvancedRuntimeTask } from "./local-ai-runtime-next-item-advanced-task.js";
import { executeOcrCleanupRuntimeTask } from "./local-ai-runtime-ocr-task.js";
import { executePagePreparationRuntimeTask } from "./local-ai-runtime-page-preparation-task.js";
import { executeVisionRuntimeTask } from "./local-ai-runtime-vision-task.js";

function assertRuntimeTaskAllowed(taskType: RuntimeExecutionInput["request"]["taskType"]): void {
  if (taskType === "comments.intent_analysis") {
    throw new LocalAiRuntimeError("disabled_by_policy", "comments.intent_analysis is not allowed; local AI may clean comments but must not produce commercial analysis.");
  }
  if (taskType === "product.signal_summary") {
    throw new LocalAiRuntimeError("disabled_by_policy", "product.signal_summary is not allowed in phase-04 runtime flow.");
  }
}

function executeSupportedRuntimeTask(input: RuntimeExecutionInput, createdAt: string) {
  switch (input.request.taskType) {
    case "vision.pagePreparation":
      return executePagePreparationRuntimeTask(input, createdAt);
    case "vision.nextItemAdvanced":
      return executeNextItemAdvancedRuntimeTask(input, createdAt);
    case "vision.productPresence":
    case "vision.nextItemTargetCandidate":
    case "vision.commentsEntryTargetCandidate":
      return executeVisionRuntimeTask(input, createdAt);
    case "comments.ocr_cleanup":
      return executeOcrCleanupRuntimeTask(input, createdAt);
    default:
      throw new LocalAiRuntimeError("disabled_by_policy", `${input.request.taskType} is not allowed in the local runtime.`);
  }
}

export async function executeRuntimeTask(input: RuntimeExecutionInput) {
  const createdAt = new Date().toISOString();
  assertRuntimeTaskAllowed(input.request.taskType);
  return executeSupportedRuntimeTask(input, createdAt);
}
