import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";

type AnswerBrowser = Pick<BrowserTargetLease, "executeDomIntent" | "wait">;

type StableAnswerState = {
  lastText: string;
  lastGenerating: boolean;
  lastAssistantCount: number;
  stableRounds: number;
  seenGenerating: boolean;
  lastActivityAt: number;
  lastPageUrl: string | null;
};

const CHATGPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";
const CHATGPT_ASSISTANT_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='assistant']";
const CHATGPT_STOP_SELECTOR = "button[aria-label*='Stop'],button[aria-label*='停止']";

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("BROWSER_TARGET_INVALID");
  return value as Record<string, unknown>;
};

const readCount = async (browser: AnswerBrowser, selector: string, maxMatches: number, textContains?: string): Promise<number> => {
  const result = asRecord(await browser.executeDomIntent({
    kind: "find",
    selector,
    maxMatches,
    ...(textContains === undefined ? {} : { textContains }),
  }));
  if (typeof result.count !== "number" || !Number.isInteger(result.count) || result.count < 0) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return result.count;
};

const readDocument = async (browser: AnswerBrowser): Promise<{ url: string; title: string }> => {
  const result = asRecord(await browser.executeDomIntent({ kind: "document" }));
  if (typeof result.url !== "string" || typeof result.title !== "string" || !result.url.startsWith("https://")) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return { url: result.url, title: result.title };
};

const readText = async (browser: AnswerBrowser, input: {
  selector: string;
  expectedMatches?: number;
  maxMatches?: number;
  matchIndex?: number;
}): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readText",
    selector: input.selector,
    maxChars: 65_536,
    ...(input.expectedMatches === undefined ? {} : { expectedMatches: input.expectedMatches }),
    ...(input.maxMatches === undefined ? {} : { maxMatches: input.maxMatches }),
    ...(input.matchIndex === undefined ? {} : { matchIndex: input.matchIndex }),
  });
  if (typeof value !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return value.trim();
};

const readAttribute = async (browser: AnswerBrowser, input: {
  selector: string;
  name: string;
  textContains: string;
}): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readAttribute",
    selector: input.selector,
    name: input.name,
    textContains: input.textContains,
    expectedMatches: 1,
    maxChars: 256,
  });
  if (typeof value !== "string" || value.length === 0) throw new Error("BROWSER_TARGET_INVALID");
  return value;
};

const turnOrdinal = (testId: string): number => {
  const match = /^conversation-turn-([1-9][0-9]*)$/u.exec(testId);
  if (!match) throw new Error("BROWSER_TARGET_INVALID");
  const ordinal = Number(match[1]);
  if (!Number.isSafeInteger(ordinal)) throw new Error("BROWSER_TARGET_INVALID");
  return ordinal;
};

const currentGenerationState = async (browser: AnswerBrowser): Promise<boolean> =>
  (await readCount(browser, CHATGPT_STOP_SELECTOR, 1)) === 1;

type EvaluationSnapshot = {
  document: { url: string; title: string };
  userMessageCount: number;
  assistantCount: number;
  generating: boolean;
};

const buildMarkedEvaluation = async (input: {
  browser: AnswerBrowser;
  marker: string;
  snapshot: EvaluationSnapshot;
}): Promise<WebChatEvaluation> => {
  const markedUserCount = await readCount(
    input.browser,
    CHATGPT_USER_TURN_SELECTOR,
    1,
    input.marker,
  );
  if (markedUserCount === 0) {
    return {
      status: "pending",
      message: "exact marked ChatGPT user turn is not materialized yet",
      pageUrl: input.snapshot.document.url,
      generating: input.snapshot.generating,
      assistantCount: input.snapshot.assistantCount,
      userMessageCount: input.snapshot.userMessageCount,
    };
  }
  const userTurnId = await readAttribute(input.browser, {
    selector: CHATGPT_USER_TURN_SELECTOR,
    name: "data-testid",
    textContains: input.marker,
  });
  const assistantTurnId = `conversation-turn-${turnOrdinal(userTurnId) + 1}`;
  const assistantSelector = `[data-testid=${JSON.stringify(assistantTurnId)}][data-turn='assistant']`;
  const immediateAssistantCount = await readCount(input.browser, assistantSelector, 1);
  if (immediateAssistantCount === 0) {
    return {
      status: "pending",
      message: "exact assistant turn immediately following the marked ChatGPT user turn is not materialized yet",
      pageUrl: input.snapshot.document.url,
      generating: input.snapshot.generating,
      assistantCount: input.snapshot.assistantCount,
      userMessageCount: input.snapshot.userMessageCount,
      conversationTurnIds: [userTurnId],
    };
  }
  const answerText = await readText(input.browser, { selector: assistantSelector, expectedMatches: 1 });
  return {
    status: input.snapshot.generating ? "pending" : "success",
    message: input.snapshot.generating
      ? "exact marked ChatGPT assistant turn is still generating"
      : "exact marked ChatGPT assistant turn is stable",
    answerText,
    pageUrl: input.snapshot.document.url,
    generating: input.snapshot.generating,
    assistantCount: input.snapshot.assistantCount,
    userMessageCount: input.snapshot.userMessageCount,
    conversationTurnIds: [userTurnId, assistantTurnId],
  };
};

