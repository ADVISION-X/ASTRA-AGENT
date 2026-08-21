import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext, WebChatForkActionProof } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { openGovernedContinuation } from "./web-chat-continuation.js";
import { openGovernedForkFromCheckpoint } from "./web-chat-fork.js";
import { startFreshChatGptConversation } from "./web-chat-fresh-conversation.js";
import { emitSubmitStage } from "./web-chat-submit-stage-log.js";

const CHATGPT_COMPOSER_SELECTOR = "#prompt-textarea";
const AMAZON_PRODUCT_MINING_PROMPT_CONTRACT_PREFIX = "amazon-product-mining-" as const;

export const isAmazonProductMiningGptRequest = (input: {
  providerUrl: string;
  request: AiFeedInput;
}): boolean => new URL(input.providerUrl).host === "chatgpt.com"
  && input.request.promptContractId.startsWith(AMAZON_PRODUCT_MINING_PROMPT_CONTRACT_PREFIX);

type ProviderPageInput = Readonly<{
  browser: BrowserTargetLease;
  providerUrl: string;
  runtimeName: string;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
}>;

const waitForProviderComposer = async (input: {
  browser: BrowserTargetLease;
  request: AiFeedInput;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
}): Promise<void> => {
  if (input.request.providerKind !== "gpt-web-chat") {
    throw new Error("review_required: NOT_PRODUCTION_VERIFIED: Gemini composer DOM is not observed");
  }
  const deadline = Date.now() + Math.min(input.timeoutMs ?? 60_000, 60_000);
  while (Date.now() < deadline) {
    if (input.abortSignal?.aborted) throw new Error("review_required: provider composer wait aborted");
    const inspection = await input.browser.executeDomIntent({
      kind: "inspect",
      selector: CHATGPT_COMPOSER_SELECTOR,
      fields: ["tagName", "visible", "disabled"],
    }).catch(() => null);
    if (inspection && typeof inspection === "object" && !Array.isArray(inspection)) {
      const value = inspection as Record<string, unknown>;
      if (value.tagName === "DIV" && value.visible === true && value.disabled !== true) return;
    }
    await input.browser.wait({ durationMs: 250 });
  }
  throw new Error("review_required: provider composer did not become ready");
};

const requiresFreshChatGptConversation = (input: ProviderPageInput): boolean =>
  !input.request.providerContinuationRef && !input.request.providerForkRef
  && input.request.providerKind === "gpt-web-chat"
  && new URL(input.providerUrl).origin === "https://chatgpt.com";

export const openProviderPage = async (
  input: ProviderPageInput,
): Promise<WebChatForkActionProof | null> => {
  if (input.request.providerForkRef) {
    const proof = await openGovernedForkFromCheckpoint({
      request: input.request,
    });
    await input.context.webChatExecution?.onForkActionObserved(proof);
    return proof;
  }
  if (input.request.providerContinuationRef) {
    await openGovernedContinuation({
      ...input,
      waitForComposer: () => waitForProviderComposer({
        browser: input.browser,
        request: input.request,
        ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
      }),
    });
    return null;
  }
  await startFreshChatGptConversation({
    browser: input.browser,
    context: input.context,
    request: input.request,
    providerUrl: input.providerUrl,
    required: requiresFreshChatGptConversation(input),
    waitForProviderComposer: () => waitForProviderComposer({
      browser: input.browser,
      request: input.request,
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    }),
    isRecoverableComposerTimeout: () => false,
    emitStage: (stage) => emitSubmitStage({ request: input.request }, stage.stage, stage.status, stage.startedAtMs, stage.refs),
  });
  await waitForProviderComposer({
    browser: input.browser,
    request: input.request,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  return null;
};
