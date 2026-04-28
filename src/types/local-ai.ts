import { z } from "zod";

import { EvidenceRefSchema } from "./evidence.js";
import {
  VisionProductPresencePayloadSchema,
  VisionProductPresenceRequestInputSchema,
} from "./vision-product-presence.js";

export const LocalAiTaskTypeSchema = z.enum([
  "vision.productPresence",
  "comments.ocr_cleanup",
  "comments.intent_analysis",
  "product.signal_summary"
]);

export const LocalAiModelRoleSchema = z.enum([
  "vision",
  "ocr",
  "commentUnderstanding",
  "productSignal"
]);

export const LocalAiRuntimeSchema = z.enum([
  "ollama",
  "llama.cpp",
  "paddleocr",
  "apple-vision",
  "local-ocr",
  "local-wrapper"
]);

export const LocalAiImplementationStatusSchema = z.enum([
  "configured-not-connected",
  "governed-heuristic",
  "fixture_heuristic_only",
  "model_backed",
  "local_ai_unavailable"
]);

export const LocalAiOverallStatusSchema = z.enum(["ready", "degraded", "unavailable"]);
export const LocalAiDependencyStatusSchema = z.enum(["ready", "missing", "unreachable", "unavailable"]);
export const LocalAiInvocationStatusSchema = z.enum([
  "success",
  "local_ai_unavailable",
  "invalid_ai_output",
  "disabled_by_policy"
]);

export const OcrCleanupPayloadSchema = z.object({
  cleanedComments: z.array(z.string().min(1)),
  uncertainText: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1)
});

export const CommentSignalPayloadSchema = z.object({
  purchaseIntent: z.enum(["low", "medium", "high"]),
  painPoints: z.array(z.string().min(1)),
  complaints: z.array(z.string().min(1)),
  demandTerms: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1)
});

export const ProductSignalPayloadSchema = z.object({
  category: z.string().min(1),
  useCase: z.string().min(1),
  sellingPoints: z.array(z.string().min(1)),
  painPoints: z.array(z.string().min(1)),
  purchaseIntent: z.enum(["low", "medium", "high"]),
  risk: z.enum(["low", "medium", "high"]),
  score: z.number().min(0).max(1),
  rationale: z.string().min(1)
});

export const VisionTaskRequestSchema = z.object({
  id: z.string().min(1),
  taskType: z.literal("vision.productPresence"),
  modelRole: z.literal("vision"),
  promptVersion: z.literal("v1"),
  schemaVersion: z.literal("vision.productPresence.schema.v1"),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  input: VisionProductPresenceRequestInputSchema,
});

export const OcrTaskRequestSchema = z.object({
  id: z.string().min(1),
  taskType: z.literal("comments.ocr_cleanup"),
  modelRole: z.literal("ocr"),
  promptVersion: z.literal("comments.ocr_cleanup.v1"),
  schemaVersion: z.literal("ocr-text.v1"),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  input: z.object({
    rawCommentBlocks: z.array(z.string())
  })
});

export const CommentSignalTaskRequestSchema = z.object({
  id: z.string().min(1),
  taskType: z.literal("comments.intent_analysis"),
  modelRole: z.literal("commentUnderstanding"),
  promptVersion: z.literal("comments.intent_analysis.v1"),
  schemaVersion: z.literal("comment-signal.v1"),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  input: z.object({
    cleanedComments: z.array(z.string().min(1)).min(1)
  })
});

export const ProductSignalTaskRequestSchema = z.object({
  id: z.string().min(1),
  taskType: z.literal("product.signal_summary"),
  modelRole: z.literal("productSignal"),
  promptVersion: z.literal("product.signal_summary.v1"),
  schemaVersion: z.literal("product-opportunity-candidate.v1"),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  input: z.object({
    videoSummary: z.string().min(1),
    productPresence: VisionProductPresencePayloadSchema,
    commentSignals: CommentSignalPayloadSchema
  })
});

