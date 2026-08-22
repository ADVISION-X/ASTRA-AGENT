import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";

const MAX_ATTACHMENT_COUNT_WAIT_MS = 120_000;
const CHATGPT_COMPOSER_SELECTOR = "#prompt-textarea";
const CHATGPT_DOCUMENT_FILE_INPUT_SELECTOR = "#upload-files";
const CHATGPT_COMPOSER_FORM_SELECTOR = "form";
const CHATGPT_REMOVE_ATTACHMENT_SELECTOR = "form button[aria-label='Remove file'],form button[aria-label='移除文件'],form button[aria-label='删除文件']";
const CHATGPT_SEND_SELECTOR = "#composer-submit-button[data-testid='send-button']";

export type AttachmentBrowser = Pick<BrowserTargetLease, "executeDomIntent" | "wait">;

type ExactAttachmentStateOptions = {
  expectedPageUrl?: string | null;
  baselineAttachmentCount?: number;
  requireReady?: boolean;
  requireComposerTextEmpty?: boolean;
};

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("BROWSER_TARGET_INVALID");
  return value as Record<string, unknown>;
};

const documentState = async (browser: AttachmentBrowser): Promise<{ url: string; title: string }> => {
  const value = record(await browser.executeDomIntent({ kind: "document" }));
  if (typeof value.url !== "string" || typeof value.title !== "string" || !value.url.startsWith("https://")) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return { url: value.url, title: value.title };
};

const inspect = async (browser: AttachmentBrowser, selector: string): Promise<Record<string, unknown>> =>
  record(await browser.executeDomIntent({
    kind: "inspect",
    selector,
    fields: ["tagName", "type", "text", "accept", "multiple", "connected", "disabled", "visible"],
  }));

const inspectKnownChatGptComposer = async (browser: AttachmentBrowser): Promise<{ pageUrl: string; composer: Record<string, unknown>; fileInput: Record<string, unknown> }> => {
  const { url } = await documentState(browser);
  const composer = await inspect(browser, CHATGPT_COMPOSER_SELECTOR);
  const fileInput = await inspect(browser, CHATGPT_DOCUMENT_FILE_INPUT_SELECTOR);
  return { pageUrl: url, composer, fileInput };
};

const count = async (browser: AttachmentBrowser, selector: string): Promise<number> => {
  const value = record(await browser.executeDomIntent({ kind: "find", selector, maxMatches: 20 }));
  if (!Number.isInteger(value.count) || (value.count as number) < 0) throw new Error("BROWSER_TARGET_INVALID");
  return value.count as number;
};

const readText = async (browser: AttachmentBrowser, selector: string): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readText",
    selector,
    expectedMatches: 1,
    maxChars: 65_536,
  });
  if (typeof value !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return value.trim();
};

const hasExactDocumentInputTopology = (input: Record<string, unknown>): boolean =>
  input.tagName === "INPUT"
  && input.type === "file"
  && input.accept === ""
  && input.multiple === true
  && input.connected === true
  && input.disabled === false;

const emptyAttachmentState = (
  pageUrl: string,
  composerTextLength: number,
): WebChatEvaluation => ({
  status: "success",
  message: "exact ChatGPT composer and document-file input preflight verified",
  pageUrl,
  attachmentCount: 0,
  attachmentNames: [],
  attachmentScope: "composer",
  composerCandidateCount: 1,
  composerRootCount: 1,
  conversationTurnCountInScope: 0,
  generalFileInputCount: 1,
  imageFileInputCountInScope: 0,
  pendingAttachmentCount: 0,
  sendReady: false,
  composerTextLength,
});

const evaluateObservedAttachmentSet = (input: Readonly<{
  pageUrl: string;
  composerTextLength: number;
  expectedCount: number;
  matchedNames: readonly string[];
  removeCount: number;
  sendReady: boolean;
  requireReady: boolean;
}>): WebChatEvaluation => {
  const common = {
    pageUrl: input.pageUrl,
    attachmentCount: input.removeCount,
    attachmentNames: [...input.matchedNames],
  };
  if (input.removeCount > input.expectedCount || input.matchedNames.length > input.expectedCount) {
    return { status: "review_required", message: "CHATGPT_ATTACHMENT_SET_AMBIGUOUS", ...common };
  }
  if (input.removeCount !== input.expectedCount
    || input.matchedNames.length !== input.expectedCount
    || (input.requireReady && !input.sendReady)) {
    return { status: "pending", message: "waiting for the exact ChatGPT attachment set to stabilize", ...common, sendReady: input.sendReady };
  }
  return {
    status: "success",
    message: "exact ChatGPT attachment set, file names and enabled send control verified",
    ...common,
    attachmentScope: "composer",
    composerCandidateCount: 1,
    composerRootCount: 1,
    conversationTurnCountInScope: 0,
    generalFileInputCount: 1,
    imageFileInputCountInScope: 0,
    pendingAttachmentCount: input.removeCount,
    sendReady: input.sendReady,
    composerTextLength: input.composerTextLength,
  };
};

