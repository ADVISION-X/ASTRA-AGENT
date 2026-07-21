import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const CURRENT_URL_SCRIPT = "return {status: 'success', message: 'read current provider URL', pageUrl: location.href};";

type ContinuationInput = {
  browser: BrowserController;
  runtimeName: string;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  waitForComposer: () => Promise<void>;
};

const governedContinuationUrl = (request: AiFeedInput): URL => {
  const continuation = request.providerContinuationRef;
  if (!continuation) throw new Error("review_required: provider continuation reference is missing");
  const url = new URL(continuation.providerPageUrl);
  const governed = request.providerKind === "gpt-web-chat"
    && url.protocol === "https:"
    && url.host === "chatgpt.com"
    && url.pathname.includes("/c/");
  if (!governed) throw new Error("review_required: provider continuation URL is not a governed ChatGPT conversation URL");
  return url;
};

export const openGovernedContinuation = async (input: ContinuationInput): Promise<void> => {
  const requestedUrl = governedContinuationUrl(input.request);
  const opened = await input.browser.open({
    url: requestedUrl.href,
    title: `${input.runtimeName}:governed-continuation`,
    reusePolicy: "reuse-active-tab",
  });
  if (!opened.ok) throw new Error(`Web chat provider page could not be opened: ${opened.message}`);
  await input.waitForComposer();
  const state = await input.browser.evaluateActiveTab<{ pageUrl?: string }>({
    description: "read active provider URL after governed continuation open",
    script: CURRENT_URL_SCRIPT,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  const actualUrl = state.pageUrl ? new URL(state.pageUrl) : null;
  if (!actualUrl || actualUrl.origin !== requestedUrl.origin || actualUrl.pathname !== requestedUrl.pathname) {
    throw new Error(`review_required: provider continuation conversation mismatch; requested=${requestedUrl.href}; actual=${state.pageUrl ?? "unknown"}`);
  }
};
