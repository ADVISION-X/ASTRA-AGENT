import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { assertExtracted, waitForStableAnswer } from "./web-chat-answer.js";
import type { WebChatEvaluation } from "./web-chat-evaluation.js";
import {
  captureChatGptBusinessHtmlArtifact,
  isBusinessHtmlReportRequest,
} from "./web-chat-html-artifact-capture.js";
import { isAmazonProductMiningGptRequest, isPick3GptRequest, openProviderPage } from "./web-chat-open.js";
import { deletePick3WorkspaceConversationHistoryUrl } from "./web-chat-pick3-history-cleanup.js";
import { emitPick3RateLimitRecoveryStep, reservePick3RateLimitAttempt, resolvePick3RateLimitBackoffMs, waitAfterPick3RateLimit } from "./web-chat-pick3-recovery-log.js";
import { submitPromptViaClipboard } from "./web-chat-submit.js";
import { uploadFiles as pasteFilesViaClipboard } from "./web-chat-upload.js";
import {
  assertActiveProviderPage,
  buildWebChatRawResponse,
  cleanupProviderWorkspaceAfterResponse,
  persistWorkspaceAfterResponse,
  readActivePageUrl,
  requireBrowser,
  restoreSourcePage,
} from "./web-chat-shared-support.js";
import { canContinueAfterWebChatSourceRestoreFailure } from "./web-chat-restore-policy.js";
import { ensureProviderWorkspaceFocused, resolveWebChatWorkspaceId, saveWorkspaceUrl } from "./web-chat-workspace.js";

const POLL_INTERVAL_MS = 1500;
const STABLE_ROUNDS_REQUIRED = 2;
const PICK3_NO_RESULT_RECOVERY_TIMEOUT_MS = 200_000;
const PICK3_NO_RESULT_RECOVERY_MAX_ATTEMPTS = 1;

const shouldCloseProviderTabAfterResponse = (input: {
  providerUrl: string;
  request: AiFeedInput;
}): boolean => isAmazonProductMiningGptRequest(input);

const resolveResponseTimeoutMs = (input: {
  providerUrl: string;
  request: AiFeedInput;
}): number =>
  isPick3GptRequest(input)
    ? PICK3_NO_RESULT_RECOVERY_TIMEOUT_MS
    : input.request.timeoutMs;

const isPick3NoResultTimeoutError = (input: {
  error: unknown;
  providerUrl: string;
  request: AiFeedInput;
}): boolean =>
  isPick3GptRequest(input)
  && input.error instanceof Error
  && input.error.message.includes("failed: provider response polling timed out");

const isPick3RateLimitError = (input: {
  error: unknown;
  providerUrl: string;
  request: AiFeedInput;
}): boolean =>
  isPick3GptRequest(input)
  && input.error instanceof Error
  && input.error.message.includes("provider_rate_limited_too_many_requests");

const isPick3MissingBoundImageError = (input: {
  error: unknown;
  providerUrl: string;
  request: AiFeedInput;
}): boolean =>
  isPick3GptRequest(input)
  && input.error instanceof Error
  && input.error.message.includes("provider_missing_bound_image");

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
    timeoutMs: resolveResponseTimeoutMs(input),
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
  const htmlArtifact = await captureChatGptBusinessHtmlArtifact({
    browser: input.browser,
    request: input.request,
    context: input.context,
    conversationUrl: conversation.extracted.pageUrl ?? null,
  });
  if (isBusinessHtmlReportRequest(input.request) && !htmlArtifact) {
    throw new Error("review_required: provider did not produce a business-report.html artifact.");
  }
  return buildWebChatRawResponse({
    request: input.request,
    runtimeName: input.runtimeName,
    providerUrl: input.providerUrl,
    sourcePageUrlBeforeFeed: input.sourcePageUrlBeforeFeed,
    extracted: conversation.extracted,
    answerText: htmlArtifact?.htmlDocument ?? conversation.answerText,
    outputRefs: htmlArtifact ? [htmlArtifact.outputRef] : [],
  });
};

