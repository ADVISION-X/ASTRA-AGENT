import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import { recordWebChatPageAction } from "./web-chat-page-action-contract.js";

const CHATGPT_SEARCH_DIALOG_SELECTOR = 'div[role="dialog"]';
const CHATGPT_SEARCH_CLOSE_SELECTOR = 'div[role="dialog"] button[aria-label="关闭"]';
const CHATGPT_SEARCH_DIALOG_AMBIGUOUS = "CHATGPT_SEARCH_DIALOG_AMBIGUOUS";
const CHATGPT_SEARCH_DIALOG_CLOSE_AMBIGUOUS = "CHATGPT_SEARCH_DIALOG_CLOSE_AMBIGUOUS";
const CHATGPT_SEARCH_DIALOG_STILL_VISIBLE = "CHATGPT_SEARCH_DIALOG_STILL_VISIBLE";

const readMatchCount = async (browser: BrowserTargetLease, selector: string): Promise<number> => {
  const result = await browser.executeDomIntent({ kind: "find", selector, maxMatches: 2 });
  if (typeof result !== "object" || result === null || Array.isArray(result)
    || typeof (result as { count?: unknown }).count !== "number") {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return (result as { count: number }).count;
};

const requireSingleCloseControl = async (browser: BrowserTargetLease): Promise<void> => {
  if (await readMatchCount(browser, CHATGPT_SEARCH_CLOSE_SELECTOR) !== 1) {
    throw new Error(`review_required: ${CHATGPT_SEARCH_DIALOG_CLOSE_AMBIGUOUS}`);
  }
};

const closeSearchDialog = async (browser: BrowserTargetLease, context: AiProviderAdapterContext): Promise<void> => {
  const startedAt = new Date().toISOString();
  await browser.executeDomIntent({
    kind: "click",
    selector: CHATGPT_SEARCH_CLOSE_SELECTOR,
    expectedMatches: 1,
  });
  if (await readMatchCount(browser, CHATGPT_SEARCH_DIALOG_SELECTOR) !== 0) {
    throw new Error(`review_required: ${CHATGPT_SEARCH_DIALOG_STILL_VISIBLE}`);
  }
  await recordWebChatPageAction({
    browser,
    context,
    actionId: "dismiss_known_search_dialog",
    startedAt,
    beforeUrl: null,
    afterUrl: null,
    result: "committed",
    candidateCount: 1,
    semantics: ["one known search dialog", "one close control", "dialog absent after click"],
  });
};

export const dismissChatGptSearchDialogIfVisible = async (
  browser: BrowserTargetLease,
  context: AiProviderAdapterContext,
): Promise<"not_found" | "closed"> => {
  const dialogCount = await readMatchCount(browser, CHATGPT_SEARCH_DIALOG_SELECTOR);
  if (dialogCount === 0) return "not_found";
  if (dialogCount !== 1) throw new Error(`review_required: ${CHATGPT_SEARCH_DIALOG_AMBIGUOUS}`);
  await requireSingleCloseControl(browser);
  await closeSearchDialog(browser, context);
  return "closed";
};
