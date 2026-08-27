import type { GptChildHandlerMap } from "../child-handler.js";
import { executionFailure } from "../../../../lib/typed-failure.js";
import { requireBrowser, requireExactInputKeys, stringInput, success } from "../child-handler.js";
import { findCount, requireOneCandidate } from "../gpt-dom-observation.js";
import {
  GPT_SEARCH_CLOSE_SELECTOR,
  GPT_SEARCH_DIALOG_SELECTOR,
} from "../contracts/conversation-search.contract.js";

const GPT_DIALOG_SELECTOR = "[role='dialog']";
const RATE_LIMIT_TEXT = "使用限制";

const closeSearchDialog = async (browser: ReturnType<typeof requireBrowser>) => {
  const dialogCount = await findCount(browser, { selector: GPT_SEARCH_DIALOG_SELECTOR, maxMatches: 2 });
  if (dialogCount === 0) return success({
    value: { state: "absent" }, candidateCount: 0,
    observedSemantics: ["owned search dialog absent"], committedMutation: "no",
  });
  if (dialogCount !== 1) throw executionFailure("review_required", `GPT_SEARCH_DIALOG_COUNT_${dialogCount}`);
  await requireOneCandidate(browser, { selector: GPT_SEARCH_CLOSE_SELECTOR, maxMatches: 2 });
  await browser.executeDomIntent({ kind: "click", selector: GPT_SEARCH_CLOSE_SELECTOR, expectedMatches: 1 });
  const after = await findCount(browser, { selector: GPT_SEARCH_DIALOG_SELECTOR, maxMatches: 2 });
  if (after !== 0) throw executionFailure("review_required", "GPT_SEARCH_DIALOG_CLOSE_UNCONFIRMED");
  return success({
    value: { state: "closed" }, candidateCount: 1,
    observedSemantics: ["one owned search dialog", "dialog absent after click"], committedMutation: "yes",
  });
};

export const transientUiChildHandlers = {
  async acknowledge_known_gpt_rate_limit(intent, context) {
    requireExactInputKeys(intent, []);
    const browser = requireBrowser(context);
    const count = await findCount(browser, {
      selector: GPT_DIALOG_SELECTOR,
      textContains: RATE_LIMIT_TEXT,
      maxMatches: 2,
    });
    if (count === 0) return success({
      value: { state: "absent" }, candidateCount: 0,
      observedSemantics: ["known rate-limit dialog absent"], committedMutation: "no",
    });
    throw executionFailure("review_required", "GPT_RATE_LIMIT_ACK_NOT_PRODUCTION_VERIFIED");
  },

  async dismiss_known_gpt_search_dialog(intent, context) {
    requireExactInputKeys(intent, []);
    return closeSearchDialog(requireBrowser(context));
  },

  async cleanup_owned_gpt_transient_ui(intent, context) {
    requireExactInputKeys(intent, ["ownedUiKind"]);
    const ownedUiKind = stringInput(intent, "ownedUiKind");
    if (ownedUiKind !== "conversation-search") {
      throw executionFailure("review_required", `GPT_TRANSIENT_UI_NOT_OWNED:${ownedUiKind}`);
    }
    return closeSearchDialog(requireBrowser(context));
  },
} satisfies GptChildHandlerMap;
