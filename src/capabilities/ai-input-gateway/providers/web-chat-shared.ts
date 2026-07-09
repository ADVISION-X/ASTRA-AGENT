import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext, AiProviderRawResponse } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { assertExtracted, waitForStableAnswer } from "./web-chat-answer.js";
import type { WebChatEvaluation } from "./web-chat-evaluation.js";
import {
  captureChatGptBusinessHtmlArtifact,
  captureInlineChatGptBusinessHtmlArtifact,
  isBusinessHtmlReportRequest,
} from "./web-chat-html-artifact-capture.js";
import {
  captureChatGptJsonArtifact,
  captureInlineChatGptJsonArtifact,
  isJsonArtifactRequest,
} from "./web-chat-json-artifact-capture.js";
import { isAmazonProductMiningGptRequest, isPick3WebChatRequest, openProviderPage } from "./web-chat-open.js";
import { GEMINI_STALE_CLEANUP_MAX_PER_RUN } from "./web-chat-pick3-history-cleanup.js";
import { acknowledgePick3RateLimitIfVisible, startPick3RateLimitDialogWatcher } from "./web-chat-pick3-recovery-log.js";
import { acknowledgeChatGptRateLimitDialogIfVisible } from "./web-chat-rate-limit-dialog.js";
import { submitPromptViaClipboard } from "./web-chat-submit.js";
import { uploadFiles as pasteFilesViaClipboard } from "./web-chat-upload.js";
import { assertActiveProviderPage, buildWebChatRawResponse, cleanupGeminiPick3HistoryBeforeNextImage, cleanupProviderWorkspaceAfterResponse, isBlockingGeminiPick3PreImageHistoryCleanupStatus, persistWorkspaceAfterResponse, readActivePageUrl, requireBrowser, restoreSourcePage } from "./web-chat-shared-support.js";
import { canContinueAfterWebChatSourceRestoreFailure } from "./web-chat-restore-policy.js";
import { ensureProviderWorkspaceFocused, resolveWebChatWorkspaceId, saveWorkspaceUrl } from "./web-chat-workspace.js";

const POLL_INTERVAL_MS = 1500;
const GEMINI_PICK3_RESPONSE_POLL_INTERVAL_MS = 250;
const STABLE_ROUNDS_REQUIRED = 2;
const PICK3_NO_RESULT_RECOVERY_TIMEOUT_MS = 200_000;
const PICK3_NO_RESULT_RECOVERY_MAX_ATTEMPTS = 1;

const emitWebChatStage = (input: { request: AiFeedInput; stage: string; status: string; startedAtMs: number | null; refs?: Record<string, unknown> }): void => {
  if (!isPick3WebChatRequest({ request: input.request })) return;
  process.stdout.write(`${JSON.stringify({
    ts: new Date().toISOString(),
    marker: "[GRASSEYE][AI-GATEWAY][WEB-CHAT]",
    providerKind: input.request.providerKind,
    stage: input.stage,
    status: input.status,
    ...(input.startedAtMs === null ? {} : { elapsedMs: Date.now() - input.startedAtMs }),
    refs: {
      promptPackageId: input.request.promptPackageId,
      inputRefId: input.request.inputRefs[0]?.id ?? null,
      ...input.refs,
    },
  })}\n`);
};

const shouldCloseProviderTabAfterResponse = (input: { providerUrl: string; request: AiFeedInput }): boolean => isAmazonProductMiningGptRequest(input);

const resolveResponseTimeoutMs = (input: { providerUrl: string; request: AiFeedInput }): number =>
  isPick3WebChatRequest({ request: input.request })
    ? PICK3_NO_RESULT_RECOVERY_TIMEOUT_MS
    : input.request.timeoutMs;

const isPick3NoResultTimeoutError = (input: { error: unknown; providerUrl: string; request: AiFeedInput }): boolean =>
  isPick3WebChatRequest({ request: input.request })
  && input.error instanceof Error
  && input.error.message.includes("failed: provider response polling timed out");

const isPick3MissingBoundImageError = (input: { error: unknown; providerUrl: string; request: AiFeedInput }): boolean =>
  isPick3WebChatRequest({ request: input.request })
  && input.error instanceof Error
  && input.error.message.includes("provider_missing_bound_image");

const shouldSkipPreSubmitConversationState = (request: AiFeedInput): boolean =>
  request.providerKind === "gemini-web-chat"
  && isPick3WebChatRequest({ request });