export const LocalAiTaskRequestSchema = z.discriminatedUnion("taskType", [
  VisionTaskRequestSchema,
  OcrTaskRequestSchema,
  CommentSignalTaskRequestSchema,
  ProductSignalTaskRequestSchema
]);

const LocalAiResultBaseSchema = z.object({
  id: z.string().min(1),
  taskType: LocalAiTaskTypeSchema,
  modelRole: LocalAiModelRoleSchema,
  provider: z.literal("local"),
  runtime: LocalAiRuntimeSchema,
  model: z.string().min(1),
  implementationStatus: LocalAiImplementationStatusSchema,
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  confidence: z.number().min(0).max(1),
  createdAt: z.string().datetime()
});

export const VisionTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("vision.productPresence"),
  modelRole: z.literal("vision"),
  result: VisionProductPresencePayloadSchema
});

export const OcrTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("comments.ocr_cleanup"),
  modelRole: z.literal("ocr"),
  result: OcrCleanupPayloadSchema
});

export const CommentSignalTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("comments.intent_analysis"),
  modelRole: z.literal("commentUnderstanding"),
  result: CommentSignalPayloadSchema
});

export const ProductSignalTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("product.signal_summary"),
  modelRole: z.literal("productSignal"),
  result: ProductSignalPayloadSchema
});

export const LocalAiTaskResultSchema = z.discriminatedUnion("taskType", [
  VisionTaskResultSchema,
  OcrTaskResultSchema,
  CommentSignalTaskResultSchema,
  ProductSignalTaskResultSchema
]);

export const LocalAiHealthSchema = z.object({
  overallStatus: LocalAiOverallStatusSchema,
  implementationStatus: LocalAiImplementationStatusSchema,
  ollamaStatus: LocalAiDependencyStatusSchema,
  visionModelStatus: LocalAiDependencyStatusSchema,
  textModelStatus: LocalAiDependencyStatusSchema,
  ocrStatus: LocalAiDependencyStatusSchema,
  configuredModels: z.object({
    vision: z.string().min(1),
    commentUnderstanding: z.string().min(1),
    ocr: z.string().min(1),
    productSignal: z.string().min(1),
  }),
  availableModels: z.array(z.string().min(1)),
  lastCheckedAt: z.string().datetime(),
  failureReason: z.string().min(1).nullable().default(null),
  lastTaskType: LocalAiTaskTypeSchema.nullable().default(null),
  lastFailureReason: z.string().min(1).nullable().default(null),
  lastInvocationStatus: LocalAiInvocationStatusSchema.nullable().default(null),
});

export type LocalAiTaskType = z.infer<typeof LocalAiTaskTypeSchema>;
export type LocalAiModelRole = z.infer<typeof LocalAiModelRoleSchema>;
export type LocalAiRuntime = z.infer<typeof LocalAiRuntimeSchema>;
export type LocalAiImplementationStatus = z.infer<typeof LocalAiImplementationStatusSchema>;
export type LocalAiOverallStatus = z.infer<typeof LocalAiOverallStatusSchema>;
export type LocalAiDependencyStatus = z.infer<typeof LocalAiDependencyStatusSchema>;
export type LocalAiInvocationStatus = z.infer<typeof LocalAiInvocationStatusSchema>;
export type VisionClassificationPayload = z.infer<typeof VisionProductPresencePayloadSchema>;
export type OcrCleanupPayload = z.infer<typeof OcrCleanupPayloadSchema>;
export type CommentSignalPayload = z.infer<typeof CommentSignalPayloadSchema>;
export type ProductSignalPayload = z.infer<typeof ProductSignalPayloadSchema>;
export type LocalAiTaskRequest = z.infer<typeof LocalAiTaskRequestSchema>;
export type LocalAiTaskResult = z.infer<typeof LocalAiTaskResultSchema>;
export type LocalAiHealth = z.infer<typeof LocalAiHealthSchema>;