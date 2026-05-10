import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import type { RuntimeExecutionInput } from "./local-ai-runtime-task-support.js";
import { executeNextItemAdvancedRuntimeTask } from "./local-ai-runtime-next-item-advanced-task.js";
import { executeOcrCleanupRuntimeTask } from "./local-ai-runtime-ocr-task.js";
import { executePagePreparationRuntimeTask } from "./local-ai-runtime-page-preparation-task.js";
import { executeVisualMissionActionPlanRuntimeTask } from "./local-ai-runtime-visual-mission-action-plan-task.js";
import { executeVisionRuntimeTask } from "./local-ai-runtime-vision-task.js";

type RuntimeTaskType = RuntimeExecutionInput["request"]["taskType"];
type RuntimeTaskExecutor = (input: RuntimeExecutionInput, createdAt: string) => ReturnType<typeof executePagePreparationRuntimeTask>;

const RUNTIME_TASK_EXECUTORS: Partial<Record<RuntimeTaskType, RuntimeTaskExecutor>> = {
  "vision.pagePreparation": executePagePreparationRuntimeTask,
  "vision.nextItemAdvanced": executeNextItemAdvancedRuntimeTask,
  "vision.productPresence": executeVisionRuntimeTask,
  "vision.visualMissionActionPlan": executeVisualMissionActionPlanRuntimeTask,
  "vision.nextItemTargetCandidate": executeVisionRuntimeTask,
  "vision.commentsEntryTargetCandidate": executeVisionRuntimeTask,
  "comments.ocr_cleanup": executeOcrCleanupRuntimeTask,
};

function assertRuntimeTaskAllowed(taskType: RuntimeExecutionInput["request"]["taskType"]): void {
  if (taskType === "comments.intent_analysis") {
    throw new LocalAiRuntimeError("disabled_by_policy", "comments.intent_analysis is not allowed; local AI may clean comments but must not produce commercial analysis.");
  }
  if (taskType === "product.signal_summary") {
    throw new LocalAiRuntimeError("disabled_by_policy", "product.signal_summary is not allowed in phase-04 runtime flow.");
  }
}

function executeSupportedRuntimeTask(input: RuntimeExecutionInput, createdAt: string) {
  const executor = RUNTIME_TASK_EXECUTORS[input.request.taskType];
  if (!executor) {
    throw new LocalAiRuntimeError("disabled_by_policy", `${input.request.taskType} is not allowed in the local runtime.`);
  }
  return executor(input, createdAt);
}

export async function executeRuntimeTask(input: RuntimeExecutionInput) {
  const createdAt = new Date().toISOString();
  assertRuntimeTaskAllowed(input.request.taskType);
  return executeSupportedRuntimeTask(input, createdAt);
}
