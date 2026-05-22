import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatEvaluation } from "./web-chat-evaluation.js";
import {
  advanceStableAnswer,
  buildTimedOutAnswerEvaluation,
  createStableAnswerState,
  readAnswerEvaluation,
  shouldContinueWaiting,
} from "./web-chat-answer-support.js";

type WaitForStableAnswerInput = {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  timeoutMs: number;
  pollIntervalMs: number;
  stableRoundsRequired: number;
  minAssistantCount?: number;
  previousAnswerText?: string | null;
};

export const waitForStableAnswer = async (input: WaitForStableAnswerInput): Promise<WebChatEvaluation> => {
  const deadline = Date.now() + input.timeoutMs;
  let state = createStableAnswerState();
  while (Date.now() < deadline) {
    const evaluation = await readAnswerEvaluation(input);
    if (!evaluation) continue;
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
