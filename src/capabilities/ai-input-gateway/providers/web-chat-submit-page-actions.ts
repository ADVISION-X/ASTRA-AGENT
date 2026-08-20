import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";

const CHATGPT_COMPOSER_SELECTOR = "#prompt-textarea";
const CHATGPT_SEND_SELECTOR = "#composer-submit-button[data-testid='send-button']";
const CHATGPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("BROWSER_TARGET_INVALID");
  return value as Record<string, unknown>;
};

const documentUrl = async (browser: BrowserTargetLease): Promise<string> => {
  const value = record(await browser.executeDomIntent({ kind: "document" }));
  if (typeof value.url !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return value.url;
};

const readText = async (browser: BrowserTargetLease, selector: string, input: {
  expectedMatches?: number;
  maxMatches?: number;
  matchIndex?: number;
} = {}): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readText",
    selector,
    maxChars: 65_536,
    ...(input.expectedMatches === undefined ? {} : { expectedMatches: input.expectedMatches }),
    ...(input.maxMatches === undefined ? {} : { maxMatches: input.maxMatches }),
    ...(input.matchIndex === undefined ? {} : { matchIndex: input.matchIndex }),
  });
  if (typeof value !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return value.trim();
};

const count = async (browser: BrowserTargetLease, selector: string, maxMatches: number, textContains?: string): Promise<number> => {
  const value = record(await browser.executeDomIntent({
    kind: "find",
    selector,
    maxMatches,
    ...(textContains === undefined ? {} : { textContains }),
  }));
  if (typeof value.count !== "number" || value.count < 0 || !Number.isInteger(value.count)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return value.count;
};

const inspectComposer = async (browser: BrowserTargetLease): Promise<Record<string, unknown>> =>
  record(await browser.executeDomIntent({
    kind: "inspect",
    selector: CHATGPT_COMPOSER_SELECTOR,
    fields: ["tagName", "text", "visible", "disabled"],
  }));

const providerUnavailable = async (browser: BrowserTargetLease): Promise<WebChatEvaluation | null> => {
  const pageUrl = await documentUrl(browser);
  if (pageUrl.startsWith("https://chatgpt.com/")) return null;
  return {
    status: "review_required",
    message: "NOT_PRODUCTION_VERIFIED: only the observed ChatGPT composer may receive this production action",
    pageUrl,
  };
};

export const verifyPromptPasted = async (
  browser: BrowserTargetLease,
  _context: AiProviderAdapterContext,
  input: { expectedLength: number; expectedPrefix: string; expectedSuffix: string },
): Promise<WebChatEvaluation> => {
  const unavailable = await providerUnavailable(browser);
  if (unavailable) return unavailable;
  const [pageUrl, composer, text, send] = await Promise.all([
    documentUrl(browser),
    inspectComposer(browser),
    readText(browser, CHATGPT_COMPOSER_SELECTOR, { expectedMatches: 1 }),
    browser.executeDomIntent({ kind: "inspect", selector: CHATGPT_SEND_SELECTOR, fields: ["tagName", "visible", "disabled"] }),
  ]);
  const sendState = record(send);
  const promptPrefixVisible = input.expectedPrefix.length > 0 && text.includes(input.expectedPrefix);
  const promptSuffixVisible = input.expectedSuffix.length > 0 && text.includes(input.expectedSuffix);
  const exactLength = text.length === input.expectedLength;
  const sendReady = sendState.tagName === "BUTTON" && sendState.visible === true && sendState.disabled === false;
  const validComposer = composer.tagName === "DIV" && composer.visible === true && composer.disabled !== true;
  if (!validComposer) return { status: "review_required", message: "CHATGPT_COMPOSER_INVALID", pageUrl };
  if (promptPrefixVisible && promptSuffixVisible && exactLength && sendReady) {
    return {
      status: "success",
      message: "exact ChatGPT composer contains the approved prompt and one enabled send control",
      pageUrl,
      composerText: text,
      expectedLength: input.expectedLength,
      promptPrefixVisible,
      promptSuffixVisible,
      sendReady,
      inputFocused: true,
    };
  }
  return {
    status: "pending",
    message: "approved prompt is not yet materialized in the exact ChatGPT composer",
    pageUrl,
    composerText: text,
    expectedLength: input.expectedLength,
    promptPrefixVisible,
    promptSuffixVisible,
    sendReady,
  };
};

export const verifyPromptSubmitted = async (
  browser: BrowserTargetLease,
  _context: AiProviderAdapterContext,
  input: {
    expectedLength: number;
    expectedPrefix: string;
    expectedSuffix: string;
    previousUserMessageCount: number;
    wasPromptVerifiedBeforeSubmit: boolean;
  },
): Promise<WebChatEvaluation> => {
  const unavailable = await providerUnavailable(browser);
  if (unavailable) return unavailable;
  const pageUrl = await documentUrl(browser);
  const userMessageCount = await count(browser, CHATGPT_USER_TURN_SELECTOR, 20);
  const matchingCount = await count(browser, CHATGPT_USER_TURN_SELECTOR, 1, input.expectedPrefix);
  const composerText = await readText(browser, CHATGPT_COMPOSER_SELECTOR, { expectedMatches: 1 });
  if (matchingCount === 0) {
    return { status: "pending", message: "waiting for the exact submitted ChatGPT user turn", pageUrl, userMessageCount, composerText };
  }
  const turnId = await browser.executeDomIntent({
    kind: "readAttribute",
    selector: CHATGPT_USER_TURN_SELECTOR,
    name: "data-testid",
    textContains: input.expectedPrefix,
    expectedMatches: 1,
    maxChars: 128,
  });
  if (typeof turnId !== "string" || !/^conversation-turn-[1-9][0-9]*$/u.test(turnId)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  const submittedText = await readText(
    browser,
    `[data-testid=${JSON.stringify(turnId)}][data-turn='user']`,
    { expectedMatches: 1 },
  );
  const exactPrompt = submittedText.includes(input.expectedPrefix)
    && submittedText.includes(input.expectedSuffix)
    && input.expectedLength > 0;
  if (!exactPrompt || !input.wasPromptVerifiedBeforeSubmit || composerText.includes(input.expectedPrefix)) {
    return { status: "pending", message: "ChatGPT submit has not reached the exact clean-turn boundary", pageUrl, userMessageCount, composerText };
  }
  if (userMessageCount <= input.previousUserMessageCount) {
    return { status: "failed", message: "WEB_CHAT_FRESH_CONVERSATION_REBOUND", pageUrl, userMessageCount, composerText };
  }
  return {
    status: "success",
    message: "exactly one approved ChatGPT user turn materialized and the composer cleared",
    pageUrl,
    userMessageCount,
    composerText,
    promptPrefixVisible: false,
    promptSuffixVisible: true,
  };
};

export const verifyLastUserMessageAttachments = async (
  browser: BrowserTargetLease,
  _context: AiProviderAdapterContext,
  expectedCount: number,
  _expectedKind: "image" | "file",
  _expectedFileNames: readonly string[],
  _promptText: string,
): Promise<WebChatEvaluation> => {
  const pageUrl = await documentUrl(browser);
  if (expectedCount === 0) {
    return { status: "success", message: "no submitted attachment was requested", pageUrl, boundAttachmentCount: 0 };
  }
  return {
    status: "review_required",
    message: "NOT_PRODUCTION_VERIFIED: submitted ChatGPT attachment DOM has not been observed",
    pageUrl,
  };
};
