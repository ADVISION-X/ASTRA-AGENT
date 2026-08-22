import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import { recordWebChatPageAction } from "./web-chat-page-action-contract.js";

const CHATGPT_COMPOSER_SELECTOR = "#prompt-textarea";
const CHATGPT_SEND_SELECTOR = "#composer-submit-button[data-testid='send-button']";

const inspectComposer = async (browser: BrowserTargetLease): Promise<Record<string, unknown>> => {
  const value = await browser.executeDomIntent({
    kind: "inspect",
    selector: CHATGPT_COMPOSER_SELECTOR,
    fields: ["tagName", "text", "visible", "disabled"],
  });
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("BROWSER_TARGET_INVALID");
  return value as Record<string, unknown>;
};

const documentUrl = async (browser: BrowserTargetLease): Promise<string> => {
  const value = await browser.executeDomIntent({ kind: "document" });
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || typeof (value as { url?: unknown }).url !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return (value as { url: string }).url;
};

export const focusComposer = async (browser: BrowserTargetLease, context: AiProviderAdapterContext): Promise<WebChatEvaluation> => {
  const startedAt = new Date().toISOString();
  const beforeUrl = await documentUrl(browser);
  await browser.executeDomIntent({ kind: "click", selector: CHATGPT_COMPOSER_SELECTOR, expectedMatches: 1 });
  const composer = await inspectComposer(browser);
  if (composer.tagName !== "DIV" || composer.visible !== true || composer.disabled === true) {
    return { status: "review_required", message: "CHATGPT_COMPOSER_INVALID" };
  }
  const afterUrl = await documentUrl(browser);
  if (afterUrl !== beforeUrl) return { status: "review_required", message: "CHATGPT_COMPOSER_DOCUMENT_DRIFT", pageUrl: afterUrl };
  await recordWebChatPageAction({
    browser,
    context,
    actionId: "focus_exact_composer",
    startedAt,
    beforeUrl,
    afterUrl,
    result: "committed",
    candidateCount: 1,
    semantics: ["one visible enabled composer", "same provider document"],
  });
  return { status: "success", message: "exact ChatGPT composer focused", inputFocused: true, pageUrl: afterUrl };
};

export const clickChatGptSendButton = async (browser: BrowserTargetLease, _context: AiProviderAdapterContext): Promise<WebChatEvaluation & Readonly<{
  actionStartedAt?: string;
  beforeUrl?: string;
}>> => {
  const actionStartedAt = new Date().toISOString();
  const beforeUrl = await documentUrl(browser);
  const inspection = await browser.executeDomIntent({
    kind: "inspect",
    selector: CHATGPT_SEND_SELECTOR,
    fields: ["tagName", "visible", "disabled"],
  });
  if (typeof inspection !== "object" || inspection === null || Array.isArray(inspection)
    || (inspection as Record<string, unknown>).tagName !== "BUTTON"
    || (inspection as Record<string, unknown>).visible !== true
    || (inspection as Record<string, unknown>).disabled === true) {
    return { status: "review_required", message: "CHATGPT_SEND_BUTTON_INVALID" };
  }
  await browser.executeDomIntent({ kind: "click", selector: CHATGPT_SEND_SELECTOR, expectedMatches: 1 });
  return { status: "success", message: "exact ChatGPT send button clicked", actionStartedAt, beforeUrl };
};
