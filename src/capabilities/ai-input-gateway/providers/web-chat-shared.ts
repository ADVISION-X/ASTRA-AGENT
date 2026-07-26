import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { waitForStableAnswer } from "./web-chat-answer.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import { isPick3WebChatRequest, openProviderPage } from "./web-chat-open.js";
import { GEMINI_STALE_CLEANUP_MAX_PER_RUN } from "./web-chat-pick3-history-cleanup.js";
import { startPick3RateLimitDialogWatcher } from "./web-chat-pick3-recovery-log.js";
import { startChatGptAcknowledgementWatcher } from "./web-chat-rate-limit-dialog.js";
import { submitPromptViaClipboard } from "./web-chat-submit.js";
import { attachApprovedWebChatFilesOnce } from "../children/attach-approved-web-chat-files-once.js";
import {
  assertActiveProviderPage,
  buildWebChatRawResponse,
  cleanupGeminiPick3HistoryBeforeNextImage,
  cleanupProviderWorkspaceAfterResponse,
  isBlockingGeminiPick3PreImageHistoryCleanupStatus,
  persistWorkspaceAfterResponse,
  readActivePageUrl,
  requireBrowser,
} from "./web-chat-shared-support.js";
import { captureWebChatResponseArtifacts } from "./web-chat-response-artifacts.js";
import { ensureProviderWorkspaceFocused } from "./web-chat-workspace.js";
import {
  recoverPick3MissingBoundImageConversation,
  recoverPick3NoResultConversation,
  restoreAfterWebChatFeed,
} from "./web-chat-recovery.js";
import { captureWebChatSubmissionProof } from "./web-chat-turn-identity.js";
import { renameSubmittedChatGptConversation } from "./web-chat-chat-title.js";
import {
  acknowledgeWebChatRateLimitIfVisible,
  emitWebChatStage,
  extractWebChatConversation,
} from "./web-chat-response-capture.js";
import { resumeSubmittedWebChatConversation } from "./web-chat-resume.js";

const PICK3_NO_RESULT_RECOVERY_MAX_ATTEMPTS = 1;

const isPick3NoResultTimeoutError = (input: {
  error: unknown;
  providerUrl: string;
  request: AiFeedInput;
}): boolean =>
  isPick3WebChatRequest({ request: input.request }) &&
  input.error instanceof Error &&
  input.error.message.includes("failed: provider response polling timed out");

const isPick3MissingBoundImageError = (input: {
  error: unknown;
  providerUrl: string;
  request: AiFeedInput;
}): boolean =>
  isPick3WebChatRequest({ request: input.request }) &&
  input.error instanceof Error &&
  input.error.message.includes("provider_missing_bound_image");

const shouldSkipPreSubmitConversationState = (request: AiFeedInput): boolean =>
  request.providerKind === "gemini-web-chat" &&
  isPick3WebChatRequest({ request });

const submitWebChatPrompt = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  previousUserMessageCount: number;
  attachmentUploadProof: WebChatAttachmentUploadProof;
}): Promise<void> => {
  await assertActiveProviderPage({
    browser: input.browser,
    providerUrl: input.providerUrl,
    phase: "prompt submit",
    ...(input.context.abortSignal
      ? { abortSignal: input.context.abortSignal }
      : {}),
  });
  await submitPromptViaClipboard({
    browser: input.browser,
    request: input.request,
    context: input.context,
    previousUserMessageCount: input.previousUserMessageCount,
    attachmentUploadProof: input.attachmentUploadProof,
  });
};

