import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { assertExtracted, waitForStableAnswer } from "./web-chat-answer.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import { isPick3WebChatRequest } from "./web-chat-open.js";
import { acknowledgePick3RateLimitIfVisible } from "./web-chat-pick3-recovery-log.js";
import { acknowledgeChatGptRateLimitDialogIfVisible } from "./web-chat-rate-limit-dialog.js";
import { assertActiveProviderPage } from "./web-chat-shared-support.js";
import { ensureProviderWorkspaceFocused } from "./web-chat-workspace.js";

const POLL_INTERVAL_MS = 1_500;
const DEFAULT_MANAGED_GPT_POLL_INTERVAL_MS = 5_000;
const MIN_MANAGED_GPT_POLL_INTERVAL_MS = 1_000;
const MAX_MANAGED_GPT_POLL_INTERVAL_MS = 60_000;
const GEMINI_PICK3_RESPONSE_POLL_INTERVAL_MS = 250;
const STABLE_ROUNDS_REQUIRED = 2;
const MANAGED_GPT_STABLE_DURATION_MS = 3_000;
const PICK3_NO_RESULT_RECOVERY_TIMEOUT_MS = 200_000;

export const resolveManagedGptPollIntervalMs = (
  rawValue = process.env.WEB_CHAT_PATROL_INTERVAL_MS,
): number => {
  if (!rawValue?.trim()) return DEFAULT_MANAGED_GPT_POLL_INTERVAL_MS;
  const parsed = Number(rawValue);
  if (
    !Number.isInteger(parsed)
    || parsed < MIN_MANAGED_GPT_POLL_INTERVAL_MS
    || parsed > MAX_MANAGED_GPT_POLL_INTERVAL_MS
  ) {
    throw new Error(
      `WEB_CHAT_PATROL_INTERVAL_MS must be an integer from ${MIN_MANAGED_GPT_POLL_INTERVAL_MS} to ${MAX_MANAGED_GPT_POLL_INTERVAL_MS}.`,
    );
  }
  return parsed;
};

export const emitWebChatStage = (input: {
  request: AiFeedInput;
  stage: string;
  status: string;
  startedAtMs: number | null;
  refs?: Record<string, unknown>;
}): void => {
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

export const acknowledgeWebChatRateLimitIfVisible = async (input: {
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

const responseTimeoutMs = (request: AiFeedInput): number =>
  isPick3WebChatRequest({ request })
    ? PICK3_NO_RESULT_RECOVERY_TIMEOUT_MS
    : request.timeoutMs;

export const extractWebChatConversation = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  previousAssistantCount: number;
  previousAnswerText: string | null;
}): Promise<{ extracted: WebChatEvaluation; answerText: string }> => {
  await ensureProviderWorkspaceFocused({ ...input, allowAnyProviderTab: false });
  if (!input.context.webChatExecution) {
    await assertActiveProviderPage({
      browser: input.browser,
      providerUrl: input.providerUrl,
      phase: "response capture",
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
  }
  const startedAtMs = Date.now();
  const pollIntervalMs = input.request.providerKind === "gpt-web-chat"
    && input.context.webChatExecution
    ? resolveManagedGptPollIntervalMs()
    : input.request.providerKind === "gemini-web-chat"
      ? GEMINI_PICK3_RESPONSE_POLL_INTERVAL_MS
      : POLL_INTERVAL_MS;
  emitWebChatStage({
    request: input.request,
    stage: "response_capture",
    status: "start",
    startedAtMs: null,
    refs: { pollIntervalMs },
  });
  const extracted = await waitForStableAnswer({
    browser: input.browser,
    context: input.context,
    timeoutMs: responseTimeoutMs(input.request),
    pollIntervalMs,
    stableRoundsRequired: input.request.providerKind === "gemini-web-chat" ? 1 : STABLE_ROUNDS_REQUIRED,
    minStableDurationMs: input.request.providerKind === "gpt-web-chat" && input.context.webChatExecution
      ? MANAGED_GPT_STABLE_DURATION_MS
      : 0,
    ...(input.request.providerKind === "gemini-web-chat" || input.context.webChatExecution ? {} : {
      minAssistantCount: Math.max(1, input.previousAssistantCount + 1),
    }),
    previousAnswerText: input.previousAnswerText,
    beforePoll: () => acknowledgeWebChatRateLimitIfVisible(input),
  });
  emitWebChatStage({
    request: input.request,
    stage: "response_capture",
    status: extracted.status,
    startedAtMs,
    refs: {
      message: extracted.message,
      rawLen: extracted.answerText?.length ?? 0,
      generating: extracted.generating ?? null,
      assistantCount: extracted.assistantCount ?? null,
    },
  });
  return {
    extracted,
    answerText: assertExtracted({ extracted, restoredSourcePage: null }),
  };
};
