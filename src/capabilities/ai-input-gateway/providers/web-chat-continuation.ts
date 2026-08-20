import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { focusChatGptConversationByCanonicalPath } from "../runtime/web-chat-single-tab-routing.js";

type ContinuationInput = Readonly<{
  browser: BrowserTargetLease;
  runtimeName: string;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  waitForComposer: () => Promise<void>;
}>;

const governedContinuationUrl = (request: AiFeedInput): URL => {
  const continuation = request.providerContinuationRef;
  if (!continuation) throw new Error("review_required: provider continuation reference is missing");
  const url = new URL(continuation.providerPageUrl);
  if (request.providerKind !== "gpt-web-chat"
    || url.protocol !== "https:"
    || url.host !== "chatgpt.com"
    || !/^\/c\/(?!WEB:)[^/]+$/u.test(url.pathname)) {
    throw new Error("review_required: provider continuation URL is not a governed ChatGPT conversation URL");
  }
  return url;
};

const documentUrl = async (browser: BrowserTargetLease): Promise<URL> => {
  const observation = await browser.executeDomIntent({ kind: "document" });
  if (typeof observation !== "object" || observation === null || Array.isArray(observation)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  const url = (observation as { url?: unknown }).url;
  if (typeof url !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return new URL(url);
};

export const openGovernedContinuation = async (
  input: ContinuationInput,
): Promise<void> => {
  const requestedUrl = governedContinuationUrl(input.request);
  await focusChatGptConversationByCanonicalPath({
    base: input.browser,
    conversationUrl: requestedUrl.href,
    ...(input.request.providerContinuationRef?.priorTurnMarker
      ? { turnMarker: input.request.providerContinuationRef.priorTurnMarker }
      : {}),
    timeoutMs: 15_000,
    ...(input.context.abortSignal ? { signal: input.context.abortSignal } : {}),
  });
  await input.waitForComposer();
  const actualUrl = await documentUrl(input.browser);
  if (actualUrl.origin !== requestedUrl.origin || actualUrl.pathname !== requestedUrl.pathname) {
    throw new Error(
      `review_required: provider continuation conversation mismatch; requested=${requestedUrl.href}; actual=${actualUrl.href}`,
    );
  }
};
