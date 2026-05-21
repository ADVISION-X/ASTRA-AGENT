import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";
import { invokeGemini, loadOnlineAiProviderConfig } from "../../lib/online-ai/index.js";
import type {
  ProductVideoAiDecision,
  ProductVideoDomMissionInput,
  ProductVideoJudgeInput,
} from "./product-video-dom.schema.js";
import {
  ProductVideoJudgeGeminiResponseSchema,
  ProductVideoJudgeOutputSchema,
  type ProductVideoJudgeOutput,
} from "./product-video-judge.contract.js";
import { buildProductVideoJudgePrompt } from "./product-video-judge-prompt.js";
import {
  extractExternalLinkVisible,
  extractProductLinkVisible,
  extractProductVideoEngagement,
  extractProductVideoVisitId,
  extractShopEntryVisible,
} from "./product-video-dom-extractor.js";
import { sampleProductVideoComments } from "./product-video-comment-extractor.js";
import {
  extractProductVideoAuthor,
  extractProductVideoDescription,
  extractProductVideoHashtags,
  extractProductVideoTitle,
  extractVisibleTextSample,
} from "./product-video-dom-text.js";

export type ProductVideoDomJudgeResult = {
  status: "ok" | "invalid";
  aiDecision: ProductVideoAiDecision;
  aiDecisionReason: string;
  judgeOutput: ProductVideoJudgeOutput | null;
};

export type ProductVideoJudgeExecutor = (
  input: ProductVideoJudgeInput,
) => Promise<ProductVideoJudgeOutput>;

const outputToDecision = (output: ProductVideoJudgeOutput): ProductVideoDomJudgeResult => {
  if (output.nextDomAction === "review_required") {
    return {
      status: "ok",
      aiDecision: "review_required",
      aiDecisionReason: output.rejectReason ?? "Product-video judge requested review.",
      judgeOutput: output,
    };
  }
  return {
    status: "ok",
    aiDecision: output.isProductSeedingVideo ? "product_seed" : "not_product_seed",
    aiDecisionReason: output.isProductSeedingVideo
      ? output.seedingEvidence.join("; ") || "AI judged this video as product seeding."
      : output.rejectReason ?? "AI judged this video is not product seeding.",
    judgeOutput: output,
  };
};

const buildProductSeedOverrideOutput = (aiDecisionReason: string): ProductVideoJudgeOutput =>
  ProductVideoJudgeOutputSchema.parse({
    schemaVersion: "productVideoJudge.v1",
    isProductSeedingVideo: true,
    confidence: 0.99,
    productCategoryHint: "fixture-product",
    productNameHint: null,
    productEvidence: [aiDecisionReason],
    seedingEvidence: [aiDecisionReason],
    commentEvidence: [],
    rejectReason: null,
    shouldSave: true,
    shouldCollectComments: true,
    shouldVisualVerify: false,
    nextDomAction: "collect_evidence",
  });

const buildReviewOverrideOutput = (aiDecisionReason: string): ProductVideoJudgeOutput =>
  ProductVideoJudgeOutputSchema.parse({
    schemaVersion: "productVideoJudge.v1",
    isProductSeedingVideo: false,
    confidence: 0.25,
    productCategoryHint: null,
    productNameHint: null,
    productEvidence: [],
    seedingEvidence: [],
    commentEvidence: [],
    rejectReason: aiDecisionReason,
    shouldSave: false,
    shouldCollectComments: false,
    shouldVisualVerify: false,
    nextDomAction: "review_required",
  });

const buildNextVideoOverrideOutput = (aiDecisionReason: string): ProductVideoJudgeOutput =>
  ProductVideoJudgeOutputSchema.parse({
    schemaVersion: "productVideoJudge.v1",
    isProductSeedingVideo: false,
    confidence: 0.99,
    productCategoryHint: null,
    productNameHint: null,
    productEvidence: [],
    seedingEvidence: [],
    commentEvidence: [],
    rejectReason: aiDecisionReason,
    shouldSave: false,
    shouldCollectComments: false,
    shouldVisualVerify: false,
    nextDomAction: "next_video",
  });

const createOverrideOutput = (
  aiDecision: ProductVideoAiDecision,
  aiDecisionReason: string,
): ProductVideoJudgeOutput => aiDecision === "product_seed"
  ? buildProductSeedOverrideOutput(aiDecisionReason)
  : aiDecision === "review_required"
    ? buildReviewOverrideOutput(aiDecisionReason)
    : buildNextVideoOverrideOutput(aiDecisionReason);

const buildJudgeInput = (input: {
  mission: ProductVideoDomMissionInput;
  snapshot: DomSnapshot;
  screenshotRef?: string | null;
  userRequirementText?: string;
}): ProductVideoJudgeInput => {
  const engagement = extractProductVideoEngagement(input.snapshot);
  return {
    schemaVersion: "productVideoJudge.input.v1",
    platformId: input.mission.platformId,
    pageUrl: input.snapshot.url,
    videoVisitId: extractProductVideoVisitId(input.snapshot),
    pageTitle: input.snapshot.title || null,
    titleText: extractProductVideoTitle(input.snapshot) ?? null,
    descriptionText: extractProductVideoDescription(input.snapshot) ?? null,
    authorText: extractProductVideoAuthor(input.snapshot) ?? null,
    hashtags: extractProductVideoHashtags(input.snapshot),
    likesText: engagement.likesText ?? null,
    commentsText: engagement.commentsText ?? null,
    sharesText: engagement.sharesText ?? null,
    productLinkVisible: extractProductLinkVisible(input.snapshot),
    shopEntryVisible: extractShopEntryVisible(input.snapshot),
    externalLinkVisible: extractExternalLinkVisible(input.snapshot),
    visibleTextSample: extractVisibleTextSample(input.snapshot),
    sampledComments: sampleProductVideoComments(input.snapshot),
    screenshotRef: input.screenshotRef ?? null,
    userRequirementText: input.userRequirementText ?? input.mission.aiDecisionReason ?? "Find product-seeding videos.",
  };
};

const callRealJudge = async (input: {
  dataDir: string;
  judgeInput: ProductVideoJudgeInput;
}): Promise<ProductVideoJudgeOutput> => {
  const config = await loadOnlineAiProviderConfig(input.dataDir);
  const result = await invokeGemini({
    config,
    promptText: buildProductVideoJudgePrompt(input.judgeInput),
    imagePaths: [],
    timeoutMs: 20_000,
    responseSchema: ProductVideoJudgeGeminiResponseSchema,
  });
  return ProductVideoJudgeOutputSchema.parse(JSON.parse(result.rawText));
};

export const judgeProductVideoFromDomFacts = async (input: {
  dataDir: string;
  mission: ProductVideoDomMissionInput;
  snapshot: DomSnapshot;
  screenshotRef?: string | null;
  userRequirementText?: string;
  judgeOverride?: ProductVideoJudgeExecutor;
}): Promise<ProductVideoDomJudgeResult> => {
  if (input.mission.aiDecision) {
    return outputToDecision(
      createOverrideOutput(
        input.mission.aiDecision,
        input.mission.aiDecisionReason ?? "Decision supplied by approved mission payload.",
      ),
    );
  }
  const judgeInput = buildJudgeInput(input);
  try {
    const output = input.judgeOverride
      ? await input.judgeOverride(judgeInput)
      : await callRealJudge({ dataDir: input.dataDir, judgeInput });
    return outputToDecision(output);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      status: "invalid",
      aiDecision: "not_product_seed",
      aiDecisionReason: `skip_ai_invalid: ${reason}`,
      judgeOutput: null,
    };
  }
};
