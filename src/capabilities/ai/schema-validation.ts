import { z } from "zod";

import { EvidenceRefSchema } from "../../types/evidence.js";
import { VisionProductPresencePayloadSchema, VisionProductPresenceRequestInputSchema } from "../../types/vision-product-presence.js";
import type { AiAbilityInput, AiAbilityResult, AiRuntimeHealth, AiTaskType } from "./contract.js";

export const AiOcrCleanupOutputSchema = z.object({
  cleanedComments: z.array(z.string().min(1)),
  uncertainText: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
});

export const AiCommentSignalSummaryOutputSchema = z.object({
  purchaseIntent: z.enum(["low", "medium", "high"]),
  painPoints: z.array(z.string().min(1)),
  complaints: z.array(z.string().min(1)),
  demandTerms: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
});

export const AiProductSignalSummaryOutputSchema = z.object({
  category: z.string().min(1),
  useCase: z.string().min(1),
  sellingPoints: z.array(z.string().min(1)),
  painPoints: z.array(z.string().min(1)),
  purchaseIntent: z.enum(["low", "medium", "high"]),
  risk: z.enum(["low", "medium", "high"]),
  score: z.number().min(0).max(1),
  rationale: z.string().min(1),
});

export const AiTaskTypeSchema = z.enum([
  "product_presence_judgment",
  "visual_observation",
  "visual_target_candidate_analysis",
  "ocr_cleanup",
  "comment_signal_summary",
  "product_signal_summary",
  "evidence_packet_analysis",
  "schema_validation_only",
]);

const AiInputModalitySchema = z.enum(["image_collection", "text_blocks", "structured_record", "mixed", "none"]);
const AiProviderKindSchema = z.enum(["local", "paid", "future", "internal"]);
const AiModelRoleSchema = z.enum(["vision", "ocr", "commentUnderstanding", "productSignal", "schemaValidator", "multi-role", "future"]);
const AiSchemaValidationStatusSchema = z.enum(["valid", "invalid", "not_applicable"]);
const AiExecutionStatusSchema = z.enum(["success", "failed", "review_required"]);

const AiProviderPolicySchema = z.object({
  requireLocalOnly: z.boolean(),
  allowPaidProvider: z.boolean(),
  providerAllowlist: z.array(z.enum(["local-vision-ai", "local-text-ai", "local-ocr-ai", "paid-vision-ai", "paid-analysis-ai", "future-api-ai"])),
  operatorApprovalRef: z.string().min(1).nullable(),
});

const AiCostPolicySchema = z.object({
  maxEstimatedCost: z.number().nonnegative().nullable(),
});

const AiDataPolicySchema = z.object({
  allowExternalTransmission: z.boolean(),
  redactSensitiveData: z.boolean(),
});

const AiQualityPolicySchema = z.object({
  minimumConfidence: z.number().min(0).max(1).nullable(),
  requireSchemaValidation: z.boolean(),
});

const AiSafetyPolicySchema = z.object({
  reviewOnLowConfidence: z.boolean(),
  reviewOnSchemaFailure: z.boolean(),
  reviewOnPolicyViolation: z.boolean(),
});

const AiRuntimeProofSchema = z.object({
  abilityGroupId: z.literal("ai"),
  childCapabilityId: z.enum(["local-vision-ai", "local-text-ai", "local-ocr-ai", "paid-vision-ai", "paid-analysis-ai", "future-api-ai"]),
  sessionId: z.string().min(1),
  roundId: z.string().min(1).nullable(),
  videoVisitId: z.string().min(1).nullable(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().nonnegative(),
  status: AiExecutionStatusSchema,
  reason: z.string().min(1),
  failureReason: z.string().min(1).nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
  inputRefs: z.array(z.string().min(1)),
  outputRefs: z.array(z.string().min(1)),
  evidenceRefs: z.array(z.string().min(1)),
  actionLogRefs: z.array(z.string().min(1)),
  nextAbilityGroup: z.string().min(1).nullable(),
  nextChildAbility: z.string().min(1).nullable(),
  dataQualityFlags: z.array(z.string().min(1)),
});

const baseInputSchema = z.object({
  abilityGroupId: z.literal("ai"),
  inputRefs: z.array(EvidenceRefSchema),
  promptContractId: z.string().min(1),
  expectedOutputSchema: z.string().min(1),
  requestedBy: z.literal("orchestration"),
  transportedBy: z.literal("nerve-bus"),
  sessionId: z.string().min(1),
  roundId: z.string().min(1).nullable(),
  videoVisitId: z.string().min(1).nullable(),
  qualityPolicy: AiQualityPolicySchema,
  providerPolicy: AiProviderPolicySchema,
  costPolicy: AiCostPolicySchema,
  dataPolicy: AiDataPolicySchema,
  safetyPolicy: AiSafetyPolicySchema,
});

export const AiEvidencePacketAnalysisInputSchema = z.object({
  packetSummary: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
  notes: z.array(z.string().min(1)).default([]),
});

export const AiSchemaValidationOnlyInputSchema = z.object({
  candidate: z.unknown(),
});

export const AiVisualOutputSchema = VisionProductPresencePayloadSchema.omit({
  taskType: true,
  promptId: true,
  promptVersion: true,
  schemaVersion: true,
});

export const AiEvidencePacketAnalysisOutputSchema = z.object({
  summary: z.string().min(1),
  notableEvidenceRefs: z.array(z.string().min(1)).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export const AiSchemaValidationOnlyOutputSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.string().min(1)).default([]),
});

