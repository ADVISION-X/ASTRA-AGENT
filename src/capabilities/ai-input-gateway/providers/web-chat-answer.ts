import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import {
  advanceStableAnswer,
  buildTimedOutAnswerEvaluation,
  createStableAnswerState,
  isTransientNavigationExtractionError,
  noteStableAnswerActivity,
  readAnswerEvaluation,
  shouldContinueWaiting,
} from "./web-chat-answer-support.js";

type WaitForStableAnswerInput = {
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  timeoutMs: number;
  pollIntervalMs: number;
  stableRoundsRequired: number;
  minStableDurationMs?: number;
  minAssistantCount?: number;
  beforePoll?: () => Promise<unknown>;
  previousAnswerText?: string | null;
};

export const waitForStableAnswer = async (input: WaitForStableAnswerInput): Promise<WebChatEvaluation> => {
  const startedAt = Date.now();
  let idleDeadline = startedAt + input.timeoutMs;
  const hardDeadline = startedAt + Math.max(input.timeoutMs * 2, input.timeoutMs + 60_000);
  let state = createStableAnswerState();
  while (Date.now() < idleDeadline && Date.now() < hardDeadline) {
    try {
      await input.beforePoll?.();
    } catch (error) {
      if (!isTransientNavigationExtractionError(error)) throw error;
      await input.browser.wait(input.pollIntervalMs);
      continue;
    }
    const evaluation = await readAnswerEvaluation(input);
    if (!evaluation) continue;
    const now = Date.now();
    if (noteStableAnswerActivity({ evaluation, state, now })) {
      idleDeadline = now + input.timeoutMs;
    }
    if (evaluation.status === "review_required" || evaluation.status === "failed") return evaluation;
    if (
      await shouldContinueWaiting({
        browser: input.browser,
        evaluation,
        minAssistantCount: input.minAssistantCount,
        pollIntervalMs: input.pollIntervalMs,
        previousAnswerText: input.previousAnswerText,
        state,
      })
    ) {
      continue;
    }
    const progress = advanceStableAnswer({
      evaluation,
      minStableDurationMs: input.minStableDurationMs ?? 0,
      now,
      stableRoundsRequired: input.stableRoundsRequired,
      state,
    });
    state = progress.nextState;
    if (progress.successEvaluation) return progress.successEvaluation;
    await input.browser.wait(input.pollIntervalMs);
  }
  return buildTimedOutAnswerEvaluation(
    input.browser,
    state.lastText,
    state.lastGenerating,
    state.lastAssistantCount,
  );
};

export const assertExtracted = (input: {
  extracted: WebChatEvaluation;
  restoredSourcePage: boolean | null;
}): string => {
  if (input.extracted.status === "success" && input.extracted.answerText) {
    return input.extracted.answerText;
  }
  throw new Error(`${input.extracted.status}: ${input.extracted.message}; restoredSourcePage=${String(input.restoredSourcePage)}`);
};
