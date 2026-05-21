import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";
import { invokeGemini, loadOnlineAiProviderConfig } from "../../lib/online-ai/index.js";
import type { ProductVideoAiDecision, ProductVideoDomMissionInput } from "./product-video-dom.schema.js";
import {
  ProductVideoJudgeGeminiResponseSchema,
  ProductVideoJudgeOutputSchema,
  type ProductVideoJudgeOutput,
} from "./product-video-judge.contract.js";
import { buildProductVideoJudgePrompt } from "./product-video-judge-prompt.js";

export type ProductVideoDomJudgeResult = {
  aiDecision: ProductVideoAiDecision;
  aiDecisionReason: string;
  judgeOutput: ProductVideoJudgeOutput | null;
};

const outputToDecision = (output: ProductVideoJudgeOutput): ProductVideoDomJudgeResult => {
  if (output.nextDomAction === "review_required") {
    return {
      aiDecision: "review_required",
      aiDecisionReason: output.rejectReason ?? "Product-video judge requested review.",
      judgeOutput: output,
    };
  }
  return {
    aiDecision: output.isProductSeedingVideo ? "product_seed" : "not_product_seed",
    aiDecisionReason: output.isProductSeedingVideo
      ? output.seedingEvidence.join("; ") || "AI judged this video as product seeding."
      : output.rejectReason ?? "AI judged this video is not product seeding.",
    judgeOutput: output,
  };
};

export const judgeProductVideoFromDomFacts = async (input: {
  dataDir: string;
  mission: ProductVideoDomMissionInput;
  snapshot: DomSnapshot;
}): Promise<ProductVideoDomJudgeResult> => {
  if (input.mission.aiDecision) {
    return {
      aiDecision: input.mission.aiDecision,
      aiDecisionReason: input.mission.aiDecisionReason ?? "Decision supplied by approved mission payload.",
      judgeOutput: null,
    };
  }
  const config = await loadOnlineAiProviderConfig(input.dataDir);
  const result = await invokeGemini({
    config,
    promptText: buildProductVideoJudgePrompt(input),
    imagePaths: [],
    timeoutMs: 20_000,
    responseSchema: ProductVideoJudgeGeminiResponseSchema,
  });
  return outputToDecision(ProductVideoJudgeOutputSchema.parse(JSON.parse(result.rawText)));
};
