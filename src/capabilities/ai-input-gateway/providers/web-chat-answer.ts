import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import {
  EXTRACT_LAST_RESPONSE_SCRIPT,
  type WebChatEvaluation,
} from "./web-chat-evaluation.js";

const extractAnswer = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "extract last AI web chat response",
    script: EXTRACT_LAST_RESPONSE_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

const isTransientNavigationExtractionError = (error: unknown): boolean =>
  error instanceof Error
  && /missing value|execution context|navigation|loading|not valid JSON/iu.test(error.message);

const buildTimedOutAnswerEvaluation = (
  browser: BrowserController,
  lastText: string,
  lastGenerating: boolean,
  lastAssistantCount: number,
): WebChatEvaluation => ({
  status: lastText && !lastGenerating ? "success" : "failed",
  message: lastText && !lastGenerating
    ? "answer extracted at timeout boundary"
    : "provider response polling timed out",
  answerText: lastText || null,
  pageUrl: browser.getSessionState().currentUrl,
  generating: lastGenerating,
  assistantCount: lastAssistantCount,
});

const updateStableAnswerState = (input: {
  evaluation: WebChatEvaluation;
  lastText: string;
  stableRounds: number;
}) => {
  const answerText = input.evaluation.answerText?.trim() ?? "";
  if (answerText.length > 0 && answerText === input.lastText && input.evaluation.generating !== true) {
    return { answerText, lastText: input.lastText, stableRounds: input.stableRounds + 1 };
  }
  if (answerText.length > 0) {
    return { answerText, lastText: answerText, stableRounds: 1 };
  }
  return { answerText, lastText: input.lastText, stableRounds: input.stableRounds };
};

export const waitForStableAnswer = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  timeoutMs: number;
  pollIntervalMs: number;
  stableRoundsRequired: number;
  minAssistantCount?: number;
  previousAnswerText?: string | null;
}): Promise<WebChatEvaluation> => {
  const deadline = Date.now() + input.timeoutMs;
  let lastText = "";
  let lastGenerating = false;
  let lastAssistantCount = 0;
  let stableRounds = 0;
  let seenGenerating = false;
  while (Date.now() < deadline) {
    let evaluation: WebChatEvaluation;
    try {
      evaluation = await extractAnswer(input.browser, input.context);
    } catch (error) {
      if (isTransientNavigationExtractionError(error)) {
        await input.browser.wait(input.pollIntervalMs);
        continue;
      }
      throw error;
    }
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      return evaluation;
    }
    lastAssistantCount = evaluation.assistantCount ?? lastAssistantCount;
    if (input.minAssistantCount !== undefined && lastAssistantCount < input.minAssistantCount) {
      await input.browser.wait(input.pollIntervalMs);
      continue;
    }
    const currentAnswerText = evaluation.answerText?.trim() ?? "";
    if (evaluation.generating === true) seenGenerating = true;
    if (input.previousAnswerText && currentAnswerText === input.previousAnswerText.trim() && !seenGenerating) {
      await input.browser.wait(input.pollIntervalMs);
      continue;
    }
    lastGenerating = evaluation.generating === true;
    const state = updateStableAnswerState({ evaluation, lastText, stableRounds });
    if (state.answerText.length > 0 && state.stableRounds >= input.stableRoundsRequired && evaluation.generating !== true) {
      return { ...evaluation, status: "success", answerText: state.answerText };
    }
    lastText = state.lastText;
    stableRounds = state.stableRounds;
    await input.browser.wait(input.pollIntervalMs);
  }
  return buildTimedOutAnswerEvaluation(input.browser, lastText, lastGenerating, lastAssistantCount);
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
