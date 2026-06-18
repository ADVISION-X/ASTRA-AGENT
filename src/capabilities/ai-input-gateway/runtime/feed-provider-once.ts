import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";
import type { AiProviderAdapter } from "../contracts/ai-provider-adapter.contract.js";
import type {
  AiFeedInput,
  AiFeedResult,
  AiInputGatewayChildCapabilityId,
} from "../schema.js";
import { buildAiFeedInputPackage, type AiFeedInputPackage } from "./ai-feed-input-package.js";
import { parseAiFeedOutput } from "./ai-feed-output-parser.js";
import {
  buildAiFeedFailure,
  buildAiFeedSuccess,
} from "./ai-feed-proof.js";
import { checkAiFeedRateGuard } from "./ai-feed-rate-guard.js";
import { canContinueAfterWebChatSourceRestoreFailure } from "../providers/web-chat-restore-policy.js";

type ExecuteAiFeedOnceInput = {
  request: AiFeedInput;
  dataDir: string;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  transport: "api" | "web-chat";
  adapter: AiProviderAdapter;
  browser?: BrowserController;
  runtimeLogger?: RuntimeLogger;
  signal?: AbortSignal;
};

const reviewRequiredFromError = (error: unknown): boolean =>
  error instanceof Error && /review_required|login|verification|captcha|security/iu.test(error.message);

const buildRateGuardFailure = (input: {
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  inputPackage: AiFeedInputPackage;
  startedAt: string;
  transport: "api" | "web-chat";
  cooldownMs: number;
  reason: string | null;
}): AiFeedResult => buildAiFeedFailure({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    inputPackage: input.inputPackage,
    startedAt: input.startedAt,
    transport: input.transport,
    status: "review_required",
    reason: input.reason ?? "AI feed rate guard blocked request.",
    cooldownMs: input.cooldownMs,
  });

const buildProviderFailure = (input: {
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  inputPackage: AiFeedInputPackage;
  startedAt: string;
  transport: "api" | "web-chat";
  cooldownMs: number;
  error: unknown;
}): AiFeedResult => buildAiFeedFailure({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    inputPackage: input.inputPackage,
    startedAt: input.startedAt,
    transport: input.transport,
    status: reviewRequiredFromError(input.error) ? "review_required" : "failed",
    reason: input.error instanceof Error ? input.error.message : String(input.error),
    cooldownMs: input.cooldownMs,
  });

const buildRestoreFailure = (input: {
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  inputPackage: AiFeedInputPackage;
  startedAt: string;
  transport: "api" | "web-chat";
  cooldownMs: number;
  response: {
    webChatUrl: string | null;
    sourcePageUrlBeforeFeed: string | null;
    restoredSourcePage: boolean | null;
  };
}): AiFeedResult => buildAiFeedFailure({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    inputPackage: input.inputPackage,
    startedAt: input.startedAt,
    transport: input.transport,
    status: "review_required",
    reason: "review_required: source page restoration failed after web chat feed.",
    cooldownMs: input.cooldownMs,
    response: input.response,
  });

const buildAdapterFeedContext = (input: ExecuteAiFeedOnceInput) => ({
  dataDir: input.dataDir,
  ...(input.browser ? { browser: input.browser } : {}),
  ...(input.runtimeLogger ? { runtimeLogger: input.runtimeLogger } : {}),
  ...(input.signal ? { abortSignal: input.signal } : {}),
});

const executeProviderFeed = (
  input: ExecuteAiFeedOnceInput,
) => input.adapter.feed(input.request, buildAdapterFeedContext(input));

const buildProviderSuccess = async (input: {
  request: AiFeedInput;
  dataDir: string;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  inputPackage: AiFeedInputPackage;
  startedAt: string;
  cooldownMs: number;
  response: Awaited<ReturnType<AiProviderAdapter["feed"]>>;
}): Promise<AiFeedResult> => {
  if (
    input.response.transport === "web-chat"
    && input.response.sourcePageUrlBeforeFeed
    && input.response.restoredSourcePage === false
    && !canContinueAfterWebChatSourceRestoreFailure({ request: input.request })
  ) {
    return buildRestoreFailure({
      request: input.request,
      childCapabilityId: input.childCapabilityId,
      inputPackage: input.inputPackage,
      startedAt: input.startedAt,
      transport: input.response.transport,
      cooldownMs: input.cooldownMs,
      response: input.response,
    });
  }
  return buildAiFeedSuccess({
    dataDir: input.dataDir,
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    inputPackage: input.inputPackage,
    response: input.response,
    parsedOutput: parseAiFeedOutput(input.response.rawText, input.request.expectedOutputSchemaRef),
    startedAt: input.startedAt,
    cooldownMs: input.cooldownMs,
  });
};

export const executeAiFeedOnce = async (
  input: ExecuteAiFeedOnceInput,
): Promise<AiFeedResult> => {
  const startedAt = new Date().toISOString();
  const inputPackage = await buildAiFeedInputPackage(input.request);
  const rate = checkAiFeedRateGuard({
    inputHash: inputPackage.inputHash,
    roundId: input.request.roundId,
    transport: input.transport,
  });
  if (!rate.ok) return buildRateGuardFailure({ ...input, inputPackage, startedAt, ...rate });
  try {
    return await buildProviderSuccess({
      request: input.request,
      dataDir: input.dataDir,
      childCapabilityId: input.childCapabilityId,
      inputPackage,
      startedAt,
      cooldownMs: rate.cooldownMs,
      response: await executeProviderFeed(input),
    });
  } catch (error) {
    return buildProviderFailure({ ...input, inputPackage, startedAt, cooldownMs: rate.cooldownMs, error });
  }
};
