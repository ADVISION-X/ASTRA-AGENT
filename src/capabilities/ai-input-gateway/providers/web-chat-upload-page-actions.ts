import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";

const MAX_ATTACHMENT_COUNT_WAIT_MS = 120_000;
const CHATGPT_COMPOSER_SELECTOR = "#prompt-textarea";
const CHATGPT_DOCUMENT_FILE_INPUT_SELECTOR = "#upload-files";

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
  const [composer, fileInput] = await Promise.all([
    inspect(browser, CHATGPT_COMPOSER_SELECTOR),
    inspect(browser, CHATGPT_DOCUMENT_FILE_INPUT_SELECTOR),
  ]);
  return { pageUrl: url, composer, fileInput };
};

const hasExactDocumentInputTopology = (input: Record<string, unknown>): boolean =>
  input.tagName === "INPUT"
  && input.type === "file"
  && input.accept === ""
  && input.multiple === true
  && input.connected === true
  && input.disabled === false;

const evaluateKnownAttachmentPreflight = async (browser: AttachmentBrowser, expectedCount: number, options: ExactAttachmentStateOptions): Promise<WebChatEvaluation> => {
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
  if (expectedCount === 0) {
    return {
      status: "success",
      message: "exact ChatGPT composer and document-file input preflight verified",
      pageUrl: observed.pageUrl,
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
      composerTextLength: composerText.length,
    };
  }
  return {
    status: "review_required",
    message: "NOT_PRODUCTION_VERIFIED: exact ChatGPT attachment-name and stability DOM has not been observed on the approved Chrome construction path",
    pageUrl: observed.pageUrl,
  };
};

export const readExactAttachmentState = (
  browser: AttachmentBrowser,
  _context: AiProviderAdapterContext,
  expectedCount: number,
  _expectedFileNames: readonly string[],
  options: ExactAttachmentStateOptions = {},
): Promise<WebChatEvaluation> => evaluateKnownAttachmentPreflight(browser, expectedCount, options);

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
