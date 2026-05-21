import type { AiProviderAdapter } from "../contracts/ai-provider-adapter.contract.js";
import { geminiApiAdapter } from "../providers/gemini-api.adapter.js";
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

export const feedGeminiApiOnce = async (input: {
  request: AiFeedInput;
  dataDir: string;
  adapter?: AiProviderAdapter;
  signal?: AbortSignal;
}): Promise<AiFeedResult> => {
  const startedAt = new Date().toISOString();
  const inputPackage = await buildAiFeedInputPackage(input.request);
  const rate = checkAiFeedRateGuard({
    inputHash: inputPackage.inputHash,
    roundId: input.request.roundId,
    transport: "api",
  });
  if (!rate.ok) {
    return buildAiFeedFailure({
      request: input.request,
      childCapabilityId: "feed-gemini-api-once",
      inputPackage,
      startedAt,
      transport: "api",
      status: "review_required",
      reason: rate.reason ?? "AI feed rate guard blocked request.",
      cooldownMs: rate.cooldownMs,
    });
  }
  try {
    const response = await (input.adapter ?? geminiApiAdapter).feed(input.request, {
      dataDir: input.dataDir,
      ...(input.signal ? { abortSignal: input.signal } : {}),
    });
    const parsedOutput = parseAiFeedOutput(response.rawText, input.request.expectedOutputSchemaRef);
    return buildAiFeedSuccess({
      dataDir: input.dataDir,
      request: input.request,
      childCapabilityId: "feed-gemini-api-once",
      inputPackage,
      response,
      parsedOutput,
      startedAt,
      cooldownMs: rate.cooldownMs,
    });
  } catch (error) {
    return buildAiFeedFailure({
      request: input.request,
      childCapabilityId: "feed-gemini-api-once",
      inputPackage,
      startedAt,
      transport: "api",
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
      cooldownMs: rate.cooldownMs,
    });
  }
};
