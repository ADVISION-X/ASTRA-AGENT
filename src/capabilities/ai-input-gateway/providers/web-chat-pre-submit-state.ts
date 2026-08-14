import type {
  BrowserTargetSession,
} from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { waitForStableAnswer } from "./web-chat-answer.js";
import {
  acknowledgeWebChatRateLimitIfVisible,
} from "./web-chat-response-capture.js";
import {
  assertActiveProviderPage,
} from "./web-chat-shared-support.js";

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
    !(request.providerContinuationRef || request.providerForkRef)
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

export const readPreSubmitConversationState = async (input: {
  browser: BrowserTargetSession;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
}): Promise<PreSubmitConversationState> => {
  const preSubmitContext = { ...input.context };
  delete preSubmitContext.webChatExecution;
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
  return {
    previousAssistantCount: beforeSubmit.assistantCount ?? 0,
    previousUserMessageCount: beforeSubmit.userMessageCount ?? 0,
    previousAnswerText: beforeSubmit.answerText?.trim() ?? null,
  };
};
