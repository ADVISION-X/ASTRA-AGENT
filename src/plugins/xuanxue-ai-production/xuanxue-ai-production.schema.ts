import { z } from "zod";

import type {
  AiFeedResult,
  AiInputGatewayProgress,
  WebChatAttachmentUploadProof,
} from "../../capabilities/ai-input-gateway/index.js";
import {
  XuanxueLocalizationRoleSchema,
  XuanxueProviderExecutionProfileSchema as XuanxueLocalizationProviderExecutionProfileSchema,
} from "./xuanxue-ai-production-localization-contract.js";
import {
  inspectXuanxueContinuationPolicy,
  inspectXuanxueLocalizationPolicy,
} from "./xuanxue-ai-production-schema-refinements.js";
import {
  xuanxueTerminalMetaphysicsProviderProfile,
} from "./xuanxue-ai-production-terminal-profile.js";
import type { AgentRuntimeReceiptV6 } from "./xuanxue-ai-production-browser-proof.js";

export const XUANXUE_AI_PRODUCTION_JOB_ID = "xuanxue-ai-production" as const;
export const XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION =
  "XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION" as const;

export const XuanxueAiProductIdSchema = z.enum([
  "bazi_chart_interpretation",
  "bazi_ai_full_analysis",
  "bazi_report_followup",
  "qimen_professional_answer",
  "qimen_report_followup",
  "hehun_ai_analysis",
  "hehun_report_followup",
  "naming_bazi_analysis_and_naming",
  "naming_from_existing_bazi_report",
  "bazi_canonical_base_interpretation",
  "hehun_canonical_party_a_interpretation",
  "hehun_canonical_party_b_interpretation",
  "manual_accuracy_challenge",
  "payment_screenshot_observation",
  "public_knowledge_article_pipeline",
  "localization_report_translation",
  "localization_article_translation",
  "localization_static_review_candidate",
  "localization_static_review_selector",
  "scheduled_quality_reflection",
]);

export const XuanxueAiStageIdSchema = z.enum([
  "base_interpretation",
  "chart_interpretation",
  "question_analysis",
  "analysis",
  "followup",
  "party_a_interpretation",
  "party_b_interpretation",
  "final_compatibility",
  "naming_author",
  "manual_accuracy_challenge",
  "payment_screenshot_observation",
  "corpus_research",
  "article_synthesis",
  "article_image_generation",
  "report_translation",
  "article_translation",
  "localization_candidate",
  "localization_selector",
  "scheduled_quality_reflection",
]);

export const XuanxueAiProductionTriggerKindSchema = z.enum([
  "user_request",
  "manual_accuracy_challenge",
  "scheduled_public_content",
  "scheduled_quality_reflection",
  "terminal_localization",
  "localization_static_review",
]);

const XuanxueAiMaterialRefSchema = z.object({
  id: z.string().min(1).max(240),
  kind: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  filePath: z.string().min(1).optional(),
  fileName: z.string().min(1).max(240).optional(),
  mimeType: z.string().min(1).max(160).optional(),
  sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/u).optional(),
  byteCount: z.number().int().nonnegative().optional(),
}).strict();

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

const XuanxueAiCloudExecutionIdentitySchema = z.object({
  jobId: z.string().min(1).max(200),
  attemptId: z.string().min(1).max(200),
  requiredDeviceId: z.string().min(1).max(200),
  leaseVersion: z.number().int().positive(),
  executionFenceHash: hashSchema,
  contractManifestHash: hashSchema,
  serverNow: z.string().datetime(),
  leaseExpiresAt: z.string().datetime(),
}).strict();

const FrozenParticipantBindingSchema = z.object({
  slotRef: z.string().min(1),
  roleCode: z.string().min(1),
  personRef: z.string().min(1),
  profileVersionRef: z.string().min(1),
  chartStateRef: z.string().min(1),
  chartStateVersion: z.string().min(1),
  chartStateHash: hashSchema,
  purposeCode: z.string().min(1),
  authorizationReceiptRef: z.string().min(1),
}).strict();

export const XuanxueAiFrozenSubjectSchema = z.object({
  privacyOwnerRef: z.string().min(1),
  snapshotRef: z.string().min(1),
  snapshotHash: hashSchema,
  caseRevisionRef: z.string().min(1),
  primaryPersonRef: z.string().min(1).nullable(),
  participantManifestHash: hashSchema,
  participants: z.array(FrozenParticipantBindingSchema).max(32),
}).strict();

