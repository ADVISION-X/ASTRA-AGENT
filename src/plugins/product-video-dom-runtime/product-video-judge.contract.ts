import {
  ProductVideoJudgeOutputSchema,
  type ProductVideoJudgeOutput,
} from "./product-video-dom.schema.js";

export const PRODUCT_VIDEO_JUDGE_PROMPT_CONTRACT_ID = "product-video-judge-v1" as const;

export const ProductVideoJudgeGeminiResponseSchema = {
  type: "OBJECT",
  properties: {
    schemaVersion: { type: "STRING", enum: ["productVideoJudge.v1"] },
    isProductSeedingVideo: { type: "BOOLEAN" },
    confidence: { type: "NUMBER" },
    productCategoryHint: { type: "STRING", nullable: true },
    productNameHint: { type: "STRING", nullable: true },
    productEvidence: { type: "ARRAY", items: { type: "STRING" } },
    seedingEvidence: { type: "ARRAY", items: { type: "STRING" } },
    commentEvidence: { type: "ARRAY", items: { type: "STRING" } },
    rejectReason: { type: "STRING", nullable: true },
    shouldSave: { type: "BOOLEAN" },
    shouldCollectComments: { type: "BOOLEAN" },
    shouldVisualVerify: { type: "BOOLEAN" },
    nextDomAction: { type: "STRING", enum: ["collect_evidence", "next_video", "review_required"] },
  },
  required: [
    "schemaVersion",
    "isProductSeedingVideo",
    "confidence",
    "productCategoryHint",
    "productNameHint",
    "productEvidence",
    "seedingEvidence",
    "commentEvidence",
    "rejectReason",
    "shouldSave",
    "shouldCollectComments",
    "shouldVisualVerify",
    "nextDomAction",
  ],
} as const;

export { ProductVideoJudgeOutputSchema, type ProductVideoJudgeOutput };
