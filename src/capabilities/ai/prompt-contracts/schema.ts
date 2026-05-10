import { z } from "zod";

import {
  PromptContractConfidencePolicySchema,
  PromptContractDebugPolicySchema,
  PromptContractFailurePolicySchema,
  PromptContractReviewPolicySchema,
} from "./policy-schema.js";

export const PromptContractCatalogTaskTypeSchema = z.enum([
  "page_preparation_judgment",
  "product_presence_judgment",
  "visual_observation",
  "visual_mission_action_plan",
  "visual_target_candidate_analysis",
  "ocr_cleanup",
  "comment_signal_summary",
  "product_signal_summary",
  "evidence_packet_analysis",
  "map_authoring",
  "schema_validation_only",
]);

export const PromptContractCatalogModelRoleSchema = z.enum([
  "vision",
  "ocr",
  "commentUnderstanding",
  "productSignal",
  "schemaValidator",
  "map-authoring",
  "multi-role",
  "future",
]);

const Sha256HashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const PromptContractCatalogLegacyTaskTypeSchema = z.enum([
  "vision.pagePreparation",
  "vision.nextItemAdvanced",
  "vision.productPresence",
  "vision.visualMissionActionPlan",
  "vision.nextItemTargetCandidate",
  "vision.commentsEntryTargetCandidate",
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
  promptContractVersion: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  schemaVersion: z.string().min(1),
  inputContract: z.string().min(1),
  requiredInputRefs: z.array(z.string().min(1)).min(1),
  outputSchemaRef: z.string().min(1),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  allowedBranchFields: z.array(z.string().min(1)).default([]),
  systemPromptTemplateRef: z.string().min(1).nullable().default(null),
  userPromptTemplateRef: z.string().min(1).nullable().default(null),
  systemPromptTemplateHash: Sha256HashSchema.optional(),
  userPromptTemplateHash: Sha256HashSchema.optional(),
  purpose: z.string().min(1),
  forbiddenOutputs: z.array(z.string().min(1)).default([]),
  prohibitedActions: z.array(z.string().min(1)).default([]),
  restrictedDataAccess: z.array(z.string().min(1)).default([]),
  confidencePolicy: PromptContractConfidencePolicySchema,
  reviewPolicy: PromptContractReviewPolicySchema,
  failurePolicy: PromptContractFailurePolicySchema,
  dataPolicy: z.record(z.string(), z.unknown()).optional(),
  safetyPolicy: z.record(z.string(), z.unknown()).optional(),
  debugPolicy: PromptContractDebugPolicySchema,
  promptHash: Sha256HashSchema,
  promptContractHash: Sha256HashSchema.optional(),
  sensitiveOperation: z.boolean().default(false),
}).strict();

export type PromptContractCatalogEntry = z.output<typeof PromptContractCatalogEntrySchema>;