const ConversationParentBindingSchema = z.object({
  relation: z.enum(["same_conversation", "forked_from_checkpoint"]),
  jobId: z.string().min(1).max(200),
  stageId: XuanxueAiStageIdSchema,
  executionId: z.string().min(1),
  rawOutputHash: hashSchema,
  inputBundleHash: hashSchema,
  conversationScopeRef: z.string().min(1),
}).strict();

const TypedJoinParentBindingSchema = z.object({
  participantSlotRef: z.string().min(1),
  participantRoleCode: z.string().min(1),
  personRef: z.string().min(1),
  jobId: z.string().min(1).max(200),
  stageId: XuanxueAiStageIdSchema,
  executionId: z.string().min(1),
  rawOutputHash: hashSchema,
  conversationScopeRef: z.string().min(1),
}).strict();

export const XuanxueAiStageMaterialSchema = z.object({
  stageId: XuanxueAiStageIdSchema,
  promptPackageId: z.string().min(1).max(240),
  promptContractId: z.string().min(1).max(240),
  expectedOutputSchemaRef: z.string().min(1).max(240).nullable(),
  expectedOutputKind: z.enum(["text", "generated_image"]),
  textPrompt: z.string().min(1),
  inputRefs: z.array(XuanxueAiMaterialRefSchema),
  timeoutMs: z.number().int().min(60_000).max(3_600_000).default(3_600_000),
  maxFileCount: z.number().int().min(0).max(64).default(32),
}).strict();

export const XuanxueMetaphysicsProviderExecutionProfileSchema = z.object({
  profile_ref: z.string().min(1),
  profile_hash: hashSchema.transform((value): `sha256:${string}` => value as `sha256:${string}`),
  provider: z.literal("openai-chatgpt-web"),
  transport: z.literal("gpt-web-chat"),
  account_capability_ref: z.string().min(1),
  model_label: z.literal(xuanxueTerminalMetaphysicsProviderProfile.modelLabel),
  model_family: z.literal(xuanxueTerminalMetaphysicsProviderProfile.modelFamily),
  model_identity_status: z.literal("verified"),
  reasoning_effort: z.literal(xuanxueTerminalMetaphysicsProviderProfile.reasoningTier),
  executor_identity_ref: z.string().min(1),
  ai_acceptance_ref: z.string().min(1),
  ai_acceptance_version: z.string().min(1),
}).strict();

const XuanxueStoredProviderExecutionProfileSchema = z.union([
  XuanxueMetaphysicsProviderExecutionProfileSchema,
  XuanxueLocalizationProviderExecutionProfileSchema,
]);

export const XuanxueAiStoredProductionOrderSchema = z.object({
  protocolVersion: z.literal("xuanxue-ai-production-v6"),
  orderId: z.string().min(1).max(200),
  sourceProject: z.literal("xuanxue-web"),
  sourceTaskId: z.string().min(1).max(240),
  productId: XuanxueAiProductIdSchema,
  serviceClass: z.enum(["user_delivery", "public_content", "quality_background", "localization"]),
  triggerKind: XuanxueAiProductionTriggerKindSchema,
  lineageId: z.string().min(1).nullable(),
  reflectionSnapshotRef: z.string().min(1).nullable(),
  reflectionPlanId: z.string().min(1).nullable(),
  inputBundleRef: z.string().min(1).max(500),
  inputBundleHash: hashSchema,
  requestHash: hashSchema,
  cloudExecutionIdentity: XuanxueAiCloudExecutionIdentitySchema.optional(),
  contractManifestHash: hashSchema.nullable(),
  productContractHash: hashSchema.nullable(),
  localizationRole: XuanxueLocalizationRoleSchema.nullable(),
  providerExecutionProfile: XuanxueStoredProviderExecutionProfileSchema.nullable(),
  frozenSubject: XuanxueAiFrozenSubjectSchema,
  conversationScopeRef: z.string().min(1),
  conversationParent: ConversationParentBindingSchema.nullable(),
  joinParents: z.array(TypedJoinParentBindingSchema).max(32),
  materials: z.array(XuanxueAiStageMaterialSchema).min(1).max(5),
  createdAt: z.string().datetime(),
}).strict();

export type XuanxueAiStoredOrder = z.infer<typeof XuanxueAiStoredProductionOrderSchema>;

export const XuanxueAiProductionOrderSchema = XuanxueAiStoredProductionOrderSchema.superRefine((order, context) => {
  inspectXuanxueContinuationPolicy(order, context);
  inspectXuanxueLocalizationPolicy(order, context);
});

