import type {
  BrowserController,
} from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { waitForStableAnswer } from "./web-chat-answer.js";
import { isPick3WebChatRequest } from "./web-chat-open.js";
import {
  acknowledgeWebChatRateLimitIfVisible,
  emitWebChatStage,
} from "./web-chat-response-capture.js";
import {
  assertActiveProviderPage,
} from "./web-chat-shared-support.js";

const shouldSkipPreSubmitConversationState = (
  request: AiFeedInput,
): boolean =>
  request.providerKind === "gemini-web-chat"
  && isPick3WebChatRequest({ request });

export interface PreSubmitConversationState {
  previousAssistantCount: number;
  previousUserMessageCount: number;
  previousAnswerText: string | null;
}

const assertStableContinuationHistory = (
  request: AiFeedInput,
  snapshot: Awaited<ReturnType<typeof waitForStableAnswer>>,
): void => {
  if (
    !request.providerContinuationRef
    || (
      snapshot.status === "success"
      && (snapshot.userMessageCount ?? 0) >= 1
      && (snapshot.assistantCount ?? 0) >= 1
      && Boolean(snapshot.answerText?.trim())
    )
  ) return;
  throw new Error(
    "WEB_CHAT_CONTINUATION_HISTORY_NOT_STABLE: "
    + "exact parent conversation history did not finish hydrating "
    + "before submission.",
  );
};

const emitCompletedPreSubmitSnapshot = (input: {
  request: AiFeedInput;
  snapshot: Awaited<ReturnType<typeof waitForStableAnswer>>;
  startedAtMs: number;
}): void => emitWebChatStage({
  request: input.request,
  stage: "pre_submit_snapshot",
  status: "success",
  startedAtMs: input.startedAtMs,
  refs: {
    assistantCount: input.snapshot.assistantCount ?? 0,
    userMessageCount: input.snapshot.userMessageCount ?? 0,
    continuationHistoryStable:
      input.request.providerContinuationRef ? true : null,
  },
});

export const readPreSubmitConversationState = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
}): Promise<PreSubmitConversationState> => {
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
    timeoutMs: 8_000,
    pollIntervalMs: 500,
    stableRoundsRequired: 3,
    minStableDurationMs: 1_000,
    beforePoll: () => acknowledgeWebChatRateLimitIfVisible(input),
  });
  assertStableContinuationHistory(input.request, beforeSubmit);
  emitCompletedPreSubmitSnapshot({
    request: input.request,
    snapshot: beforeSubmit,
    startedAtMs,
  });
  return {
    previousAssistantCount: beforeSubmit.assistantCount ?? 0,
    previousUserMessageCount: beforeSubmit.userMessageCount ?? 0,
    previousAnswerText: beforeSubmit.answerText?.trim() ?? null,
  };
};
