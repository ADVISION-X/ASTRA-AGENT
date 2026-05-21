import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapter } from "../contracts/ai-provider-adapter.contract.js";
import { gptWebChatAdapter } from "../providers/gpt-web-chat.adapter.js";
import type {
  AiFeedInput,
  AiFeedResult,
} from "../schema.js";
import { buildAiFeedInputPackage } from "./ai-feed-input-package.js";
import { parseAiFeedOutput } from "./ai-feed-output-parser.js";
import {
  buildAiFeedFailure,
  buildAiFeedSuccess,
} from "./ai-feed-proof.js";
import { checkAiFeedRateGuard } from "./ai-feed-rate-guard.js";

const isReviewRequiredError = (error: unknown): boolean =>
  error instanceof Error && /review_required|login|verification|captcha|security/iu.test(error.message);

export const feedGptWebChatOnce = async (input: {
  request: AiFeedInput;
  dataDir: string;
  browser?: BrowserController;
  adapter?: AiProviderAdapter;
  signal?: AbortSignal;
}): Promise<AiFeedResult> => {
  const startedAt = new Date().toISOString();
  const inputPackage = await buildAiFeedInputPackage(input.request);
  const rate = checkAiFeedRateGuard({
    inputHash: inputPackage.inputHash,
    roundId: input.request.roundId,
    transport: "web-chat",
  });
  if (!rate.ok) {
    return buildAiFeedFailure({
      request: input.request,
      childCapabilityId: "feed-gpt-web-chat-once",
      inputPackage,
      startedAt,
      transport: "web-chat",
      status: "review_required",
      reason: rate.reason ?? "AI feed rate guard blocked request.",
      cooldownMs: rate.cooldownMs,
    });
  }
  try {
    const response = await (input.adapter ?? gptWebChatAdapter).feed(input.request, {
      dataDir: input.dataDir,
      ...(input.browser ? { browser: input.browser } : {}),
      ...(input.signal ? { abortSignal: input.signal } : {}),
    });
    const parsedOutput = parseAiFeedOutput(response.rawText, input.request.expectedOutputSchemaRef);
    return buildAiFeedSuccess({
      dataDir: input.dataDir,
      request: input.request,
      childCapabilityId: "feed-gpt-web-chat-once",
      inputPackage,
      response,
      parsedOutput,
      startedAt,
      cooldownMs: rate.cooldownMs,
    });
  } catch (error) {
    return buildAiFeedFailure({
      request: input.request,
      childCapabilityId: "feed-gpt-web-chat-once",
      inputPackage,
      startedAt,
      transport: "web-chat",
      status: isReviewRequiredError(error) ? "review_required" : "failed",
      reason: error instanceof Error ? error.message : String(error),
      cooldownMs: rate.cooldownMs,
    });
  }
};
