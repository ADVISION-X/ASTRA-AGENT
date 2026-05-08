import { createId } from "../local-runtime/ids.js";
import type { LocalModelRoleConfig } from "./model-config.js";
import {
  CommentSignalTaskResultSchema,
  OcrTaskResultSchema,
  ProductSignalTaskResultSchema,
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

const executeCommentIntentTask = (request: Extract<LocalAiTaskRequest, { taskType: "comments.intent_analysis" }>, roleConfig: LocalModelRoleConfig, createdAt: string): LocalAiTaskResult => {
  const joined = request.input.cleanedComments.join(" ").toLowerCase();
  const purchaseIntent = joined.includes("where can i buy") || joined.includes("i need this") ? "high" : joined.includes("useful") ? "medium" : "low";
  const painPoints = ["messy", "space", "storage", "bathroom", "kitchen"].filter((term) => joined.includes(term));
  const complaints = ["fake", "broke", "expensive"].filter((term) => joined.includes(term));
  const demandTerms = ["where can i buy", "need this", "save space", "useful"].filter((term) => joined.includes(term));
  const confidence = complaints.length > 0 ? 0.78 : 0.9;
  return CommentSignalTaskResultSchema.parse({
    ...createResultBase(request, roleConfig, createdAt),
    confidence,
    result: { purchaseIntent, painPoints, complaints, demandTerms, confidence },
  });
};

const executeProductSignalTask = (request: Extract<LocalAiTaskRequest, { taskType: "product.signal_summary" }>, roleConfig: LocalModelRoleConfig, createdAt: string): LocalAiTaskResult => {
  const { commentSignals, videoSummary, productPresence } = request.input;
  const category = videoSummary.toLowerCase().includes("bathroom") ? "Bathroom Organizer" : "Home Utility";
  return ProductSignalTaskResultSchema.parse({
    ...createResultBase(request, roleConfig, createdAt),
    confidence: Math.max(productPresence.confidence, commentSignals.confidence),
    result: {
      category,
      useCase: category === "Bathroom Organizer" ? "Reduce bathroom clutter" : "Solve a visible home utility problem",
      sellingPoints: ["visual utility", "easy to understand", "clear before-after outcome"],
      painPoints: commentSignals.painPoints.length > 0 ? commentSignals.painPoints : ["space"],
      purchaseIntent: commentSignals.purchaseIntent,
      risk: commentSignals.complaints.length > 0 ? "medium" : "low",
      score: commentSignals.purchaseIntent === "high" ? 0.84 : 0.58,
      rationale: "candidate generated from evidence-backed vision and comment signals",
    },
  });
};

export const executeGovernedTask = (request: LocalAiTaskRequest, roleConfig: LocalModelRoleConfig, createdAt: string): LocalAiTaskResult => {
  switch (request.taskType) {
    case "vision.pagePreparation":
      throw new Error("vision.pagePreparation forbids governed fallback execution.");
    case "vision.productPresence":
      throw new Error("vision.productPresence forbids governed heuristic execution; only model-backed AI may decide product presence.");
    case "comments.ocr_cleanup":
      return executeOcrTask(request, roleConfig, createdAt);
    case "comments.intent_analysis":
      return executeCommentIntentTask(request, roleConfig, createdAt);
    case "product.signal_summary":
      return executeProductSignalTask(request, roleConfig, createdAt);
  }
};
