import { createId } from "../local-runtime/ids.js";
import type { LocalModelRoleConfig } from "./model-config.js";
import {
  OcrTaskResultSchema,
  type LocalAiTaskRequest,
  type LocalAiTaskResult,
} from "../../types/local-ai.js";

const createResultBase = (request: LocalAiTaskRequest, roleConfig: LocalModelRoleConfig, createdAt: string) => ({
  id: createId("ai"),
  taskType: request.taskType,
  modelRole: roleConfig.role,
  provider: roleConfig.provider,
  runtime: roleConfig.runtime,
  model: roleConfig.model,
  implementationStatus: "governed-heuristic" as const,
  promptVersion: roleConfig.promptVersion,
  schemaVersion: roleConfig.schemaVersion,
  evidenceRefs: request.evidenceRefs,
  createdAt,
});

const executeOcrTask = (request: Extract<LocalAiTaskRequest, { taskType: "comments.ocr_cleanup" }>, roleConfig: LocalModelRoleConfig, createdAt: string): LocalAiTaskResult => {
  const cleanedComments = request.input.rawCommentBlocks.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  const uncertainText = cleanedComments.filter((entry) => entry.includes("???"));
  const confidence = uncertainText.length > 0 ? 0.62 : 0.93;
  return OcrTaskResultSchema.parse({
    ...createResultBase(request, roleConfig, createdAt),
    confidence,
    result: { cleanedComments, uncertainText, confidence },
  });
};

const GOVERNED_TASK_FALLBACK_MESSAGES: Record<Exclude<LocalAiTaskRequest["taskType"], "comments.ocr_cleanup">, string> = {
  "vision.pagePreparation": "vision.pagePreparation forbids governed fallback execution.",
  "vision.nextItemAdvanced": "vision.nextItemAdvanced forbids governed fallback execution.",
  "vision.productPresence": "vision.productPresence forbids governed heuristic execution; only model-backed AI may decide product presence.",
  "vision.nextItemTargetCandidate": "vision.nextItemTargetCandidate forbids governed heuristic execution; only model-backed AI may propose next-item candidates.",
  "vision.commentsEntryTargetCandidate": "vision.commentsEntryTargetCandidate forbids governed heuristic execution; only model-backed AI may propose comments-entry candidates.",
  "comments.intent_analysis": "comments.intent_analysis is not allowed; local AI may clean comments but must not produce commercial analysis.",
  "product.signal_summary": "product.signal_summary is not allowed; advanced commercial analysis must remain downstream of the local evidence boundary.",
};

const createGovernedTaskFallbackError = (taskType: Exclude<LocalAiTaskRequest["taskType"], "comments.ocr_cleanup">): Error => new Error(GOVERNED_TASK_FALLBACK_MESSAGES[taskType]);

export const executeGovernedTask = (request: LocalAiTaskRequest, roleConfig: LocalModelRoleConfig, createdAt: string): LocalAiTaskResult => request.taskType === "comments.ocr_cleanup"
  ? executeOcrTask(request, roleConfig, createdAt)
  : (() => { throw createGovernedTaskFallbackError(request.taskType); })();
