import type {
  BrowserTargetLease,
} from "../../../lib/browser/browser-authority-api.js";
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

const FRESH_TURN_SURFACE_SELECTOR = [
  "[data-testid^='conversation-turn-'][data-turn='user']",
  "[data-testid^='conversation-turn-'][data-turn='assistant']",
].join(",");

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return value as Record<string, unknown>;
};

const readFreshConversationState = async (
  browser: BrowserTargetLease,
): Promise<PreSubmitConversationState> => {
  const result = record(await browser.executeDomIntent({
    kind: "find",
    selector: FRESH_TURN_SURFACE_SELECTOR,
    maxMatches: 20,
    fields: ["testId", "dataTurn", "text"],
  }));
  if (!Number.isInteger(result.count)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  if (result.count === 0) {
    return {
      previousAssistantCount: 0,
      previousUserMessageCount: 0,
      previousAnswerText: null,
    };
  }
  if (!Array.isArray(result.matches)
    || result.matches.length !== result.count) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  for (const value of result.matches) {
    const match = record(value);
    if (typeof match.testId !== "string"
      || !/^conversation-turn-[1-9][0-9]*$/u.test(match.testId)
      || (match.dataTurn !== "user" && match.dataTurn !== "assistant")
      || typeof match.text !== "string") {
      throw new Error("BROWSER_TARGET_INVALID");
    }
  }
  throw new Error("recovery_pending: WEB_CHAT_FRESH_CONVERSATION_NOT_EMPTY");
};

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
  browser: BrowserTargetLease;
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
  if (!(input.request.providerContinuationRef || input.request.providerForkRef)) {
    return readFreshConversationState(input.browser);
  }
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
