import { createHash } from "node:crypto";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  numberInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
} from "../child-handler.js";
import {
  findCount,
  readExactText,
  readGptDocument,
  requireOneCandidate,
} from "../gpt-dom-observation.js";
import { GPT_COMPOSER_SELECTOR } from "../contracts/composer.contract.js";
import { GPT_USER_TURN_SELECTOR } from "../contracts/conversation.contract.js";
import {
  GPT_TITLE_INPUT_SELECTOR,
  GPT_TITLE_RENAME_LABEL,
  GPT_TITLE_RENAME_MENU_SELECTOR,
  GPT_TITLE_TRAILING_BUTTON_ATTRIBUTE,
} from "../contracts/title.contract.js";
import { canonicalGptConversationUrl } from "../contracts/target-document.contract.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const rowSelector = (canonicalUrl: string): string =>
  `a[href=${JSON.stringify(new URL(canonicalUrl).pathname)}]`;

export const titleChildHandlers = {
  async open_gpt_title_control(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl"]);
    const canonicalUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const browser = requireBrowser(context);
    const row = rowSelector(canonicalUrl);
    await requireOneCandidate(browser, { selector: row, maxMatches: 2 });
    const inputCount = await findCount(browser, { selector: GPT_TITLE_INPUT_SELECTOR, maxMatches: 2 });
    if (inputCount === 1) return success({
      value: { state: "editor-open" }, candidateCount: 1,
      observedSemantics: ["one title editor"], committedMutation: "no",
    });
    const renameCount = await findCount(browser, {
      selector: GPT_TITLE_RENAME_MENU_SELECTOR,
      textEquals: GPT_TITLE_RENAME_LABEL,
      maxMatches: 2,
    });
    if (renameCount === 1) {
      await browser.executeDomIntent({
        kind: "click", selector: GPT_TITLE_RENAME_MENU_SELECTOR,
        expectedTextEquals: GPT_TITLE_RENAME_LABEL, expectedMatches: 1,
      });
      const after = await findCount(browser, { selector: GPT_TITLE_INPUT_SELECTOR, maxMatches: 2 });
      if (after !== 1) throw new Error("review_required:GPT_TITLE_EDITOR_OPEN_UNCONFIRMED");
      return success({
        value: { state: "editor-open" }, candidateCount: 1,
        observedSemantics: ["one rename menu item", "one title editor"], committedMutation: "yes",
      });
    }
    if (renameCount > 1) throw new Error(`review_required:GPT_TITLE_RENAME_COUNT_${renameCount}`);
    const trailingSelector = `${row} ${GPT_TITLE_TRAILING_BUTTON_ATTRIBUTE}`;
    await requireOneCandidate(browser, { selector: trailingSelector, maxMatches: 2 });
    await browser.executeDomIntent({ kind: "click", selector: trailingSelector, expectedMatches: 1 });
    const after = await findCount(browser, {
      selector: GPT_TITLE_RENAME_MENU_SELECTOR,
      textEquals: GPT_TITLE_RENAME_LABEL,
      maxMatches: 2,
    });
    if (after !== 1) throw new Error("review_required:GPT_TITLE_MENU_OPEN_UNCONFIRMED");
    return success({
      value: { state: "rename-menu-open" }, candidateCount: 1,
      observedSemantics: ["one exact conversation row", "one rename menu item"], committedMutation: "yes",
    });
  },

  async write_exact_gpt_title(intent, context) {
    requireExactInputKeys(intent, ["title"]);
    const title = stringInput(intent, "title");
    if (title.length > 80) throw new Error("failed:GPT_TITLE_TOO_LONG");
    const browser = requireBrowser(context);
    await requireOneCandidate(browser, { selector: GPT_TITLE_INPUT_SELECTOR, maxMatches: 2 });
    const result = await browser.executeDomIntent({
      kind: "fill", selector: GPT_TITLE_INPUT_SELECTOR,
      approvedText: title, clearBeforeType: true, expectedMatches: 1,
    });
    if (!result || typeof result !== "object" || Array.isArray(result)
      || (result as { retainedValueVerified?: unknown }).retainedValueVerified !== true) {
      throw new Error("review_required:GPT_TITLE_WRITE_UNCONFIRMED");
    }
    return success({
      value: { titleHash: hash(title) }, candidateCount: 1,
      observedSemantics: ["one title input", "exact title retained"], committedMutation: "yes",
    });
  },

  async commit_gpt_title(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl", "title", "timeoutMs"]);
    const canonicalUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const title = stringInput(intent, "title");
    const timeoutMs = Math.max(1_000, Math.min(numberInput(intent, "timeoutMs"), 15_000));
    const browser = requireBrowser(context);
    await requireOneCandidate(browser, { selector: GPT_COMPOSER_SELECTOR, maxMatches: 2 });
    await browser.executeDomIntent({ kind: "click", selector: GPT_COMPOSER_SELECTOR, expectedMatches: 1 });
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await readExactText(browser, rowSelector(canonicalUrl), 256) === title) {
        return success({
          value: { titleHash: hash(title) }, candidateCount: 1,
          observedSemantics: ["one composer commit target", "exact sidebar title committed"],
          committedMutation: "yes",
        });
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs > 0) {
        await browser.wait({
          durationMs: Math.max(25, Math.min(250, Math.ceil(remainingMs / 8))),
        });
      }
    }
    throw new Error("review_required:GPT_TITLE_COMMIT_UNCONFIRMED");
  },

  async verify_exact_gpt_title(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl", "title", "turnMarker"]);
    const canonicalUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const title = stringInput(intent, "title");
    const turnMarker = stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const observedUrl = canonicalGptConversationUrl((await readGptDocument(browser)).url);
    const observedTitle = await readExactText(browser, rowSelector(canonicalUrl), 256);
    const markerCount = await findCount(browser, {
      selector: GPT_USER_TURN_SELECTOR, textContains: turnMarker, maxMatches: 20,
    });
    if (observedUrl !== canonicalUrl || observedTitle !== title || markerCount !== 1) {
      throw new Error("review_required:GPT_TITLE_IDENTITY_READBACK_MISMATCH");
    }
    return success({
      value: {
        title,
        titleHash: hash(title),
        canonicalConversationUrl: observedUrl,
        turnMarker,
      },
      candidateCount: 1,
      observedSemantics: ["exact display title", "canonical URL", "one turn marker", "title is not route identity"],
      committedMutation: "no",
    });
  },
} satisfies GptChildHandlerMap;
