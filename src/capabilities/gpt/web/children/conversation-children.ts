import { createHash } from "node:crypto";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
} from "../child-handler.js";
import {
  findCount,
  readExactAttribute,
  readGptDocument,
  requireOneCandidate,
} from "../gpt-dom-observation.js";
import {
  GPT_FORK_CONTROL_SELECTOR,
  GPT_GENERATING_STOP_SELECTOR,
  GPT_USER_TURN_SELECTOR,
} from "../contracts/conversation.contract.js";
import {
  GPT_SEARCH_BUTTON_SELECTOR,
  GPT_SEARCH_DIALOG_SELECTOR,
  GPT_SEARCH_INPUT_SELECTOR,
  GPT_SEARCH_RESULT_SELECTOR,
} from "../contracts/conversation-search.contract.js";
import { GPT_ROOT_URL, canonicalGptConversationUrl } from "../contracts/target-document.contract.js";
import { GPT_ATTACHMENT_REGION_SELECTOR } from "../contracts/attachment.contract.js";
import { GPT_COMPOSER_SELECTOR } from "../contracts/composer.contract.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const conversationChildHandlers: GptChildHandlerMap = {
  async verify_clean_gpt_chat(intent, context) {
    requireExactInputKeys(intent, []);
    const browser = requireBrowser(context);
    const composer = await findCount(browser, { selector: GPT_COMPOSER_SELECTOR, maxMatches: 2 });
    const turns = await findCount(browser, { selector: GPT_USER_TURN_SELECTOR, maxMatches: 20 });
    const attachments = await findCount(browser, { selector: GPT_ATTACHMENT_REGION_SELECTOR, maxMatches: 2 });
    const generating = await findCount(browser, { selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2 });
    if (composer !== 1 || turns !== 0 || attachments !== 0 || generating !== 0) {
      throw new Error(`review_required:GPT_CHAT_NOT_CLEAN:composer=${composer}:turns=${turns}:attachments=${attachments}:generating=${generating}`);
    }
    return success({
      value: { composer, turns, attachments, generating }, candidateCount: composer,
      observedSemantics: ["one composer", "zero prior turns", "zero attachments", "not generating"],
      committedMutation: "no",
    });
  },

  async focus_exact_gpt_conversation(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl"]);
    const expected = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const browser = requireBrowser(context);
    const before = await readGptDocument(browser);
    if (canonicalGptConversationUrl(before.url) === expected) return success({
      value: { url: expected, state: "already-focused" }, candidateCount: 1,
      observedSemantics: ["exact canonical conversation already focused"], committedMutation: "no",
    });
    await browser.navigate({ url: expected, title: "focus exact GPT conversation" });
    const after = canonicalGptConversationUrl((await readGptDocument(browser)).url);
    if (after !== expected) throw new Error("review_required:GPT_CONVERSATION_NAVIGATION_MISMATCH");
    return success({
      value: { url: after }, candidateCount: 1,
      observedSemantics: ["exact canonical conversation URL"], committedMutation: "yes",
    });
  },

  async open_gpt_conversation_search(intent, context) {
    requireExactInputKeys(intent, []);
    const browser = requireBrowser(context);
    const dialog = await findCount(browser, { selector: GPT_SEARCH_DIALOG_SELECTOR, maxMatches: 2 });
    if (dialog === 1) return success({
      value: { state: "already-open" }, candidateCount: 1,
      observedSemantics: ["one search dialog"], committedMutation: "no",
    });
    if (dialog > 1) throw new Error(`review_required:GPT_SEARCH_DIALOG_COUNT_${dialog}`);
    await requireOneCandidate(browser, { selector: GPT_SEARCH_BUTTON_SELECTOR, maxMatches: 2 });
    await browser.executeDomIntent({ kind: "click", selector: GPT_SEARCH_BUTTON_SELECTOR, expectedMatches: 1 });
    const after = await findCount(browser, { selector: GPT_SEARCH_DIALOG_SELECTOR, maxMatches: 2 });
    if (after !== 1) throw new Error("review_required:GPT_SEARCH_DIALOG_OPEN_UNCONFIRMED");
    return success({
      value: { state: "open" }, candidateCount: 1,
      observedSemantics: ["one search control", "one search dialog"], committedMutation: "yes",
    });
  },

  async write_gpt_conversation_search_key(intent, context) {
    requireExactInputKeys(intent, ["searchKey"]);
    const searchKey = stringInput(intent, "searchKey");
    const browser = requireBrowser(context);
    await requireOneCandidate(browser, { selector: GPT_SEARCH_INPUT_SELECTOR, maxMatches: 2 });
    const value = await browser.executeDomIntent({
      kind: "fill", selector: GPT_SEARCH_INPUT_SELECTOR, approvedText: searchKey,
      clearBeforeType: true, expectedMatches: 1,
    });
    if (!value || typeof value !== "object" || Array.isArray(value)
      || (value as { retainedValueVerified?: unknown }).retainedValueVerified !== true) {
      throw new Error("review_required:GPT_SEARCH_KEY_NOT_RETAINED");
    }
    return success({
      value: { searchKeyHash: hash(searchKey) }, candidateCount: 1,
      observedSemantics: ["one search input", "exact key retained"], committedMutation: "yes",
    });
  },

  async select_exact_gpt_conversation_result(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl", "searchKey"]);
    const expected = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const searchKey = stringInput(intent, "searchKey");
    const browser = requireBrowser(context);
    await requireOneCandidate(browser, {
      selector: GPT_SEARCH_RESULT_SELECTOR, textContains: searchKey, maxMatches: 20,
    });
    const href = await readExactAttribute(browser, GPT_SEARCH_RESULT_SELECTOR, "href", searchKey);
    if (canonicalGptConversationUrl(new URL(href, GPT_ROOT_URL).href) !== expected) {
      throw new Error("review_required:GPT_SEARCH_RESULT_IDENTITY_MISMATCH");
    }
    await browser.executeDomIntent({
      kind: "click", selector: GPT_SEARCH_RESULT_SELECTOR,
      expectedText: searchKey, expectedMatches: 1,
    });
    const after = canonicalGptConversationUrl((await readGptDocument(browser)).url);
    if (after !== expected) throw new Error("review_required:GPT_SEARCH_RESULT_NAVIGATION_MISMATCH");
    return success({
      value: { canonicalConversationUrl: after }, candidateCount: 1,
      observedSemantics: ["one exact search result", "canonical URL matched"], committedMutation: "yes",
    });
  },

  async open_gpt_fork_control(intent, context) {
    requireExactInputKeys(intent, ["checkpointTurnMarker"]);
    const marker = stringInput(intent, "checkpointTurnMarker");
    const browser = requireBrowser(context);
    const count = await findCount(browser, {
      selector: GPT_FORK_CONTROL_SELECTOR, textContains: marker, maxMatches: 2,
    });
    if (count !== 1) throw new Error("review_required:GPT_FORK_CONTROL_NOT_PRODUCTION_VERIFIED");
    throw new Error("review_required:GPT_FORK_CONTROL_NOT_PRODUCTION_VERIFIED");
  },

  async commit_gpt_checkpoint_fork(intent, _context) {
    requireExactInputKeys(intent, ["checkpointTurnMarker", "parentConversationUrl"]);
    throw new Error("review_required:GPT_FORK_COMMIT_NOT_PRODUCTION_VERIFIED");
  },

  async verify_gpt_conversation_identity(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl", "turnMarker"]);
    const expected = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const marker = stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const observed = canonicalGptConversationUrl((await readGptDocument(browser)).url);
    const markerCount = await findCount(browser, {
      selector: GPT_USER_TURN_SELECTOR, textContains: marker, maxMatches: 20,
    });
    if (observed !== expected || markerCount !== 1) {
      throw new Error(`review_required:GPT_CONVERSATION_IDENTITY_MISMATCH:markerCount=${markerCount}`);
    }
    return success({
      value: { canonicalConversationUrl: observed, turnMarker: marker, conversationHash: hash(`${observed}\n${marker}`) },
      candidateCount: markerCount,
      observedSemantics: ["canonical URL", "one exact turn marker", "conversation hash"],
      committedMutation: "no",
    });
  },
};