const inspectObservedAttachmentSet = async (
  browser: AttachmentBrowser,
  pageUrl: string,
  composerTextLength: number,
  expectedCount: number,
  expectedFileNames: readonly string[],
  requireReady: boolean,
): Promise<WebChatEvaluation> => {
  const formText = await readText(browser, CHATGPT_COMPOSER_FORM_SELECTOR);
  const removeCount = await count(browser, CHATGPT_REMOVE_ATTACHMENT_SELECTOR);
  const send = await inspect(browser, CHATGPT_SEND_SELECTOR);
  return evaluateObservedAttachmentSet({
    pageUrl,
    composerTextLength,
    expectedCount,
    matchedNames: expectedFileNames.filter((fileName) => formText.includes(fileName)),
    removeCount,
    sendReady: send.tagName === "BUTTON" && send.visible === true && send.disabled === false,
    requireReady,
  });
};

const evaluateKnownAttachmentPreflight = async (
  browser: AttachmentBrowser,
  expectedCount: number,
  expectedFileNames: readonly string[],
  options: ExactAttachmentStateOptions,
): Promise<WebChatEvaluation> => {
  const observed = await inspectKnownChatGptComposer(browser);
  if (options.expectedPageUrl && observed.pageUrl !== options.expectedPageUrl) {
    return { status: "review_required", message: "WEB_CHAT_PROVIDER_IDENTITY_DRIFT", pageUrl: observed.pageUrl };
  }
  if (observed.composer.tagName !== "DIV" || observed.composer.disabled === true) {
    return { status: "review_required", message: "CHATGPT_COMPOSER_INVALID", pageUrl: observed.pageUrl };
  }
  if (!hasExactDocumentInputTopology(observed.fileInput)) {
    return { status: "review_required", message: "CHATGPT_DOCUMENT_FILE_INPUT_AMBIGUOUS", pageUrl: observed.pageUrl };
  }
  const composerText = typeof observed.composer.text === "string" ? observed.composer.text.trim() : "";
  if (options.requireComposerTextEmpty && composerText.length > 0) {
    return { status: "review_required", message: "WEB_CHAT_COMPOSER_NOT_EMPTY", pageUrl: observed.pageUrl, composerText };
  }
  if (expectedCount === 0) return emptyAttachmentState(observed.pageUrl, composerText.length);
  return inspectObservedAttachmentSet(
    browser,
    observed.pageUrl,
    composerText.length,
    expectedCount,
    expectedFileNames,
    options.requireReady === true,
  );
};

export const readExactAttachmentState = (
  browser: AttachmentBrowser,
  _context: AiProviderAdapterContext,
  expectedCount: number,
  expectedFileNames: readonly string[],
  options: ExactAttachmentStateOptions = {},
): Promise<WebChatEvaluation> => evaluateKnownAttachmentPreflight(browser, expectedCount, expectedFileNames, options);

/** Unknown drafts are never cleared. This only admits a already-empty composer. */
export const clearComposer = async (
  browser: AttachmentBrowser,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> => readExactAttachmentState(browser, context, 0, [], { requireComposerTextEmpty: true });

const throwIfTerminalAttachmentEvaluation = (input: {
  evaluation: WebChatEvaluation;
  expectedCount: number;
  expectedFileNames: readonly string[];
}): void => {
  if (input.evaluation.status !== "review_required" && input.evaluation.status !== "failed") return;
  throw new Error(`${input.evaluation.message}; step=${input.expectedCount}; expected_files=${input.expectedFileNames.join("|")}; page_url=${input.evaluation.pageUrl ?? "unknown"}`);
};

export const waitForExactAttachmentCount = async (
  browser: AttachmentBrowser,
  context: AiProviderAdapterContext,
  expectedCount: number,
  expectedFileNames: readonly string[],
  timeoutMs: number,
  options: ExactAttachmentStateOptions = {},
): Promise<WebChatEvaluation> => {
  const deadline = Date.now() + Math.min(timeoutMs, MAX_ATTACHMENT_COUNT_WAIT_MS);
  while (Date.now() < deadline) {
    const evaluation = await readExactAttachmentState(browser, context, expectedCount, expectedFileNames, options);
    if (evaluation.status === "success") return evaluation;
    throwIfTerminalAttachmentEvaluation({ evaluation, expectedCount, expectedFileNames });
    await browser.wait({ durationMs: 250 });
  }
  throw new Error(`GPT_ATTACHMENT_COUNT_MISMATCH; expected_count=${expectedCount}; expected_files=${expectedFileNames.join("|")}`);
};
