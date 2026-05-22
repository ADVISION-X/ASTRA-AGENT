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
    const restoredState = await browser.evaluateActiveTab<{ pageUrl: string; hostMatches: boolean }>({
      description: "verify source page restored after AI feed",
      script: `
const expectedHost = ${JSON.stringify(new URL(sourceUrl).host)};
return {pageUrl: location.href, hostMatches: location.host === expectedHost};
`,
    });
    return restoredState.hostMatches;
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
}): AiProviderRawResponse => ({
  rawText: input.answerText,
  modelName: input.request.modelName,
  runtimeName: input.runtimeName,
  transport: "web-chat",
  webChatUrl: input.extracted.pageUrl ?? input.providerUrl,
  sourcePageUrlBeforeFeed: input.sourcePageUrlBeforeFeed,
  restoredSourcePage: null,
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