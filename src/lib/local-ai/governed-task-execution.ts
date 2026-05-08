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

export const executeGovernedTask = (request: LocalAiTaskRequest, roleConfig: LocalModelRoleConfig, createdAt: string): LocalAiTaskResult => {
  switch (request.taskType) {
    case "vision.pagePreparation":
      throw new Error("vision.pagePreparation forbids governed fallback execution.");
    case "vision.nextItemAdvanced":
      throw new Error("vision.nextItemAdvanced forbids governed fallback execution.");
    case "vision.productPresence":
      throw new Error("vision.productPresence forbids governed heuristic execution; only model-backed AI may decide product presence.");
    case "vision.nextItemTargetCandidate":
      throw new Error("vision.nextItemTargetCandidate forbids governed heuristic execution; only model-backed AI may propose next-item candidates.");
    case "vision.commentsEntryTargetCandidate":
      throw new Error("vision.commentsEntryTargetCandidate forbids governed heuristic execution; only model-backed AI may propose comments-entry candidates.");
    case "comments.ocr_cleanup":
      return executeOcrTask(request, roleConfig, createdAt);
    case "comments.intent_analysis":
      throw new Error("comments.intent_analysis is not allowed; local AI may clean comments but must not produce commercial analysis.");
    case "product.signal_summary":
      throw new Error("product.signal_summary is not allowed; advanced commercial analysis must remain downstream of the local evidence boundary.");
  }
};