const buildLatestEvaluation = async (input: {
  browser: AnswerBrowser;
  snapshot: EvaluationSnapshot;
}): Promise<WebChatEvaluation> => {
  if (input.snapshot.assistantCount === 0) {
    return {
      status: "pending",
      message: "provider has no assistant turn yet",
      pageUrl: input.snapshot.document.url,
      generating: input.snapshot.generating,
      assistantCount: input.snapshot.assistantCount,
      userMessageCount: input.snapshot.userMessageCount,
    };
  }
  const answerText = await readText(input.browser, {
    selector: CHATGPT_ASSISTANT_TURN_SELECTOR,
    maxMatches: 20,
    matchIndex: input.snapshot.assistantCount - 1,
  });
  return {
    status: input.snapshot.generating ? "pending" : "success",
    message: input.snapshot.generating
      ? "latest ChatGPT assistant turn is still generating"
      : "latest ChatGPT assistant turn is stable",
    answerText,
    pageUrl: input.snapshot.document.url,
    generating: input.snapshot.generating,
    assistantCount: input.snapshot.assistantCount,
    userMessageCount: input.snapshot.userMessageCount,
  };
};

const buildEvaluation = async (input: {
  browser: AnswerBrowser;
  marker: string | null;
}): Promise<WebChatEvaluation> => {
  const document = await readDocument(input.browser);
  const snapshot: EvaluationSnapshot = {
    document,
    userMessageCount: await readCount(input.browser, CHATGPT_USER_TURN_SELECTOR, 20),
    assistantCount: await readCount(input.browser, CHATGPT_ASSISTANT_TURN_SELECTOR, 20),
    generating: await currentGenerationState(input.browser),
  };
  if (input.marker) {
    return buildMarkedEvaluation({ browser: input.browser, marker: input.marker, snapshot });
  }
  return buildLatestEvaluation({ browser: input.browser, snapshot });
};

const extractAnswer = (browser: AnswerBrowser, context: AiProviderAdapterContext): Promise<WebChatEvaluation> => {
  if (context.webChatExecution?.providerKind === "gemini-web-chat") {
    return Promise.resolve({
      status: "review_required",
      message: "NOT_PRODUCTION_VERIFIED: Gemini response DOM has not been observed on the approved Chrome construction path",
    });
  }
  return buildEvaluation({ browser, marker: context.webChatExecution?.turnMarker ?? null });
};

export const isTransientNavigationExtractionError = (error: unknown): boolean =>
  error instanceof Error
  && /missing value|navigation|loading|BROWSER_DOCUMENT_INVALID|WEB_CHAT_BOUND_CONVERSATION_NOT_READY/iu.test(error.message);

const updateStableAnswerState = (input: {
  evaluation: WebChatEvaluation;
  lastText: string;
  stableRounds: number;
}) => {
  const answerText = input.evaluation.answerText?.trim() ?? "";
  if (answerText.length > 0 && answerText === input.lastText && input.evaluation.generating !== true) {
    return { answerText, lastText: input.lastText, stableRounds: input.stableRounds + 1 };
  }
  if (answerText.length > 0) return { answerText, lastText: answerText, stableRounds: 1 };
  return { answerText, lastText: input.lastText, stableRounds: input.stableRounds };
};