const acknowledgeWebChatRateLimitIfVisible = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
}): Promise<void> => {
  if (input.request.providerKind === "gpt-web-chat") {
    await acknowledgeChatGptRateLimitDialogIfVisible({
      browser: input.browser,
      context: input.context,
    });
    return;
  }
  await acknowledgePick3RateLimitIfVisible(input);
};

const submitWebChatPrompt = async (input: { browser: BrowserController; request: AiFeedInput; context: AiProviderAdapterContext; providerUrl: string; previousAssistantCount: number }): Promise<void> => {
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

const extractWebChatConversation = async (input: { browser: BrowserController; request: AiFeedInput; context: AiProviderAdapterContext; providerUrl: string; previousAssistantCount: number; previousAnswerText: string | null }): Promise<{ extracted: WebChatEvaluation; answerText: string }> => {
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
  const responseCaptureStartedAtMs = Date.now();
  const responsePollIntervalMs = input.request.providerKind === "gemini-web-chat" ? GEMINI_PICK3_RESPONSE_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
  emitWebChatStage({ request: input.request, stage: "response_capture", status: "start", startedAtMs: null, refs: { pollIntervalMs: responsePollIntervalMs } });
  const extracted = await waitForStableAnswer({
    browser: input.browser,
    context: input.context,
    timeoutMs: resolveResponseTimeoutMs(input),
    pollIntervalMs: responsePollIntervalMs,
    stableRoundsRequired: input.request.providerKind === "gemini-web-chat" ? 1 : STABLE_ROUNDS_REQUIRED,
    ...(input.request.providerKind === "gemini-web-chat" ? {} : {
      minAssistantCount: Math.max(1, input.previousAssistantCount + 1),
    }),
    previousAnswerText: input.previousAnswerText,
    beforePoll: () => acknowledgeWebChatRateLimitIfVisible(input),
  });
  emitWebChatStage({ request: input.request, stage: "response_capture", status: extracted.status, startedAtMs: responseCaptureStartedAtMs, refs: {
    message: extracted.message,
    rawLen: extracted.answerText?.length ?? 0,
    generating: extracted.generating ?? null,
    assistantCount: extracted.assistantCount ?? null,
  } });
  return {
    extracted,
    answerText: assertExtracted({ extracted, restoredSourcePage: null }),
  };
};

const readPreSubmitConversationState = async (input: { browser: BrowserController; request: AiFeedInput; context: AiProviderAdapterContext; providerUrl: string }): Promise<{ previousAssistantCount: number; previousAnswerText: string | null }> => {
  if (shouldSkipPreSubmitConversationState(input.request)) {
    emitWebChatStage({ request: input.request, stage: "pre_submit_snapshot", status: "skipped", startedAtMs: null, refs: { reason: "fresh_gemini_pick3_conversation" } });
    return { previousAssistantCount: 0, previousAnswerText: null };
  }
  const startedAtMs = Date.now();
  emitWebChatStage({ request: input.request, stage: "pre_submit_snapshot", status: "start", startedAtMs: null });
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
    beforePoll: () => acknowledgeWebChatRateLimitIfVisible(input),
  });
  emitWebChatStage({
    request: input.request,
    stage: "pre_submit_snapshot",
    status: "success",
    startedAtMs,
    refs: { assistantCount: beforeSubmit.assistantCount ?? 0 },
  });
  return {
    previousAssistantCount: beforeSubmit.assistantCount ?? 0,
    previousAnswerText: beforeSubmit.answerText?.trim() ?? null,
  };
};

type OpenedWebChatConversationInput = { browser: BrowserController; request: AiFeedInput; context: AiProviderAdapterContext; providerUrl: string; runtimeName: string; sourcePageUrlBeforeFeed: string | null };

