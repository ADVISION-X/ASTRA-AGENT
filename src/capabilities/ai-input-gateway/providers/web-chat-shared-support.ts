import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type { WebChatEvaluation } from "./web-chat-evaluation.js";
import {
  focusExistingSourceTab,
  resolveWebChatWorkspaceId,
  saveWorkspaceUrl,
} from "./web-chat-workspace.js";

export const restoreSourcePage = async (
  browser: BrowserController,
  sourceUrl: string | null,
  abortSignal?: AbortSignal,
): Promise<boolean | null> => {
  if (!sourceUrl || sourceUrl === "about:blank") return null;
  const focused = await focusExistingSourceTab({ sourceUrl, ...(abortSignal ? { abortSignal } : {}) });
  if (!focused) return false;
  try {
    const parsed = new URL(sourceUrl);
    const parsedSource = parsed.protocol === "blob:"
      ? (() => {
          try {
            return new URL(parsed.pathname);
          } catch {
            return parsed;
          }
        })()
      : parsed;
    const restoredState = await browser.evaluateActiveTab<{ pageUrl: string; sourceMatches: boolean }>({
      description: "verify source page restored after AI feed",
      script: `
const expectedUrl = ${JSON.stringify(sourceUrl)};
const expectedHost = ${JSON.stringify(parsedSource.host)};
const expectedOrigin = ${JSON.stringify(parsedSource.origin)};
return {
  pageUrl: location.href,
  sourceMatches: location.href === expectedUrl || location.host === expectedHost || location.origin === expectedOrigin,
};
`,
    });
    return restoredState.sourceMatches;
  } catch {
    return false;
  }
};

export const readActivePageUrl = async (
  browser: BrowserController,
): Promise<string | null> => {
  try {
    const state = await browser.evaluateActiveTab<{ pageUrl: string }>({
      description: "read active page URL before AI web chat feed",
      script: "return {pageUrl: location.href};",
    });
    return state.pageUrl || null;
  } catch {
    return browser.getSessionState().currentUrl || null;
  }
};

export const assertActiveProviderPage = async (input: {
  browser: BrowserController;
  providerUrl: string;
  abortSignal?: AbortSignal;
  phase: string;
}): Promise<void> => {
  const expectedHost = new URL(input.providerUrl).host;
  const state = await input.browser.evaluateActiveTab<{ pageUrl: string; hostMatches: boolean }>({
    description: `verify provider page remains active before ${input.phase}`,
    script: `
const expectedHost = ${JSON.stringify(expectedHost)};
return {pageUrl: location.href, hostMatches: location.host === expectedHost};
`,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  if (!state.hostMatches) {
    throw new Error(`review_required: active Chrome tab left provider page before ${input.phase}; pageUrl=${state.pageUrl}`);
  }
};

export const requireBrowser = (context: AiProviderAdapterContext): BrowserController => {
  if (!context.browser) {
    throw new Error("Web chat feed requires a governed BrowserController.");
  }
  return context.browser;
};

export const buildWebChatRawResponse = (input: {
  request: AiFeedInput;
  runtimeName: string;
  providerUrl: string;
  sourcePageUrlBeforeFeed: string | null;
  extracted: WebChatEvaluation;
  answerText: string;
  outputRefs?: string[];
}): AiProviderRawResponse => ({
  rawText: input.answerText,
  modelName: input.request.modelName,
  runtimeName: input.runtimeName,
  transport: "web-chat",
  webChatUrl: input.extracted.pageUrl ?? input.providerUrl,
  sourcePageUrlBeforeFeed: input.sourcePageUrlBeforeFeed,
  restoredSourcePage: null,
  outputRefs: input.outputRefs ?? [],
  estimatedInputTokens: null,
  estimatedOutputTokens: null,
  tokenEstimateUnavailableReason: "web chat token estimates are unavailable.",
});

export const persistWorkspaceAfterResponse = (input: {
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  response: AiProviderRawResponse;
}): void => {
  const workspaceId = resolveWebChatWorkspaceId(input.request);
  if (!workspaceId) return;
  saveWorkspaceUrl({
    dataDir: input.context.dataDir,
    providerKind: input.request.providerKind,
    workspaceId,
    url: input.response.webChatUrl,
  });
};