export const AiOcrCleanupInputSchema = z.object({
  rawCommentBlocks: z.array(z.string()),
});

export const AiCommentSignalSummaryInputSchema = z.object({
  cleanedComments: z.array(z.string().min(1)).min(1),
});

export const AiProductSignalSummaryInputSchema = z.object({
  videoSummary: z.string().min(1),
  productPresence: AiVisualOutputSchema,
  commentSignals: AiCommentSignalSummaryOutputSchema,
});

export const AiAbilityInputSchema = z.discriminatedUnion("taskType", [
  baseInputSchema.extend({ taskType: z.literal("product_presence_judgment"), inputModality: z.literal("image_collection"), input: VisionProductPresenceRequestInputSchema }),
  baseInputSchema.extend({ taskType: z.literal("visual_observation"), inputModality: z.literal("image_collection"), input: VisionProductPresenceRequestInputSchema }),
  baseInputSchema.extend({ taskType: z.literal("visual_target_candidate_analysis"), inputModality: z.literal("image_collection"), input: VisionProductPresenceRequestInputSchema }),
  baseInputSchema.extend({ taskType: z.literal("ocr_cleanup"), inputModality: z.literal("text_blocks"), input: AiOcrCleanupInputSchema }),
  baseInputSchema.extend({ taskType: z.literal("comment_signal_summary"), inputModality: z.literal("text_blocks"), input: AiCommentSignalSummaryInputSchema }),
  baseInputSchema.extend({ taskType: z.literal("product_signal_summary"), inputModality: z.literal("structured_record"), input: AiProductSignalSummaryInputSchema }),
  baseInputSchema.extend({ taskType: z.literal("evidence_packet_analysis"), inputModality: z.literal("structured_record"), input: AiEvidencePacketAnalysisInputSchema }),
  baseInputSchema.extend({ taskType: z.literal("schema_validation_only"), inputModality: z.literal("structured_record"), input: AiSchemaValidationOnlyInputSchema }),
]);