const prepareWebChatConversation = async (
  input: OpenedWebChatConversationInput,
): Promise<{ previousAssistantCount: number; previousAnswerText: string | null }> => {
  await ensureProviderWorkspaceFocused({ ...input, allowAnyProviderTab: false });
  const preImageCleanupStartedAtMs = Date.now();
  const preImageCleanupStatus = await cleanupGeminiPick3HistoryBeforeNextImage({
    browser: input.browser,
    request: input.request,
    context: input.context,
  });
  if (preImageCleanupStatus !== null) {
    emitWebChatStage({
      request: input.request,
      stage: "pre_image_history_cleanup",
      status: preImageCleanupStatus,
      startedAtMs: preImageCleanupStartedAtMs,
      refs: {
        provider: "gemini",
        policy: "delete_previous_stale_history_before_next_image",
        keepRecentCount: 1,
        triggerThreshold: 1,
        maxDeleteCount: GEMINI_STALE_CLEANUP_MAX_PER_RUN,
      },
    });
  }
  if (isBlockingGeminiPick3PreImageHistoryCleanupStatus(preImageCleanupStatus)) {
    throw new Error(`review_required: Gemini Pick3 pre-image history cleanup failed before attachment upload: ${preImageCleanupStatus}`);
  }
  await assertActiveProviderPage({
    browser: input.browser,
    providerUrl: input.providerUrl,
    phase: "attachment upload",
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  await pasteFilesViaClipboard(input.browser, input.request, input.context);
  await ensureProviderWorkspaceFocused({ ...input, allowAnyProviderTab: false });
  return readPreSubmitConversationState({
    browser: input.browser,
    request: input.request,
    context: input.context,
    providerUrl: input.providerUrl,
  });
};

const executeWebChatConversation = async (
  input: OpenedWebChatConversationInput,
): Promise<AiProviderRawResponse> => {
  const preSubmit = await prepareWebChatConversation(input);
  await ensureProviderWorkspaceFocused({ ...input, allowAnyProviderTab: false });
  await submitWebChatPrompt({
    browser: input.browser,
    request: input.request,
    context: input.context,
    providerUrl: input.providerUrl,
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
  const inlineHtmlArtifact = isBusinessHtmlReportRequest(input.request)
    ? captureInlineChatGptBusinessHtmlArtifact({
      answerText: conversation.answerText,
      pageUrl: conversation.extracted.pageUrl ?? null,
    })
    : null;
  const htmlArtifact = inlineHtmlArtifact
    ?? await captureChatGptBusinessHtmlArtifact({
      browser: input.browser,
      request: input.request,
      context: input.context,
      conversationUrl: conversation.extracted.pageUrl ?? null,
    });
  if (isBusinessHtmlReportRequest(input.request) && !htmlArtifact) {
    throw new Error("review_required: provider did not produce a business-report.html artifact.");
  }
  const inlineJsonArtifact = !htmlArtifact && isJsonArtifactRequest(input.request)
    ? captureInlineChatGptJsonArtifact({
      answerText: conversation.answerText,
      pageUrl: conversation.extracted.pageUrl ?? null,
    })
    : null;
  const jsonArtifact = inlineJsonArtifact
    ?? (!htmlArtifact
      ? await captureChatGptJsonArtifact({
        browser: input.browser,
        request: input.request,
        context: input.context,
        conversationUrl: conversation.extracted.pageUrl ?? null,
      })
      : null);
  return buildWebChatRawResponse({
    request: input.request,
    runtimeName: input.runtimeName,
    providerUrl: input.providerUrl,
    sourcePageUrlBeforeFeed: input.sourcePageUrlBeforeFeed,
    extracted: conversation.extracted,
    answerText: htmlArtifact?.htmlDocument ?? jsonArtifact?.jsonText ?? conversation.answerText,
    outputRefs: [
      ...(htmlArtifact ? [htmlArtifact.outputRef] : []),
      ...(jsonArtifact ? [jsonArtifact.outputRef] : []),
    ],
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
  if (input.request.providerKind === "gemini-web-chat") {
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
    return "pick3_no_result_recovery_reopened_gemini_new_chat";
  }
  if (!timedOutUrl.startsWith("https://chatgpt.com/c/")) {
    return `pick3_no_result_recovery_skipped_non_conversation_url:${timedOutUrl}`;
  }
  await input.browser.open({
    url: timedOutUrl,
    title: "Refresh timed-out Pick3 ChatGPT conversation",
    reusePolicy: "reuse-active-tab",
  });
  await input.browser.wait(1_800);
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
  return "pick3_no_result_recovery_refreshed_without_history_delete_and_reopened_new_chat";
};

const recoverPick3MissingBoundImageConversation = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
}): Promise<string> => {
  await recoverPick3NoResultConversation(input);
  return "pick3_missing_bound_image_recovery_without_history_delete_and_reopened_new_chat";
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
    response.providerRecoveryAttemptCount = recoveryStatus.includes("pick3_rate_limit_immediate_ack")
      ? recoveryStatus.split("pick3_rate_limit_immediate_ack").length - 1
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
  const rateLimitDialogWatcher = startPick3RateLimitDialogWatcher({
    browser,
    request: input.request,
    context: input.context,
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
    let watcherFailure: unknown = null;
    try {
      await rateLimitDialogWatcher?.stop();
    } catch (error) {
      watcherFailure = error;
    }
    await restoreAfterWebChatFeed({
      browser,
      context: input.context,
      providerUrl: input.providerUrl,
      request: input.request,
      sourcePageUrlBeforeFeed,
      response,
    });
    if (watcherFailure) throw watcherFailure;
  }
};
