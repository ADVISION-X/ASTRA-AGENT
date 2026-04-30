import { z } from "zod";

export const PromptContractCatalogTaskTypeSchema = z.enum([
  "product_presence_judgment",
  "visual_observation",
  "visual_target_candidate_analysis",
  "ocr_cleanup",
  "comment_signal_summary",
  "product_signal_summary",
  "evidence_packet_analysis",
  "schema_validation_only",
]);

export const PromptContractCatalogModelRoleSchema = z.enum([
  "vision",
  "ocr",
  "commentUnderstanding",
  "productSignal",
  "schemaValidator",
  "multi-role",
  "future",
]);

export const PromptContractCatalogLegacyTaskTypeSchema = z.enum([
  "vision.productPresence",
  "comments.ocr_cleanup",
  "comments.intent_analysis",
  "product.signal_summary",
]).nullable().default(null);

export const PromptContractCatalogEntrySchema = z.object({
  promptContractId: z.string().min(1),
  promptId: z.string().min(1),
  taskType: PromptContractCatalogTaskTypeSchema,
  legacyTaskType: PromptContractCatalogLegacyTaskTypeSchema,
  modelRole: PromptContractCatalogModelRoleSchema,
  promptVersion: z.string().min(1),
  inputContract: z.string().min(1),
  requiredInputRefs: z.array(z.string().min(1)).min(1),
  outputSchemaRef: z.string().min(1),
  allowedBranchFields: z.array(z.string().min(1)).default([]),
  systemPromptTemplateRef: z.string().min(1).nullable().default(null),
  userPromptTemplateRef: z.string().min(1).nullable().default(null),
  purpose: z.string().min(1),
  forbiddenOutputs: z.array(z.string().min(1)).default([]),
  prohibitedActions: z.array(z.string().min(1)).default([]),
  restrictedDataAccess: z.array(z.string().min(1)).default([]),
  confidencePolicy: z.string().min(1),
  reviewPolicy: z.string().min(1),
  failurePolicy: z.string().min(1),
  debugPolicy: z.string().min(1),
  promptHash: z.string().min(1),
  sensitiveOperation: z.boolean().default(false),
}).strict();

export type PromptContractCatalogEntry = z.output<typeof PromptContractCatalogEntrySchema>;