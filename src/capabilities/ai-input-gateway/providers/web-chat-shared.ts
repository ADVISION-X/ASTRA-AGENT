import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { assertExtracted, waitForStableAnswer } from "./web-chat-answer.js";
import type { WebChatEvaluation } from "./web-chat-evaluation.js";
import { openProviderPage } from "./web-chat-open.js";
import { submitPromptViaClipboard } from "./web-chat-submit.js";
import { uploadFiles as uploadFilesViaSetFileInputFiles } from "./web-chat-upload.js";
import {
  focusExistingSourceTab,
  resolveWebChatWorkspaceId,
  saveWorkspaceUrl,
} from "./web-chat-workspace.js";

const POLL_INTERVAL_MS = 1500;
const STABLE_ROUNDS_REQUIRED = 3;
const setFileInputFilesFlow = uploadFilesViaSetFileInputFiles;

const restoreSourcePage = async (
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

const readActivePageUrl = async (
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

const requireBrowser = (context: AiProviderAdapterContext): BrowserController => {
  if (!context.browser) {
    throw new Error("Web chat feed requires a governed BrowserController.");
  }
  return context.browser;
};

const buildWebChatRawResponse = (input: {
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

const persistWorkspaceAfterResponse = (input: {
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

const submitWebChatPrompt = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  sourcePageUrlBeforeFeed: string | null;
  previousAssistantCount: number;
}): Promise<void> => {
  await submitPromptViaClipboard({
    browser: input.browser,
    request: input.request,
    context: input.context,
    sourceUrl: input.sourcePageUrlBeforeFeed,
    previousAssistantCount: input.previousAssistantCount,
    restoreSourcePage,
  });
};

const extractWebChatConversation = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  previousAnswerText: string | null;
}): Promise<{ extracted: WebChatEvaluation; answerText: string }> => {
  const extracted = await waitForStableAnswer({
    browser: input.browser,
    context: input.context,
    timeoutMs: input.request.timeoutMs,
    pollIntervalMs: POLL_INTERVAL_MS,
    stableRoundsRequired: STABLE_ROUNDS_REQUIRED,
    previousAnswerText: input.previousAnswerText,
  });
  return {
    extracted,
    answerText: assertExtracted({ extracted, restoredSourcePage: null }),
  };
};

const executeWebChatConversation = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
  sourcePageUrlBeforeFeed: string | null;
}): Promise<AiProviderRawResponse> => {
  await setFileInputFilesFlow(input.browser, input.request, input.context);
  const beforeSubmit = await waitForStableAnswer({
    browser: input.browser,
    context: input.context,
    timeoutMs: 1_000,
    pollIntervalMs: 250,
    stableRoundsRequired: 1,
  });
  const previousAssistantCount = beforeSubmit.assistantCount ?? 0;
  const previousAnswerText = beforeSubmit.answerText?.trim() ?? null;
  await submitWebChatPrompt({
    browser: input.browser,
    request: input.request,
    context: input.context,
    sourcePageUrlBeforeFeed: input.sourcePageUrlBeforeFeed,
    previousAssistantCount,
  });
  const conversation = await extractWebChatConversation({
    browser: input.browser,
    request: input.request,
    context: input.context,
    previousAnswerText,
  });
  return buildWebChatRawResponse({
    request: input.request,
    runtimeName: input.runtimeName,
    providerUrl: input.providerUrl,
    sourcePageUrlBeforeFeed: input.sourcePageUrlBeforeFeed,
    extracted: conversation.extracted,
    answerText: conversation.answerText,
  });
};

const restoreAfterWebChatFeed = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  sourcePageUrlBeforeFeed: string | null;
  response: AiProviderRawResponse | null;
}): Promise<void> => {
  const restoredSourcePage = await restoreSourcePage(input.browser, input.sourcePageUrlBeforeFeed, input.context.abortSignal);
  if (input.response) input.response.restoredSourcePage = restoredSourcePage;
  if (restoredSourcePage === false) {
    throw new Error("review_required: source page restoration failed after web chat feed.");
  }
};

const executeOpenedWebChatAdapter = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
  sourcePageUrlBeforeFeed: string | null;
}): Promise<AiProviderRawResponse> => {
  const response = await executeWebChatConversation(input);
  persistWorkspaceAfterResponse({
    request: input.request,
    context: input.context,
    response,
  });
  return response;
};

export const runWebChatAdapter = async (input: {
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
}): Promise<AiProviderRawResponse> => {
  const browser = requireBrowser(input.context);
  const sourcePageUrlBeforeFeed = await readActivePageUrl(browser);
  let response: AiProviderRawResponse | null = null;
  await openProviderPage({
    browser,
    providerUrl: input.providerUrl,
    runtimeName: input.runtimeName,
    context: input.context,
    request: input.request,
  });
  try {
    response = await executeOpenedWebChatAdapter({
      browser,
      request: input.request,
      context: input.context,
      providerUrl: input.providerUrl,
      runtimeName: input.runtimeName,
      sourcePageUrlBeforeFeed,
    });
    return response;
  } finally {
    await restoreAfterWebChatFeed({ browser, context: input.context, sourcePageUrlBeforeFeed, response });
  }
};
