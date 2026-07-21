import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import {
  EXTRACT_LAST_RESPONSE_SCRIPT,
  type WebChatEvaluation,
} from "./web-chat-evaluation.js";

type StableAnswerState = {
  lastText: string;
  lastGenerating: boolean;
  lastAssistantCount: number;
  stableRounds: number;
  seenGenerating: boolean;
  lastActivityAt: number;
};

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
  && /missing value|execution context|navigation|loading|not valid JSON|active-tab evaluation.*timed out/iu.test(error.message);

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

const isPreviousStableAnswer = (input: {
  currentAnswerText: string;
  previousAnswerText: string | null | undefined;
  seenGenerating: boolean;
}): boolean =>
  Boolean(
    input.previousAnswerText
      && input.currentAnswerText === input.previousAnswerText.trim()
      && !input.seenGenerating,
  );

const hasAnswerProgressWithoutAssistantCount = (input: {
  currentAnswerText: string;
  previousAnswerText: string | null | undefined;
  seenGenerating: boolean;
}): boolean => {
  if (input.currentAnswerText.length === 0) return false;
  const previousAnswerText = input.previousAnswerText?.trim() ?? "";
  return input.seenGenerating || previousAnswerText.length === 0 || input.currentAnswerText !== previousAnswerText;
};

export const createStableAnswerState = (): StableAnswerState => ({
  lastText: "",
  lastGenerating: false,
  lastAssistantCount: 0,
  stableRounds: 0,
  seenGenerating: false,
  lastActivityAt: Date.now(),
});

const hasEvaluationActivity = (input: {
  evaluation: WebChatEvaluation;
  state: StableAnswerState;
}): boolean => {
  const answerText = input.evaluation.answerText?.trim() ?? "";
  const assistantCount = input.evaluation.assistantCount ?? input.state.lastAssistantCount;
  return input.evaluation.generating === true
    || (answerText.length > 0 && answerText !== input.state.lastText)
    || assistantCount > input.state.lastAssistantCount;
};

export const noteStableAnswerActivity = (input: {
  evaluation: WebChatEvaluation;
  state: StableAnswerState;
  now: number;
}): boolean => {
  if (!hasEvaluationActivity({ evaluation: input.evaluation, state: input.state })) {
    return false;
  }
  input.state.lastActivityAt = input.now;
  return true;
};

export const readAnswerEvaluation = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  pollIntervalMs: number;
}): Promise<WebChatEvaluation | null> => {
  try {
    return await extractAnswer(input.browser, input.context);
  } catch (error) {
    if (!isTransientNavigationExtractionError(error)) {
      throw error;
    }
    await input.browser.wait(input.pollIntervalMs);
    return null;
  }
};

export const advanceStableAnswer = (input: {
  evaluation: WebChatEvaluation;
  stableRoundsRequired: number;
  state: StableAnswerState;
}): { nextState: StableAnswerState; successEvaluation: WebChatEvaluation | null } => {
  const nextState = { ...input.state, lastGenerating: input.evaluation.generating === true };
  const progress = updateStableAnswerState({
    evaluation: input.evaluation,
    lastText: nextState.lastText,
    stableRounds: nextState.stableRounds,
  });
  nextState.lastText = progress.lastText;
  nextState.stableRounds = progress.stableRounds;
  if (
    progress.answerText.length > 0
    && progress.stableRounds >= input.stableRoundsRequired
    && input.evaluation.generating !== true
  ) {
    return {
      nextState,
      successEvaluation: {
        ...input.evaluation,
        status: "success",
        answerText: progress.answerText,
      },
    };
  }
  return { nextState, successEvaluation: null };
};

export const buildTimedOutAnswerEvaluation = (
  browser: BrowserController,
  lastText: string,
  lastGenerating: boolean,
  lastAssistantCount: number,
): WebChatEvaluation => ({
  status: lastText && !lastGenerating ? "success" : "failed",
  message: lastText && !lastGenerating
    ? "answer extracted at timeout boundary"
    : "GPT_RESPONSE_TIMEOUT; provider response polling timed out",
  answerText: lastText || null,
  pageUrl: browser.getSessionState().currentUrl,
  generating: lastGenerating,
  assistantCount: lastAssistantCount,
});

export const shouldContinueWaiting = async (input: {
  browser: BrowserController;
  evaluation: WebChatEvaluation;
  minAssistantCount: number | undefined;
  pollIntervalMs: number;
  previousAnswerText: string | null | undefined;
  state: StableAnswerState;
}): Promise<boolean> => {
  input.state.lastAssistantCount = input.evaluation.assistantCount ?? input.state.lastAssistantCount;
  if (input.evaluation.generating === true) input.state.seenGenerating = true;
  const currentAnswerText = input.evaluation.answerText?.trim() ?? "";
  if (
    input.minAssistantCount !== undefined
    && input.state.lastAssistantCount < input.minAssistantCount
    && !hasAnswerProgressWithoutAssistantCount({
      currentAnswerText,
      previousAnswerText: input.previousAnswerText,
      seenGenerating: input.state.seenGenerating,
    })
  ) {
    await input.browser.wait(input.pollIntervalMs);
    return true;
  }
  if (
    isPreviousStableAnswer({
      currentAnswerText,
      previousAnswerText: input.previousAnswerText,
      seenGenerating: input.state.seenGenerating,
    })
  ) {
    await input.browser.wait(input.pollIntervalMs);
    return true;
  }
  return false;
};
