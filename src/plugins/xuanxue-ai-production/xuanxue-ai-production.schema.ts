import { z } from "zod";

import type {
  AiFeedResult,
  AiInputGatewayProgress,
} from "../../capabilities/ai-input-gateway/index.js";

export const XUANXUE_AI_PRODUCTION_JOB_ID =
  "xuanxue-ai-production" as const;

export const XuanxueAiProductIdSchema = z.enum([
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
]);

export const XuanxueAiStageIdSchema = z.enum([
  "base_interpretation",
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

export const XuanxueAiStageMaterialSchema = z.object({
  stageId: XuanxueAiStageIdSchema,
  promptPackageId: z.string().min(1).max(240),
  promptContractId: z.string().min(1).max(240),
  expectedOutputSchemaRef: z.string().min(1).max(240).nullable(),
  textPrompt: z.string().min(1),
  inputRefs: z.array(XuanxueAiMaterialRefSchema),
  timeoutMs: z.number().int().min(60_000).max(3_600_000).default(3_600_000),
  maxInputChars: z.number().int().min(1).max(500_000).default(120_000),
  maxFileCount: z.number().int().min(0).max(64).default(32),
  maxFileBytes: z.number().int().min(1).max(1_000_000_000).default(500_000_000),
}).strict();

export const xuanxueAiPaidFollowupProfiles = {
  bazi_report_followup: {
    productId: "bazi_ai_full_analysis",
    stageId: "question_analysis",
  },
  qimen_report_followup: {
    productId: "qimen_professional_answer",
    stageId: "analysis",
  },
  hehun_report_followup: {
    productId: "hehun_ai_analysis",
    stageId: "final_compatibility",
  },
} as const;

export const xuanxueAiReusableBaseConsumerProfiles = {
  bazi_ai_full_analysis: {
    productId: "bazi_canonical_base_interpretation",
    stageId: "base_interpretation",
  },
  naming_bazi_analysis_and_naming: {
    productId: "bazi_canonical_base_interpretation",
    stageId: "base_interpretation",
  },
} as const;

export const xuanxueAiRequiredContinuationProfiles = {
  ...xuanxueAiPaidFollowupProfiles,
  ...xuanxueAiReusableBaseConsumerProfiles,
} as const;

export type XuanxueAiPaidFollowupProductId =
  keyof typeof xuanxueAiPaidFollowupProfiles;

export type XuanxueAiRequiredContinuationProductId =
  keyof typeof xuanxueAiRequiredContinuationProfiles;

export const isXuanxueAiPaidFollowupProduct = (
  productId: z.infer<typeof XuanxueAiProductIdSchema>,
): productId is XuanxueAiPaidFollowupProductId =>
  Object.hasOwn(xuanxueAiPaidFollowupProfiles, productId);

export const isXuanxueAiRequiredContinuationProduct = (
  productId: z.infer<typeof XuanxueAiProductIdSchema>,
): productId is XuanxueAiRequiredContinuationProductId =>
  Object.hasOwn(xuanxueAiRequiredContinuationProfiles, productId);

export const XuanxueAiStoredProductionOrderSchema = z.object({
  protocolVersion: z.literal("xuanxue-ai-production-v1"),
  orderId: z.string().min(1).max(200),
  sourceProject: z.literal("xuanxue-web"),
  sourceTaskId: z.string().min(1).max(240),
  productId: XuanxueAiProductIdSchema,
  inputBundleRef: z.string().min(1).max(500),
  inputBundleHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  requestHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  continuationParent: z.object({
    jobId: z.string().min(1).max(200),
    stageId: XuanxueAiStageIdSchema,
    rawOutputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  }).strict().nullable().default(null),
  seededStages: z.array(z.object({
    stageId: XuanxueAiStageIdSchema,
    executionId: z.string().min(1),
    rawResponseText: z.string(),
    rawOutputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    providerProof: z.record(z.string(), z.unknown()),
    transportWarnings: z.array(z.string()),
  }).strict()).max(4).default([]),
  materials: z.array(XuanxueAiStageMaterialSchema).min(1).max(4),
  createdAt: z.string().datetime(),
}).strict();

export const XuanxueAiProductionOrderSchema =
XuanxueAiStoredProductionOrderSchema.superRefine((order, context) => {
  const continuationRequired =
    order.productId === "manual_accuracy_challenge"
    || isXuanxueAiRequiredContinuationProduct(order.productId);
  if (continuationRequired !== Boolean(order.continuationParent)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_CONTINUATION_PROFILE_INVALID",
      path: ["continuationParent"],
    });
  }
  if (
    isXuanxueAiRequiredContinuationProduct(order.productId)
    && order.continuationParent?.stageId
      !== xuanxueAiRequiredContinuationProfiles[order.productId].stageId
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_CONTINUATION_STAGE_INVALID",
      path: ["continuationParent", "stageId"],
    });
  }
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
  readonly rawResponseText: string | null;
  readonly rawOutputHash: string | null;
  readonly progressPhase: AiInputGatewayProgress["phase"] | "queued" | "terminal";
  readonly failureReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
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
    readonly stageId: XuanxueAiStageId;
    readonly executionId: string;
    readonly rawResponseText: string;
    readonly rawOutputHash: string;
    readonly providerProof: AiFeedResult["providerProof"];
    readonly transportWarnings: readonly string[];
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
