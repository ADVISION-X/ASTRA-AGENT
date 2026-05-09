import { z } from "zod";

import { EvidenceRefSchema } from "./evidence.js";
import {
  VisionPagePreparationPayloadSchema,
  VisionPagePreparationRequestInputSchema,
} from "./vision-page-preparation.js";
import {
  VisionProductPresencePayloadSchema,
  VisionProductPresenceRequestInputSchema,
} from "./vision-product-presence.js";
import {
  VisionNextItemTargetCandidatePayloadSchema,
  VisionNextItemTargetCandidateRequestInputSchema,
} from "./vision-next-item-target-candidate.js";
import {
  VisionCommentsEntryTargetCandidatePayloadSchema,
  VisionCommentsEntryTargetCandidateRequestInputSchema,
} from "./vision-comments-entry-target-candidate.js";
import {
  VisionNextItemAdvancedPayloadSchema,
  VisionNextItemAdvancedRequestInputSchema,
} from "./vision-next-item-advanced.js";
const LocalAiTaskTypeSchema = z.enum(["vision.pagePreparation", "vision.nextItemAdvanced", "vision.productPresence", "vision.nextItemTargetCandidate", "vision.commentsEntryTargetCandidate", "comments.ocr_cleanup", "comments.intent_analysis", "product.signal_summary"]);
const LocalAiModelRoleSchema = z.enum(["vision", "ocr", "commentUnderstanding", "productSignal"]);
const LocalAiRuntimeSchema = z.enum(["ollama", "llama.cpp", "paddleocr", "apple-vision", "local-ocr", "local-wrapper"]);
const LocalAiImplementationStatusSchema = z.enum(["configured-not-connected", "governed-heuristic", "fixture_heuristic_only", "model_backed", "local_ai_unavailable"]);
const LocalAiOverallStatusSchema = z.enum(["ready", "degraded", "unavailable"]);
const LocalAiDependencyStatusSchema = z.enum(["ready", "missing", "unreachable", "unavailable"]);
const LocalAiInvocationStatusSchema = z.enum(["success", "local_ai_unavailable", "invalid_ai_output", "disabled_by_policy"]);
const LocalAiStartupFailureReasonSchema = z.enum(["LOCAL_AI_RUNTIME_NOT_FOUND", "LOCAL_AI_RUNTIME_START_FAILED", "LOCAL_AI_MODEL_MISSING", "LOCAL_AI_MODEL_UNHEALTHY", "LOCAL_AI_READINESS_TIMEOUT", "UPDATE_PREFLIGHT_FAILED", "LOCAL_AI_NOT_READY"]);
const LocalAiStartupRoleHealthSchema = z.enum(["ready", "missing", "unhealthy"]);
const OcrCleanupPayloadSchema = z.object({
  cleanedComments: z.array(z.string().min(1)),
  uncertainText: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1)
});
const CommentSignalPayloadSchema = z.object({
  purchaseIntent: z.enum(["low", "medium", "high"]),
  painPoints: z.array(z.string().min(1)),
  complaints: z.array(z.string().min(1)),
  demandTerms: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1)
});
const ProductSignalPayloadSchema = z.object({
  category: z.string().min(1),
  useCase: z.string().min(1),
  sellingPoints: z.array(z.string().min(1)),
  painPoints: z.array(z.string().min(1)),
  purchaseIntent: z.enum(["low", "medium", "high"]),
  risk: z.enum(["low", "medium", "high"]),
  score: z.number().min(0).max(1),
  rationale: z.string().min(1)
});
const PagePreparationTaskRequestSchema = z.object({
  id: z.string().min(1),
  taskType: z.literal("vision.pagePreparation"),
  modelRole: z.literal("vision"),
  promptVersion: z.literal("v1"),
  schemaVersion: z.literal("vision.pagePreparation.schema.v1"),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  input: VisionPagePreparationRequestInputSchema,
});
const NextItemAdvancedTaskRequestSchema = z.object({
  id: z.string().min(1),
  taskType: z.literal("vision.nextItemAdvanced"),
  modelRole: z.literal("vision"),
  promptVersion: z.literal("v1"),
  schemaVersion: z.literal("vision.nextItemAdvanced.schema.v1"),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  input: VisionNextItemAdvancedRequestInputSchema,
});
const VisionTaskRequestSchema = z.object({
  id: z.string().min(1),
  taskType: z.literal("vision.productPresence"),
  modelRole: z.literal("vision"),
  promptVersion: z.literal("v1"),
  schemaVersion: z.literal("vision.productPresence.schema.v1"),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  input: VisionProductPresenceRequestInputSchema,
});
const NextItemTargetCandidateTaskRequestSchema = z.object({
  id: z.string().min(1),
  taskType: z.literal("vision.nextItemTargetCandidate"),
  modelRole: z.literal("vision"),
  promptVersion: z.literal("v1"),
  schemaVersion: z.literal("vision.nextItemTargetCandidate.schema.v1"),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  input: VisionNextItemTargetCandidateRequestInputSchema,
});
const CommentsEntryTargetCandidateTaskRequestSchema = z.object({
  id: z.string().min(1),
  taskType: z.literal("vision.commentsEntryTargetCandidate"),
  modelRole: z.literal("vision"),
  promptVersion: z.literal("v1"),
  schemaVersion: z.literal("vision.commentsEntryTargetCandidate.schema.v1"),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  input: VisionCommentsEntryTargetCandidateRequestInputSchema,
});
const OcrTaskRequestSchema = z.object({
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
const CommentSignalTaskRequestSchema = z.object({
  id: z.string().min(1),
  taskType: z.literal("comments.intent_analysis"),
  modelRole: z.literal("commentUnderstanding"),
  promptVersion: z.literal("comments.disabled_by_policy.v1"),
  schemaVersion: z.literal("comment-signal.v1"),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  input: z.object({
    cleanedComments: z.array(z.string().min(1)).min(1)
  })
});
const ProductSignalTaskRequestSchema = z.object({
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
const LocalAiTaskRequestSchema = z.discriminatedUnion("taskType", [
  PagePreparationTaskRequestSchema,
  NextItemAdvancedTaskRequestSchema,
  VisionTaskRequestSchema,
  NextItemTargetCandidateTaskRequestSchema,
  CommentsEntryTargetCandidateTaskRequestSchema,
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
const PagePreparationTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("vision.pagePreparation"),
  modelRole: z.literal("vision"),
  result: VisionPagePreparationPayloadSchema
});
const NextItemAdvancedTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("vision.nextItemAdvanced"),
  modelRole: z.literal("vision"),
  result: VisionNextItemAdvancedPayloadSchema
});
const VisionTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("vision.productPresence"),
  modelRole: z.literal("vision"),
  result: VisionProductPresencePayloadSchema
});
const NextItemTargetCandidateTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("vision.nextItemTargetCandidate"),
  modelRole: z.literal("vision"),
  result: VisionNextItemTargetCandidatePayloadSchema
});
const CommentsEntryTargetCandidateTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("vision.commentsEntryTargetCandidate"),
  modelRole: z.literal("vision"),
  result: VisionCommentsEntryTargetCandidatePayloadSchema
});
const OcrTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("comments.ocr_cleanup"),
  modelRole: z.literal("ocr"),
  result: OcrCleanupPayloadSchema
});
const CommentSignalTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("comments.intent_analysis"),
  modelRole: z.literal("commentUnderstanding"),
  result: CommentSignalPayloadSchema
});
const ProductSignalTaskResultSchema = LocalAiResultBaseSchema.extend({
  taskType: z.literal("product.signal_summary"),
  modelRole: z.literal("productSignal"),
  result: ProductSignalPayloadSchema
});
const LocalAiTaskResultSchema = z.discriminatedUnion("taskType", [
  PagePreparationTaskResultSchema,
  NextItemAdvancedTaskResultSchema,
  VisionTaskResultSchema,
  NextItemTargetCandidateTaskResultSchema,
  CommentsEntryTargetCandidateTaskResultSchema,
  OcrTaskResultSchema,
  CommentSignalTaskResultSchema,
  ProductSignalTaskResultSchema
]);
const LocalAiHealthSchema = z.object({
  overallStatus: LocalAiOverallStatusSchema,
  implementationStatus: LocalAiImplementationStatusSchema,
  ollamaStatus: LocalAiDependencyStatusSchema,
  visionModelStatus: LocalAiDependencyStatusSchema,
  textModelStatus: LocalAiDependencyStatusSchema,
  productSignalModelStatus: LocalAiDependencyStatusSchema,
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
const LocalAiStartupRoleReadinessSchema = z.object({
  modelRole: LocalAiModelRoleSchema,
  modelName: z.string().min(1),
  provider: z.literal("local"),
  runtime: LocalAiRuntimeSchema,
  health: LocalAiStartupRoleHealthSchema,
  failureReason: LocalAiStartupFailureReasonSchema.nullable().default(null),
});
const LocalAiStartupReadinessSchema = z.object({
  component: z.literal("local-ai-runtime"),
  status: z.enum(["ready", "failed", "degraded"]),
  runtimeBaseUrl: z.string().min(1),
  detail: z.string().min(1),
  modelRoles: z.array(LocalAiStartupRoleReadinessSchema),
  missionRuntimeAvailable: z.boolean(),
  failureReason: LocalAiStartupFailureReasonSchema.nullable().default(null),
  developmentOnly: z.boolean().default(false),
  checkedAt: z.string().datetime(),
});
type LocalAiTaskType = z.infer<typeof LocalAiTaskTypeSchema>;
type LocalAiModelRole = z.infer<typeof LocalAiModelRoleSchema>;
type LocalAiRuntime = z.infer<typeof LocalAiRuntimeSchema>;
type LocalAiImplementationStatus = z.infer<typeof LocalAiImplementationStatusSchema>;
type LocalAiOverallStatus = z.infer<typeof LocalAiOverallStatusSchema>;
type LocalAiDependencyStatus = z.infer<typeof LocalAiDependencyStatusSchema>;
type LocalAiInvocationStatus = z.infer<typeof LocalAiInvocationStatusSchema>;
type LocalAiStartupFailureReason = z.infer<typeof LocalAiStartupFailureReasonSchema>;
type LocalAiStartupRoleHealth = z.infer<typeof LocalAiStartupRoleHealthSchema>;
type PagePreparationPayload = z.infer<typeof VisionPagePreparationPayloadSchema>;
type VisionClassificationPayload = z.infer<typeof VisionProductPresencePayloadSchema>;
type NextItemTargetCandidatePayload = z.infer<typeof VisionNextItemTargetCandidatePayloadSchema>;
type CommentsEntryTargetCandidatePayload = z.infer<typeof VisionCommentsEntryTargetCandidatePayloadSchema>;
type OcrCleanupPayload = z.infer<typeof OcrCleanupPayloadSchema>;
type CommentSignalPayload = z.infer<typeof CommentSignalPayloadSchema>;
type ProductSignalPayload = z.infer<typeof ProductSignalPayloadSchema>;
type LocalAiTaskRequest = z.infer<typeof LocalAiTaskRequestSchema>;
type LocalAiTaskResult = z.infer<typeof LocalAiTaskResultSchema>;
type LocalAiHealth = z.infer<typeof LocalAiHealthSchema>;
type LocalAiStartupRoleReadiness = z.infer<typeof LocalAiStartupRoleReadinessSchema>;
type LocalAiStartupReadiness = z.infer<typeof LocalAiStartupReadinessSchema>;

export { LocalAiTaskTypeSchema, LocalAiModelRoleSchema, LocalAiRuntimeSchema, LocalAiImplementationStatusSchema, LocalAiOverallStatusSchema, LocalAiDependencyStatusSchema, LocalAiInvocationStatusSchema, LocalAiStartupFailureReasonSchema, LocalAiStartupRoleHealthSchema, OcrCleanupPayloadSchema, CommentSignalPayloadSchema, ProductSignalPayloadSchema, PagePreparationTaskRequestSchema, NextItemAdvancedTaskRequestSchema, VisionTaskRequestSchema, NextItemTargetCandidateTaskRequestSchema, CommentsEntryTargetCandidateTaskRequestSchema, OcrTaskRequestSchema, CommentSignalTaskRequestSchema, ProductSignalTaskRequestSchema, LocalAiTaskRequestSchema, PagePreparationTaskResultSchema, NextItemAdvancedTaskResultSchema, VisionTaskResultSchema, NextItemTargetCandidateTaskResultSchema, CommentsEntryTargetCandidateTaskResultSchema, OcrTaskResultSchema, CommentSignalTaskResultSchema, ProductSignalTaskResultSchema, LocalAiTaskResultSchema, LocalAiHealthSchema, LocalAiStartupRoleReadinessSchema, LocalAiStartupReadinessSchema };
export type { LocalAiTaskType, LocalAiModelRole, LocalAiRuntime, LocalAiImplementationStatus, LocalAiOverallStatus, LocalAiDependencyStatus, LocalAiInvocationStatus, LocalAiStartupFailureReason, LocalAiStartupRoleHealth, PagePreparationPayload, VisionClassificationPayload, NextItemTargetCandidatePayload, CommentsEntryTargetCandidatePayload, OcrCleanupPayload, CommentSignalPayload, ProductSignalPayload, LocalAiTaskRequest, LocalAiTaskResult, LocalAiHealth, LocalAiStartupRoleReadiness, LocalAiStartupReadiness };