const recoverPick3NoResultConversation = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
}): Promise<string> => {
  const timedOutUrl = input.browser.getSessionState().currentUrl;
  if (!timedOutUrl.startsWith("https://chatgpt.com/c/")) {
    return `pick3_no_result_recovery_skipped_non_conversation_url:${timedOutUrl}`;
  }
  await input.browser.open({
    url: timedOutUrl,
    title: "Refresh timed-out Pick3 ChatGPT conversation",
    reusePolicy: "reuse-active-tab",
  });
  await input.browser.wait(1_800);
  const deleteStatus = await deletePick3WorkspaceConversationHistoryUrl({
    browser: input.browser,
    conversationUrl: timedOutUrl,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (deleteStatus !== "current_history_deleted") {
    throw new Error(`review_required: Pick3 timed-out ChatGPT conversation deletion failed: ${deleteStatus}`);
  }
  const workspaceId = resolveWebChatWorkspaceId(input.request);
  if (workspaceId) {
    saveWorkspaceUrl({
      dataDir: input.context.dataDir,
      providerKind: input.request.providerKind,
      workspaceId,
      url: input.providerUrl,
    });
  }
  await openProviderPage({
    browser: input.browser,
    providerUrl: input.providerUrl,
    runtimeName: input.runtimeName,
    context: input.context,
    request: input.request,
  });
  return "pick3_no_result_recovery_refreshed_deleted_current_conversation_and_reopened_new_chat";
};

const recoverPick3MissingBoundImageConversation = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
}): Promise<string> => {
  await recoverPick3NoResultConversation(input);
  return "pick3_missing_bound_image_recovery_deleted_current_conversation_and_reopened_new_chat";
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
      reason: "AI provider answer captured",
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (!closeResult.ok) {
      throw new Error(`review_required: provider tab close failed after web chat feed: ${closeResult.message}`);
    }
  }
  const restoredSourcePage = await restoreSourcePage(input.browser, input.sourcePageUrlBeforeFeed, input.context.abortSignal);
  input.response.restoredSourcePage = restoredSourcePage;
  if (
    restoredSourcePage === false
    && !canContinueAfterWebChatSourceRestoreFailure({ request: input.request })
  ) {
    throw new Error("review_required: source page restoration failed after web chat feed.");
  }
};

const recoverAfterPick3RateLimit = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
}): Promise<string> => {
  const rateLimitAttempt = reservePick3RateLimitAttempt(input.request);
  const backoffMs = resolvePick3RateLimitBackoffMs(rateLimitAttempt);
  if (backoffMs === null) {
    throw new Error("review_required: Pick3 ChatGPT rate limit persisted after 3 backoff waits.");
  }
  const waitStatus = await waitAfterPick3RateLimit({
    browser: input.browser,
    request: input.request,
    context: input.context,
    attemptIndex: rateLimitAttempt,
    backoffMs,
  });
  await openProviderPage(input);
  emitPick3RateLimitRecoveryStep({
    logger: input.context.runtimeLogger,
    request: input.request,
    attemptIndex: rateLimitAttempt,
    reason: "pick3_rate_limit_new_chat_reopened_for_resend",
    status: "success",
    phase: "new_chat_reopened_for_resend",
  });
  emitPick3RateLimitRecoveryStep({
    logger: input.context.runtimeLogger,
    request: input.request,
    attemptIndex: rateLimitAttempt,
    reason: "pick3_rate_limit_same_payload_resend_started",
    status: "started",
    phase: "same_payload_resend_started",
  });
  return waitStatus;
};

const executeOpenedWebChatAdapter = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
  sourcePageUrlBeforeFeed: string | null;
}): Promise<AiProviderRawResponse> => {
  let recoveryStatus: string | null = null;
  let response: AiProviderRawResponse;
  let missingBoundImageRecovered = false;
  for (;;) {
    try {
      response = await executeWebChatConversation(input);
      break;
    } catch (error) {
      if (isPick3RateLimitError({ error, providerUrl: input.providerUrl, request: input.request })) {
        const waitStatus = await recoverAfterPick3RateLimit(input);
        recoveryStatus = recoveryStatus ? `${recoveryStatus};${waitStatus}` : waitStatus;
        continue;
      }
      if (isPick3MissingBoundImageError({ error, providerUrl: input.providerUrl, request: input.request })) {
        if (missingBoundImageRecovered) {
          throw new Error("review_required: provider_missing_bound_image persisted after Pick3 recovery.");
        }
        missingBoundImageRecovered = true;
        const imageRecoveryStatus = await recoverPick3MissingBoundImageConversation(input);
        recoveryStatus = recoveryStatus ? `${recoveryStatus};${imageRecoveryStatus}` : imageRecoveryStatus;
        continue;
      }
      if (!isPick3NoResultTimeoutError({ error, providerUrl: input.providerUrl, request: input.request })) {
        throw error;
      }
      recoveryStatus = await recoverPick3NoResultConversation(input);
      response = await executeWebChatConversation(input);
      break;
    }
  }
  if (recoveryStatus) {
    response.providerRecoveryAttemptCount = recoveryStatus.includes("pick3_rate_limit_backoff")
      ? recoveryStatus.split("pick3_rate_limit_backoff").length - 1
      : PICK3_NO_RESULT_RECOVERY_MAX_ATTEMPTS;
    response.providerRecoveryStatus = recoveryStatus;
  }
  persistWorkspaceAfterResponse({
    request: input.request,
    context: input.context,
    response,
  });
  await cleanupProviderWorkspaceAfterResponse({
    browser: input.browser,
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