const isPreviousStableAnswer = (input: {
  currentAnswerText: string;
  previousAnswerText: string | null | undefined;
  seenGenerating: boolean;
}): boolean => Boolean(
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
  lastPageUrl: null,
});

const hasEvaluationActivity = (input: { evaluation: WebChatEvaluation; state: StableAnswerState }): boolean => {
  const answerText = input.evaluation.answerText?.trim() ?? "";
  const assistantCount = input.evaluation.assistantCount ?? input.state.lastAssistantCount;
  return input.evaluation.generating === true
    || (answerText.length > 0 && answerText !== input.state.lastText)
    || assistantCount > input.state.lastAssistantCount;
};

export const noteStableAnswerActivity = (input: { evaluation: WebChatEvaluation; state: StableAnswerState; now: number }): boolean => {
  if (input.evaluation.pageUrl) input.state.lastPageUrl = input.evaluation.pageUrl;
  if (!hasEvaluationActivity({ evaluation: input.evaluation, state: input.state })) return false;
  input.state.lastActivityAt = input.now;
  return true;
};

export const readAnswerEvaluation = async (input: {
  browser: AnswerBrowser;
  context: AiProviderAdapterContext;
  pollIntervalMs: number;
}): Promise<WebChatEvaluation | null> => {
  try {
    return await extractAnswer(input.browser, input.context);
  } catch (error) {
    if (!isTransientNavigationExtractionError(error)) throw error;
    await input.browser.wait({ durationMs: input.pollIntervalMs });
    return null;
  }
};

export const advanceStableAnswer = (input: {
  evaluation: WebChatEvaluation;
  minStableDurationMs: number;
  now: number;
  stableRoundsRequired: number;
  state: StableAnswerState;
}): { nextState: StableAnswerState; successEvaluation: WebChatEvaluation | null } => {
  const nextState = { ...input.state, lastGenerating: input.evaluation.generating === true };
  const progress = updateStableAnswerState({ evaluation: input.evaluation, lastText: nextState.lastText, stableRounds: nextState.stableRounds });
  nextState.lastText = progress.lastText;
  nextState.stableRounds = progress.stableRounds;
  if (progress.answerText.length > 0 && progress.stableRounds >= input.stableRoundsRequired
    && input.evaluation.generating !== true && input.now - nextState.lastActivityAt >= input.minStableDurationMs) {
    return { nextState, successEvaluation: { ...input.evaluation, status: "success", answerText: progress.answerText } };
  }
  return { nextState, successEvaluation: null };
};

export const buildTimedOutAnswerEvaluation = (input: {
  lastText: string;
  lastGenerating: boolean;
  lastAssistantCount: number;
  lastPageUrl: string | null;
}): WebChatEvaluation => ({
  status: input.lastText && !input.lastGenerating ? "success" : "failed",
  message: input.lastText && !input.lastGenerating ? "answer extracted at timeout boundary" : "GPT_RESPONSE_TIMEOUT; provider response polling timed out",
  answerText: input.lastText || null,
  pageUrl: input.lastPageUrl,
  generating: input.lastGenerating,
  assistantCount: input.lastAssistantCount,
});

export const shouldContinueWaiting = async (input: {
  browser: AnswerBrowser;
  evaluation: WebChatEvaluation;
  minAssistantCount: number | undefined;
  pollIntervalMs: number;
  previousAnswerText: string | null | undefined;
  state: StableAnswerState;
}): Promise<boolean> => {
  input.state.lastAssistantCount = input.evaluation.assistantCount ?? input.state.lastAssistantCount;
  if (input.evaluation.generating === true) input.state.seenGenerating = true;
  const currentAnswerText = input.evaluation.answerText?.trim() ?? "";
  if (input.minAssistantCount !== undefined && input.state.lastAssistantCount < input.minAssistantCount
    && !hasAnswerProgressWithoutAssistantCount({ currentAnswerText, previousAnswerText: input.previousAnswerText, seenGenerating: input.state.seenGenerating })) {
    await input.browser.wait({ durationMs: input.pollIntervalMs });
    return true;
  }
  if (isPreviousStableAnswer({ currentAnswerText, previousAnswerText: input.previousAnswerText, seenGenerating: input.state.seenGenerating })) {
    await input.browser.wait({ durationMs: input.pollIntervalMs });
    return true;
  }
  return false;
};
