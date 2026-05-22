import { createHash } from "node:crypto";

import type { AiFeedInput, AiFeedResult, AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import {
  FacebookProductVideoMiningSchemas,
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";

type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];

const buildAiFeedInputHash = (input: {
  prompt: string;
  videoFilePath: string;
}): string => createHash("sha256")
    .update(input.prompt)
    .update("\n")
    .update(input.videoFilePath)
    .digest("hex");

const buildTimedOutAiJudgment = (input: {
  providerKind: FacebookVideoAiJudgment["providerKind"];
  prompt: string;
  videoFilePath: string;
  startedAt: string;
  timeoutMs: number;
}): FacebookVideoAiJudgment => {
  const endedAt = new Date().toISOString();
  return FacebookProductVideoMiningSchemas.FacebookVideoAiJudgmentSchema.parse({
    providerKind: input.providerKind,
    status: "review_required",
    selectedOptionId: "UNCERTAIN",
    confidence: 0,
    visibleProduct: null,
    productCategory: null,
    sellingIntentSignals: [],
    evidenceFromVideo: [],
    reason: `ai_feed_timeout_after_${input.timeoutMs}ms`,
    rawOutputRef: null,
    rawOutputHash: null,
    normalizedText: null,
    parseStatus: "not_requested",
    schemaValidationStatus: "not_applicable",
    providerProof: {
      providerKind: input.providerKind,
      webChatUrl: null,
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
      startedAt: input.startedAt,
      endedAt,
      durationMs: Math.max(0, Date.parse(endedAt) - Date.parse(input.startedAt)),
      inputHash: buildAiFeedInputHash({ prompt: input.prompt, videoFilePath: input.videoFilePath }),
      outputHash: null,
    },
    createdAt: endedAt,
  });
};

export const executeFacebookAiFeedWithHardTimeout = async (input: {
  aiInputGateway: AiInputGatewayAbilityGroup;
  request: AiFeedInput;
  providerKind: FacebookVideoAiJudgment["providerKind"];
  prompt: string;
  videoFilePath: string;
  timeoutMs: number;
  resolveFeedResult: (feedResult: AiFeedResult) => FacebookVideoAiJudgment;
}): Promise<FacebookVideoAiJudgment> => {
  const startedAt = new Date().toISOString();
  const abortController = new AbortController();
  const feedPromise = input.aiInputGateway.execute(input.request, { signal: abortController.signal })
    .then(input.resolveFeedResult);
  void feedPromise.catch(() => undefined);
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<FacebookVideoAiJudgment>((resolve) => {
    timeout = setTimeout(() => {
      abortController.abort(`AI feed timed out after ${input.timeoutMs}ms.`);
      resolve(buildTimedOutAiJudgment({ ...input, startedAt }));
    }, input.timeoutMs);
  });
  try {
    return await Promise.race([feedPromise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};