export type XuanxueAiProductId = z.infer<typeof XuanxueAiProductIdSchema>;
export type XuanxueAiStageId = z.infer<typeof XuanxueAiStageIdSchema>;
export type XuanxueAiStageMaterial = z.infer<typeof XuanxueAiStageMaterialSchema>;
export type XuanxueAiProductionOrder = z.infer<typeof XuanxueAiProductionOrderSchema>;

export type XuanxueAiStageStatus =
  | "queued"
  | "running"
  | "waiting_provider"
  | "response_checkpointed"
  | "recovery_pending"
  | "completed"
  | "cancelled"
  | "review_required"
  | "failed";

export type XuanxueAiOrderStatus =
  | "queued"
  | "running"
  | "recovery_pending"
  | "completed"
  | "cancelled"
  | "review_required"
  | "failed";

export const XuanxueAiInterventionRequestSchema = z.object({
  orderId: z.string().min(1).max(200),
  expectedRevision: z.number().int().nonnegative(),
  reason: z.string().min(1).max(1_000),
  requestId: z.string().min(1).max(240),
}).strict();

export type XuanxueAiInterventionRequest = z.infer<typeof XuanxueAiInterventionRequestSchema>;

export type XuanxueAiInterventionState =
  | "running"
  | "pause_requested"
  | "paused"
  | "cancel_requested"
  | "cancelled"
  | "takeover_requested"
  | "taken_over"
  | "recovery_pending"
  | "review_required";

export interface XuanxueAiInterventionRecord {
  readonly orderId: string;
  readonly revision: number;
  readonly state: XuanxueAiInterventionState;
  readonly reason: string | null;
  readonly requestId: string | null;
  readonly pendingRequest: "pause" | "cancel" | "takeover" | null;
  readonly lastControlEpoch: number;
  readonly lastSafeCheckpoint: string | null;
  readonly requestedAt: string | null;
  readonly updatedAt: string;
}

export interface XuanxueAiStageRecord {
  readonly orderId: string;
  readonly stageId: XuanxueAiStageId;
  readonly ordinal: number;
  readonly executionId: string;
  readonly supersededExecutionId?: string | null;
  readonly status: XuanxueAiStageStatus;
  readonly attemptCount: number;
  readonly material: XuanxueAiStageMaterial;
  readonly aiFeedResult: AiFeedResult | null;
  readonly attachmentUploadProof: WebChatAttachmentUploadProof | null;
  readonly rawResponseText: string | null;
  readonly rawOutputHash: string | null;
  readonly progressPhase: AiInputGatewayProgress["phase"] | "queued" | "terminal";
  readonly failureReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface XuanxueAiGeneratedImageArtifact {
  readonly artifactId: string;
  readonly role: "generated_image";
  readonly objectRef: string;
  readonly sha256: `sha256:${string}`;
  readonly originalSha256: `sha256:${string}`;
  readonly providerOutputRef: string;
  readonly mimeType: "image/webp";
  readonly byteCount: number;
  readonly width: 1200;
  readonly height: 630;
  readonly localFilePath?: string;
  readonly checkpointProofRef?: string;
}

export interface XuanxueAiProductionResult {
  readonly orderId: string;
  readonly sourceTaskId: string;
  readonly productId: XuanxueAiProductId;
  readonly inputBundleRef: string;
  readonly inputBundleHash: string;
  readonly requestHash: string;
  readonly contractManifestHash: `sha256:${string}` | null;
  readonly productContractHash: `sha256:${string}` | null;
  readonly localizationRole: z.infer<typeof XuanxueLocalizationRoleSchema> | null;
  readonly status: XuanxueAiOrderStatus;
  readonly finalStageId: XuanxueAiStageId;
  readonly stages: readonly {
    readonly outputKind: "text" | "generated_image";
    readonly stageId: XuanxueAiStageId;
    readonly executionId: string;
    readonly rawResponseText: string;
    readonly rawOutputHash: string;
    readonly providerProof: AiFeedResult["providerProof"];
    readonly transportWarnings: readonly string[];
    readonly artifact?: XuanxueAiGeneratedImageArtifact;
  }[];
  readonly runtimeReceipt?: AgentRuntimeReceiptV6;
  readonly failureReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface XuanxueAiOrderRecord {
  readonly order: XuanxueAiProductionOrder;
  readonly status: XuanxueAiOrderStatus;
  readonly stages: readonly XuanxueAiStageRecord[];
  readonly result: XuanxueAiProductionResult | null;
  readonly failureReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