const baseResultSchema = z.object({
  status: AiExecutionStatusSchema,
  abilityGroupId: z.literal("ai"),
  childCapabilityId: z.enum(["local-vision-ai", "local-text-ai", "local-ocr-ai", "paid-vision-ai", "paid-analysis-ai", "future-api-ai"]),
  modelProvider: AiProviderKindSchema,
  modelName: z.string().min(1),
  modelRole: AiModelRoleSchema,
  runtime: z.string().min(1),
  implementationStatus: z.string().min(1),
  rawOutputRef: z.string().min(1).nullable(),
  schemaValidationStatus: AiSchemaValidationStatusSchema,
  confidence: z.number().min(0).max(1).nullable(),
  failureReason: z.string().min(1).nullable(),
  durationMs: z.number().nonnegative(),
  costEstimate: z.number().nonnegative().nullable(),
  evidenceRefs: z.array(EvidenceRefSchema),
  debugLogRef: z.string().min(1).nullable(),
  runtimeProof: AiRuntimeProofSchema,
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const AiAbilityResultSchema = z.discriminatedUnion("taskType", [
  baseResultSchema.extend({ taskType: z.literal("product_presence_judgment"), output: AiVisualOutputSchema }),
  baseResultSchema.extend({ taskType: z.literal("visual_observation"), output: AiVisualOutputSchema }),
  baseResultSchema.extend({ taskType: z.literal("visual_target_candidate_analysis"), output: AiVisualOutputSchema }),
  baseResultSchema.extend({ taskType: z.literal("ocr_cleanup"), output: AiOcrCleanupOutputSchema }),
  baseResultSchema.extend({ taskType: z.literal("comment_signal_summary"), output: AiCommentSignalSummaryOutputSchema }),
  baseResultSchema.extend({ taskType: z.literal("product_signal_summary"), output: AiProductSignalSummaryOutputSchema }),
  baseResultSchema.extend({ taskType: z.literal("evidence_packet_analysis"), output: AiEvidencePacketAnalysisOutputSchema }),
  baseResultSchema.extend({ taskType: z.literal("schema_validation_only"), output: AiSchemaValidationOnlyOutputSchema }),
]);

export const AiRuntimeHealthSchema = z.object({
  overallStatus: z.enum(["ready", "degraded", "unavailable"]),
  implementationStatus: z.string().min(1),
  dependencies: z.object({ gateway: z.string().min(1), vision: z.string().min(1), text: z.string().min(1), ocr: z.string().min(1) }),
  configuredModels: z.object({ vision: z.string().min(1), commentUnderstanding: z.string().min(1), ocr: z.string().min(1), productSignal: z.string().min(1) }),
  availableModels: z.array(z.string().min(1)),
  lastCheckedAt: z.string().datetime(),
  failureReason: z.string().min(1).nullable(),
  lastTaskType: AiTaskTypeSchema.nullable(),
  lastFailureReason: z.string().min(1).nullable(),
  lastInvocationStatus: z.string().min(1).nullable(),
});

const AI_OUTPUT_SCHEMA_BY_TASK: Record<AiTaskType, z.ZodType<unknown>> = {
  product_presence_judgment: AiVisualOutputSchema,
  visual_observation: AiVisualOutputSchema,
  visual_target_candidate_analysis: AiVisualOutputSchema,
  ocr_cleanup: AiOcrCleanupOutputSchema,
  comment_signal_summary: AiCommentSignalSummaryOutputSchema,
  product_signal_summary: AiProductSignalSummaryOutputSchema,
  evidence_packet_analysis: AiEvidencePacketAnalysisOutputSchema,
  schema_validation_only: AiSchemaValidationOnlyOutputSchema,
};

const AI_OUTPUT_SCHEMA_TASK_BY_ALIAS: Record<string, AiTaskType> = {
  product_presence_judgment: "product_presence_judgment",
  visual_observation: "visual_observation",
  visual_target_candidate_analysis: "visual_target_candidate_analysis",
  ocr_cleanup: "ocr_cleanup",
  comment_signal_summary: "comment_signal_summary",
  product_signal_summary: "product_signal_summary",
  evidence_packet_analysis: "evidence_packet_analysis",
  schema_validation_only: "schema_validation_only",
  "ai.product_presence_judgment.v1": "product_presence_judgment",
  "ai.visual_observation.v1": "visual_observation",
  "ai.visual_target_candidate_analysis.v1": "visual_target_candidate_analysis",
  "ai.ocr_cleanup.v1": "ocr_cleanup",
  "ai.comment_signal_summary.v1": "comment_signal_summary",
  "ai.product_signal_summary.v1": "product_signal_summary",
  "ai.evidence_packet_analysis.v1": "evidence_packet_analysis",
  "ai.schema_validation_only.v1": "schema_validation_only",
  "vision.productPresence.v1": "product_presence_judgment",
  "comments.ocr_cleanup.v1": "ocr_cleanup",
  "comments.intent_analysis.v1": "comment_signal_summary",
  "product.signal_summary.v1": "product_signal_summary",
  "ai.evidence_packet_analysis.disabled": "evidence_packet_analysis",
  "ai.schema_validation_only.internal": "schema_validation_only",
  "vision.productPresence.schema.v1": "product_presence_judgment",
  "ocr-text.v1": "ocr_cleanup",
  "comment-signal.v1": "comment_signal_summary",
  "product-opportunity-candidate.v1": "product_signal_summary",
};

export function getAiTaskOutputSchema(taskType: AiTaskType): z.ZodType<unknown> {
  return AI_OUTPUT_SCHEMA_BY_TASK[taskType];
}

export function resolveAiExpectedOutputTask(input: Pick<AiAbilityInput, "expectedOutputSchema" | "promptContractId">): AiTaskType | null {
  return AI_OUTPUT_SCHEMA_TASK_BY_ALIAS[input.expectedOutputSchema]
    ?? AI_OUTPUT_SCHEMA_TASK_BY_ALIAS[input.promptContractId]
    ?? null;
}

export function safeParseAiTaskOutput(taskType: AiTaskType, output: unknown) {
  return getAiTaskOutputSchema(taskType).safeParse(output);
}

export function validateAiAbilityInput(input: unknown): AiAbilityInput {
  return AiAbilityInputSchema.parse(input) as AiAbilityInput;
}

export function validateAiAbilityResult(input: unknown): AiAbilityResult {
  return AiAbilityResultSchema.parse(input) as AiAbilityResult;
}

export function validateAiRuntimeHealth(input: unknown): AiRuntimeHealth {
  return AiRuntimeHealthSchema.parse(input) as AiRuntimeHealth;
}