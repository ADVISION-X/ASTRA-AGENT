import {
  invokeGemini,
  loadOnlineAiProviderConfig,
} from "../../../lib/online-ai/index.js";
import type {
  AiProviderAdapter,
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { buildAiFeedInputPackage } from "../runtime/ai-feed-input-package.js";

const estimateTokens = (text: string): number =>
  Math.ceil(text.length / 4);

export const geminiApiAdapter: AiProviderAdapter = {
  providerKind: "gemini-api",

  async feed(
    input: AiFeedInput,
    context: AiProviderAdapterContext,
  ): Promise<AiProviderRawResponse> {
    const config = await loadOnlineAiProviderConfig(context.dataDir);
    const inputPackage = await buildAiFeedInputPackage(input);
    const result = await invokeGemini({
      config,
      promptText: input.textPrompt,
      imagePaths: inputPackage.imagePaths,
      timeoutMs: input.timeoutMs,
      ...(input.missionId ? { missionId: input.missionId } : {}),
      ...(input.roundId ? { roundId: input.roundId } : {}),
      ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
    });
    return {
      rawText: result.rawText,
      modelName: result.modelName,
      runtimeName: result.runtimeName,
      transport: "api",
      webChatUrl: null,
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
      estimatedInputTokens: estimateTokens(input.textPrompt),
      estimatedOutputTokens: estimateTokens(result.rawText),
      tokenEstimateUnavailableReason: null,
    };
  },
};