const readPreSubmitConversationState = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
}): Promise<{
  previousAssistantCount: number;
  previousUserMessageCount: number;
  previousAnswerText: string | null;
}> => {
  if (shouldSkipPreSubmitConversationState(input.request)) {
    emitWebChatStage({
      request: input.request,
      stage: "pre_submit_snapshot",
      status: "skipped",
      startedAtMs: null,
      refs: { reason: "fresh_gemini_pick3_conversation" },
    });
    return {
      previousAssistantCount: 0,
      previousUserMessageCount: 0,
      previousAnswerText: null,
    };
  }
  const startedAtMs = Date.now();
  const preSubmitContext = { ...input.context };
  delete preSubmitContext.webChatExecution;
  emitWebChatStage({
    request: input.request,
    stage: "pre_submit_snapshot",
    status: "start",
    startedAtMs: null,
  });
  await assertActiveProviderPage({
    browser: input.browser,
    providerUrl: input.providerUrl,
    phase: "pre-submit conversation snapshot",
    ...(input.context.abortSignal
      ? { abortSignal: input.context.abortSignal }
      : {}),
  });
  const beforeSubmit = await waitForStableAnswer({
    browser: input.browser,
    context: preSubmitContext,
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
    previousUserMessageCount: beforeSubmit.userMessageCount ?? 0,
    previousAnswerText: beforeSubmit.answerText?.trim() ?? null,
  };
};

type OpenedWebChatConversationInput = {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
  sourcePageUrlBeforeFeed: string | null;
};

const prepareWebChatConversation = async (
  input: OpenedWebChatConversationInput,
): Promise<{
  previousAssistantCount: number;
  previousUserMessageCount: number;
  previousAnswerText: string | null;
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof;
}> => {
  await ensureProviderWorkspaceFocused({
    ...input,
    allowAnyProviderTab: false,
  });
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
  if (
    isBlockingGeminiPick3PreImageHistoryCleanupStatus(preImageCleanupStatus)
  ) {
    throw new Error(
      `review_required: Gemini Pick3 pre-image history cleanup failed before attachment upload: ${preImageCleanupStatus}`,
    );
  }
  await assertActiveProviderPage({
    browser: input.browser,
    providerUrl: input.providerUrl,
    phase: "attachment upload",
    ...(input.context.abortSignal
      ? { abortSignal: input.context.abortSignal }
      : {}),
  });
  const attachmentResult = await attachApprovedWebChatFilesOnce({
    browser: input.browser,
    request: input.request,
    context: input.context,
  });
  await ensureProviderWorkspaceFocused({
    ...input,
    allowAnyProviderTab: false,
  });
  return {
    ...(await readPreSubmitConversationState({
      browser: input.browser,
      request: input.request,
      context: input.context,
      providerUrl: input.providerUrl,
    })),
    uploadedFiles: attachmentResult.uploadedFiles,
    attachmentUploadProof: attachmentResult.attachmentUploadProof,
  };
};

const buildCompletedWebChatResponse = async (input: {
  opened: OpenedWebChatConversationInput;
  preSubmit: Awaited<ReturnType<typeof prepareWebChatConversation>>;
  conversation: Awaited<ReturnType<typeof extractWebChatConversation>>;
  submission: Awaited<ReturnType<typeof captureWebChatSubmissionProof>> | null;
}): Promise<AiProviderRawResponse> => {
  const finalizedSubmission = input.opened.context.webChatExecution
    ? await captureWebChatSubmissionProof({
        browser: input.opened.browser,
        context: input.opened.context,
        request: input.opened.request,
        previousAssistantCount: input.preSubmit.previousAssistantCount,
        previousUserMessageCount: input.preSubmit.previousUserMessageCount,
        requireCanonical: true,
      })
    : null;
  if (finalizedSubmission) {
    await input.opened.context.webChatExecution!.onConversationCanonicalized(
      finalizedSubmission,
    );
  }
  const renamedSubmission =
    finalizedSubmission && input.submission
      ? await renameSubmittedChatGptConversation({
          browser: input.opened.browser,
          context: input.opened.context,
          submission: {
            ...finalizedSubmission,
            submittedAt: input.submission.submittedAt,
          },
          timeoutMs: input.opened.request.timeoutMs,
        })
      : finalizedSubmission;
  if (renamedSubmission && input.opened.context.webChatExecution) {
    await input.opened.context.webChatExecution.onConversationCanonicalized(
      renamedSubmission,
    );
  }
  const conversationUrl =
    renamedSubmission?.canonicalConversationUrl ??
    input.conversation.extracted.pageUrl ??
    null;
  const { htmlArtifact, jsonArtifact } = await captureWebChatResponseArtifacts({
    browser: input.opened.browser,
    request: input.opened.request,
    context: input.opened.context,
    answerText: input.conversation.answerText,
    conversationUrl,
  });
  return buildWebChatRawResponse({
    request: input.opened.request,
    runtimeName: input.opened.runtimeName,
    providerUrl: input.opened.providerUrl,
    sourcePageUrlBeforeFeed: input.opened.sourcePageUrlBeforeFeed,
    extracted: conversationUrl
      ? { ...input.conversation.extracted, pageUrl: conversationUrl }
      : input.conversation.extracted,
    answerText:
      htmlArtifact?.htmlDocument ??
      jsonArtifact?.jsonText ??
      input.conversation.answerText,
    uploadedFiles: input.preSubmit.uploadedFiles,
    attachmentUploadProof: input.preSubmit.attachmentUploadProof,
    outputRefs: [
      ...(htmlArtifact ? [htmlArtifact.outputRef] : []),
      ...(jsonArtifact ? [jsonArtifact.outputRef] : []),
    ],
    managedParallelExecution: Boolean(input.opened.context.webChatExecution),
  });
};

const executeWebChatConversation = async (
  input: OpenedWebChatConversationInput,
): Promise<AiProviderRawResponse> => {
  const preSubmit = await prepareWebChatConversation(input);
  await ensureProviderWorkspaceFocused({
    ...input,
    allowAnyProviderTab: false,
  });
  await submitWebChatPrompt({
    browser: input.browser,
    request: input.request,
    context: input.context,
    providerUrl: input.providerUrl,
    previousUserMessageCount: preSubmit.previousUserMessageCount,
    attachmentUploadProof: preSubmit.attachmentUploadProof,
  });
  let capturedSubmission: Awaited<
    ReturnType<typeof captureWebChatSubmissionProof>
  > | null = null;
  if (input.context.webChatExecution) {
    capturedSubmission = await captureWebChatSubmissionProof({
      browser: input.browser,
      context: input.context,
      request: input.request,
      previousAssistantCount: preSubmit.previousAssistantCount,
      previousUserMessageCount: preSubmit.previousUserMessageCount,
      requireCanonical: input.request.providerKind === "gpt-web-chat",
    });
    await input.context.webChatExecution.onSubmissionObserved({
      submission: capturedSubmission,
      uploadedFiles: preSubmit.uploadedFiles,
      attachmentUploadProof: preSubmit.attachmentUploadProof,
    });
    await input.context.webChatExecution.onSubmitted({
      submission: capturedSubmission,
      uploadedFiles: preSubmit.uploadedFiles,
      attachmentUploadProof: preSubmit.attachmentUploadProof,
    });
  }
  const conversation = await extractWebChatConversation({
    browser: input.browser,
    request: input.request,
    context: input.context,
    providerUrl: input.providerUrl,
    previousAssistantCount: preSubmit.previousAssistantCount,
    previousAnswerText: preSubmit.previousAnswerText,
  });
  return buildCompletedWebChatResponse({
    opened: input,
    preSubmit,
    conversation,
    submission: capturedSubmission,
  });
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
      if (
        isPick3MissingBoundImageError({
          error,
          providerUrl: input.providerUrl,
          request: input.request,
        })
      ) {
        if (missingBoundImageRecovered) {
          throw new Error(
            "review_required: provider_missing_bound_image persisted after Pick3 recovery.",
          );
        }
        missingBoundImageRecovered = true;
        const imageRecoveryStatus =
          await recoverPick3MissingBoundImageConversation(input);
        recoveryStatus = recoveryStatus
          ? `${recoveryStatus};${imageRecoveryStatus}`
          : imageRecoveryStatus;
        continue;
      }
      if (
        !isPick3NoResultTimeoutError({
          error,
          providerUrl: input.providerUrl,
          request: input.request,
        })
      ) {
        throw error;
      }
      recoveryStatus = await recoverPick3NoResultConversation(input);
      response = await executeWebChatConversation(input);
      break;
    }
  }
  if (recoveryStatus) {
    response.providerRecoveryAttemptCount = recoveryStatus.includes(
      "pick3_rate_limit_immediate_ack",
    )
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
  if (input.context.webChatExecution?.resumeSubmission) {
    return resumeSubmittedWebChatConversation({
      ...input,
      browser,
    });
  }
  const sourcePageUrlBeforeFeed = input.context.webChatExecution
    ? null
    : await readActivePageUrl(browser);
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
  const chatGptAcknowledgementWatcher = startChatGptAcknowledgementWatcher({
    browser: input.context.webChatExecution?.globalBrowser ?? browser,
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
    try {
      await chatGptAcknowledgementWatcher?.stop();
    } catch (error) {
      watcherFailure ??= error;
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
