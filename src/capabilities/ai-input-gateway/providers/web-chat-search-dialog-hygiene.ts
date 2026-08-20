import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";

const CHATGPT_SEARCH_INPUT_SELECTOR = 'input[aria-label="搜索聊天"]';

/**
 * The approved construction evidence has not observed the dialog close
 * control. We can safely prove it absent; if it is present, no guessed escape
 * key or coordinate path may dismiss it.
 */
export const dismissChatGptSearchDialogIfVisible = async (
  browser: BrowserTargetLease,
  _context: Pick<AiProviderAdapterContext, "abortSignal">,
): Promise<"not_found" | "closed"> => {
  const result = await browser.executeDomIntent({
    kind: "find",
    selector: CHATGPT_SEARCH_INPUT_SELECTOR,
    maxMatches: 1,
  });
  if (typeof result !== "object" || result === null || Array.isArray(result)
    || typeof (result as { count?: unknown }).count !== "number") {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  if ((result as { count: number }).count === 0) return "not_found";
  throw new Error("review_required: NOT_PRODUCTION_VERIFIED: ChatGPT Search chats dialog close control is not observed");
};
