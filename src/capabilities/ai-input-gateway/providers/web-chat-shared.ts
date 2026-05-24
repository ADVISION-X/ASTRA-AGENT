import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { assertExtracted, waitForStableAnswer } from "./web-chat-answer.js";
import type { WebChatEvaluation } from "./web-chat-evaluation.js";
import { isDeepResearchGptRequest, openProviderPage } from "./web-chat-open.js";
import { submitPromptViaClipboard } from "./web-chat-submit.js";
import { uploadFiles as pasteFilesViaClipboard } from "./web-chat-upload.js";
import {
  assertActiveProviderPage,
  buildWebChatRawResponse,
  persistWorkspaceAfterResponse,
  readActivePageUrl,
  requireBrowser,
  restoreSourcePage,
} from "./web-chat-shared-support.js";
import { ensureProviderWorkspaceFocused } from "./web-chat-workspace.js";

const POLL_INTERVAL_MS = 1500;
const STABLE_ROUNDS_REQUIRED = 2;

const shouldCloseProviderTabAfterResponse = (input: {
  providerUrl: string;
  request: AiFeedInput;
}): boolean => isDeepResearchGptRequest(input);

const submitWebChatPrompt = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  sourcePageUrlBeforeFeed: string | null;
  previousAssistantCount: number;
}): Promise<void> => {
  await assertActiveProviderPage({
    browser: input.browser,
    providerUrl: input.providerUrl,
    phase: "prompt submit",
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  await submitPromptViaClipboard({
    browser: input.browser,
    request: input.request,
    context: input.context,
    previousAssistantCount: input.previousAssistantCount,
  });
};

const extractWebChatConversation = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  previousAssistantCount: number;
  previousAnswerText: string | null;
}): Promise<{ extracted: WebChatEvaluation; answerText: string }> => {
  await ensureProviderWorkspaceFocused({
    request: input.request,
    context: input.context,
    providerUrl: input.providerUrl,
    allowAnyProviderTab: false,
  });
  await assertActiveProviderPage({
    browser: input.browser,
    providerUrl: input.providerUrl,
    phase: "response capture",
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  const extracted = await waitForStableAnswer({
    browser: input.browser,
    context: input.context,
    timeoutMs: input.request.timeoutMs,
    pollIntervalMs: POLL_INTERVAL_MS,
    stableRoundsRequired: STABLE_ROUNDS_REQUIRED,
    minAssistantCount: Math.max(1, input.previousAssistantCount + 1),
    previousAnswerText: input.previousAnswerText,
  });
  return {
    extracted,
    answerText: assertExtracted({ extracted, restoredSourcePage: null }),
  };
};

const readPreSubmitConversationState = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  providerUrl: string;
}): Promise<{ previousAssistantCount: number; previousAnswerText: string | null }> => {
  await assertActiveProviderPage({
    browser: input.browser,
    providerUrl: input.providerUrl,
    phase: "pre-submit conversation snapshot",
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  const beforeSubmit = await waitForStableAnswer({
    browser: input.browser,
    context: input.context,
    timeoutMs: 1_000,
    pollIntervalMs: 250,
    stableRoundsRequired: 1,
  });
  return {
    previousAssistantCount: beforeSubmit.assistantCount ?? 0,
    previousAnswerText: beforeSubmit.answerText?.trim() ?? null,
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
  await ensureProviderWorkspaceFocused({ ...input, allowAnyProviderTab: false });
  await assertActiveProviderPage({
    browser: input.browser,
    providerUrl: input.providerUrl,
    phase: "attachment upload",
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  await pasteFilesViaClipboard(input.browser, input.request, input.context);
  await ensureProviderWorkspaceFocused({ ...input, allowAnyProviderTab: false });
  const preSubmit = await readPreSubmitConversationState({
    browser: input.browser,
    context: input.context,
    providerUrl: input.providerUrl,
  });
  await ensureProviderWorkspaceFocused({ ...input, allowAnyProviderTab: false });
  await submitWebChatPrompt({
    browser: input.browser,
    request: input.request,
    context: input.context,
    providerUrl: input.providerUrl,
    sourcePageUrlBeforeFeed: input.sourcePageUrlBeforeFeed,
    previousAssistantCount: preSubmit.previousAssistantCount,
  });
  const conversation = await extractWebChatConversation({
    browser: input.browser,
    request: input.request,
    context: input.context,
    providerUrl: input.providerUrl,
    previousAssistantCount: preSubmit.previousAssistantCount,
    previousAnswerText: preSubmit.previousAnswerText,
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
  providerUrl: string;
  request: AiFeedInput;
  sourcePageUrlBeforeFeed: string | null;
  response: AiProviderRawResponse | null;
}): Promise<void> => {
  if (!input.response) {
    return;
  }
  if (shouldCloseProviderTabAfterResponse({ providerUrl: input.providerUrl, request: input.request })) {
    await assertActiveProviderPage({
      browser: input.browser,
      providerUrl: input.providerUrl,
      phase: "provider tab close",
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    const closeResult = await input.browser.closeActiveTab({
      reason: "Deep Research provider answer captured",
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (!closeResult.ok) {
      throw new Error(`review_required: provider tab close failed after web chat feed: ${closeResult.message}`);
    }
  }
  const restoredSourcePage = await restoreSourcePage(input.browser, input.sourcePageUrlBeforeFeed, input.context.abortSignal);
  input.response.restoredSourcePage = restoredSourcePage;
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
    await restoreAfterWebChatFeed({
      browser,
      context: input.context,
      providerUrl: input.providerUrl,
      request: input.request,
      sourcePageUrlBeforeFeed,
      response,
    });
  }
};
