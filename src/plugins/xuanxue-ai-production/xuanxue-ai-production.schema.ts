import { z } from "zod";

import type {
  AiFeedResult,
  AiInputGatewayProgress,
  WebChatAttachmentUploadProof,
} from "../../capabilities/ai-input-gateway/index.js";
import {
  isXuanxueAiPaidFollowupProduct,
  isXuanxueAiRequiredContinuationProduct,
  isXuanxueAiReusableBaseConsumerProduct,
  xuanxueAiRequiredContinuationProfiles,
} from "./xuanxue-ai-production-conversation-policy.js";

export const XUANXUE_AI_PRODUCTION_JOB_ID =
  "xuanxue-ai-production" as const;

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
  "localization_static_review",
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
  "localization_candidate_a",
  "localization_candidate_b",
  "localization_selector_first",
  "localization_selector_swap",
  "localization_consistency",
  "scheduled_quality_reflection",
]);

const XuanxueAiMaterialRefSchema = z.object({
  id: z.string().min(1).max(240),
  kind: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  filePath: z.string().min(1),
  fileName: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(160),
  sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  byteCount: z.number().int().nonnegative(),
}).strict();

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

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
  expectedOutputKind: z.enum(["text", "generated_image"]).default("text"),
  textPrompt: z.string().min(1),
  inputRefs: z.array(XuanxueAiMaterialRefSchema),
  timeoutMs: z.number().int().min(60_000).max(3_600_000).default(3_600_000),
  maxFileCount: z.number().int().min(0).max(64).default(32),
}).strict();

export const XuanxueAiStoredProductionOrderSchema = z.object({
  protocolVersion: z.literal("xuanxue-ai-production-v4"),
  orderId: z.string().min(1).max(200),
  sourceProject: z.literal("xuanxue-web"),
  sourceTaskId: z.string().min(1).max(240),
  productId: XuanxueAiProductIdSchema,
  serviceClass: z.enum(["user_delivery", "public_content", "quality_background", "localization"]),
  triggerKind: z.enum(["user_request", "manual_accuracy_challenge", "scheduled_public_content", "scheduled_quality_reflection", "localization_static_review"]),
  lineageId: z.string().min(1).nullable(),
  reflectionSnapshotRef: z.string().min(1).nullable(),
  reflectionPlanId: z.string().min(1).nullable(),
  inputBundleRef: z.string().min(1).max(500),
  inputBundleHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  requestHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  frozenSubject: XuanxueAiFrozenSubjectSchema,
  conversationScopeRef: z.string().min(1),
  conversationParent: ConversationParentBindingSchema.nullable(),
  joinParents: z.array(TypedJoinParentBindingSchema).max(32),
  seededStages: z.array(z.object({
    stageId: XuanxueAiStageIdSchema,
    executionId: z.string().min(1),
    rawResponseText: z.string(),
    rawOutputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    providerProof: z.record(z.string(), z.unknown()),
    transportWarnings: z.array(z.string()),
  }).strict()).max(5).default([]),
  materials: z.array(XuanxueAiStageMaterialSchema).min(1).max(5),
  createdAt: z.string().datetime(),
}).strict();

type XuanxueAiStoredOrder = z.infer<typeof XuanxueAiStoredProductionOrderSchema>;

const inspectContinuationPolicy = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  const continuationRequired =
    order.productId === "manual_accuracy_challenge"
    || isXuanxueAiRequiredContinuationProduct(order.productId);
  if (continuationRequired !== Boolean(order.conversationParent)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_CONTINUATION_PROFILE_INVALID",
      path: ["conversationParent"],
    });
  }
  if (
    isXuanxueAiRequiredContinuationProduct(order.productId)
    && order.productId !== "bazi_report_followup"
    && order.conversationParent?.stageId
      !== xuanxueAiRequiredContinuationProfiles[order.productId].stageId
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_CONTINUATION_STAGE_INVALID",
      path: ["conversationParent", "stageId"],
    });
  }
  if (
    order.productId === "bazi_report_followup"
    && order.conversationParent
    && !["chart_interpretation", "question_analysis"].includes(
      order.conversationParent.stageId,
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_CONTINUATION_STAGE_INVALID",
      path: ["conversationParent", "stageId"],
    });
  }
  if (
    isXuanxueAiReusableBaseConsumerProduct(order.productId)
    && order.conversationParent?.relation !== "forked_from_checkpoint"
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_FORK_PARENT_REQUIRED",
      path: ["conversationParent", "relation"],
    });
  }
  if (
    isXuanxueAiPaidFollowupProduct(order.productId)
    && order.conversationParent?.relation !== "same_conversation"
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_SAME_CONVERSATION_PARENT_REQUIRED",
      path: ["conversationParent", "relation"],
    });
  }
};

const inspectLocalizationSubjectPolicy = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  const isLocalizationProduct = order.productId === "localization_static_review";
  if (isLocalizationProduct) {
    if (order.frozenSubject.primaryPersonRef !== null
      || order.frozenSubject.participants.length !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "XUANXUE_AI_PRODUCTION_LOCALIZATION_SUBJECT_MUST_BE_CONTEXT_ONLY",
        path: ["frozenSubject"],
      });
    }
    if (order.frozenSubject.privacyOwnerRef !== "localization-catalog") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "XUANXUE_AI_PRODUCTION_LOCALIZATION_OWNER_INVALID",
        path: ["frozenSubject", "privacyOwnerRef"],
      });
    }
    if (order.conversationParent !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "XUANXUE_AI_PRODUCTION_LOCALIZATION_PARENT_FORBIDDEN",
        path: ["conversationParent"],
      });
    }
  } else if (order.frozenSubject.participants.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_FROZEN_SUBJECT_PARTICIPANT_REQUIRED",
      path: ["frozenSubject", "participants"],
    });
  }
};

export const XuanxueAiProductionOrderSchema =
XuanxueAiStoredProductionOrderSchema.superRefine((order, context) => {
  inspectContinuationPolicy(order, context);
  inspectLocalizationSubjectPolicy(order, context);
});

export type XuanxueAiProductId = z.infer<typeof XuanxueAiProductIdSchema>;
export type XuanxueAiStageId = z.infer<typeof XuanxueAiStageIdSchema>;
export type XuanxueAiStageMaterial =
  z.infer<typeof XuanxueAiStageMaterialSchema>;
export type XuanxueAiProductionOrder =
  z.infer<typeof XuanxueAiProductionOrderSchema>;

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

export type XuanxueAiInterventionRequest = z.infer<
  typeof XuanxueAiInterventionRequestSchema
>;

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

export interface XuanxueAiGeneratedImageArtifact {
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
  /** Local-only path. The cloud worker strips it before publishing. */
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
