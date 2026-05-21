import { z } from "zod";

export const PRODUCT_VIDEO_JUDGE_PROMPT_CONTRACT_ID = "product-video-judge-v1" as const;

export const ProductVideoJudgeOutputSchema = z.object({
  schemaVersion: z.literal("productVideoJudge.v1"),
  isProductSeedingVideo: z.boolean(),
  confidence: z.number().min(0).max(1),
  productCategoryHint: z.string().min(1).nullable(),
  productEvidence: z.array(z.string().min(1)).max(12),
  seedingEvidence: z.array(z.string().min(1)).max(12),
  rejectReason: z.string().min(1).nullable(),
  shouldCollectDomEvidence: z.boolean(),
  shouldOpenComments: z.boolean(),
  shouldVisualVerify: z.boolean(),
  nextDomAction: z.enum(["collect_evidence", "next_video", "review_required"]),
}).strict();

export type ProductVideoJudgeOutput = z.infer<typeof ProductVideoJudgeOutputSchema>;

export const ProductVideoJudgeGeminiResponseSchema = {
  type: "OBJECT",
  properties: {
    schemaVersion: { type: "STRING", enum: ["productVideoJudge.v1"] },
    isProductSeedingVideo: { type: "BOOLEAN" },
    confidence: { type: "NUMBER" },
    productCategoryHint: { type: "STRING", nullable: true },
    productEvidence: { type: "ARRAY", items: { type: "STRING" } },
    seedingEvidence: { type: "ARRAY", items: { type: "STRING" } },
    rejectReason: { type: "STRING", nullable: true },
    shouldCollectDomEvidence: { type: "BOOLEAN" },
    shouldOpenComments: { type: "BOOLEAN" },
    shouldVisualVerify: { type: "BOOLEAN" },
    nextDomAction: { type: "STRING", enum: ["collect_evidence", "next_video", "review_required"] },
  },
  required: [
    "schemaVersion",
    "isProductSeedingVideo",
    "confidence",
    "productCategoryHint",
    "productEvidence",
    "seedingEvidence",
    "rejectReason",
    "shouldCollectDomEvidence",
    "shouldOpenComments",
    "shouldVisualVerify",
    "nextDomAction",
  ],
} as const;
