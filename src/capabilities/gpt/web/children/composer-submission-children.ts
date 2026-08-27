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
  readExactText,
  readGptDocument,
  requireOneCandidate,
} from "../gpt-dom-observation.js";
import { GPT_COMPOSER_SELECTOR } from "../contracts/composer.contract.js";
import { GPT_SEND_SELECTOR } from "../contracts/submission.contract.js";
import { GPT_USER_TURN_SELECTOR } from "../contracts/conversation.contract.js";
import { canonicalGptConversationUrl } from "../contracts/target-document.contract.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const promptIdentity = (text: string) => ({
  length: text.length,
  prefix: text.slice(0, 80),
  suffix: text.slice(-80),
  hash: hash(text),
});

export const composerSubmissionChildHandlers: GptChildHandlerMap = {
  async focus_exact_gpt_composer(intent, context) {
    requireExactInputKeys(intent, []);
    const browser = requireBrowser(context);
    await requireOneCandidate(browser, { selector: GPT_COMPOSER_SELECTOR, maxMatches: 2 });
    const inspected = await browser.executeDomIntent({
      kind: "inspect", selector: GPT_COMPOSER_SELECTOR,
      fields: ["tagName", "visible", "disabled"],
    });
    if (!inspected || typeof inspected !== "object" || Array.isArray(inspected)) {
      throw new Error("review_required:GPT_COMPOSER_INVALID");
    }
    const state = inspected as Record<string, unknown>;
    if (state.tagName !== "DIV" || state.visible !== true || state.disabled === true) {
      throw new Error("review_required:GPT_COMPOSER_INVALID");
    }
    await browser.executeDomIntent({ kind: "click", selector: GPT_COMPOSER_SELECTOR, expectedMatches: 1 });
    return success({
      value: { focused: true }, candidateCount: 1,
      observedSemantics: ["one visible enabled composer", "focus mutation dispatched"], committedMutation: "yes",
    });
  },

  async write_exact_gpt_prompt(intent, context) {
    requireExactInputKeys(intent, ["prompt"]);
    const prompt = stringInput(intent, "prompt");
    const browser = requireBrowser(context);
    await requireOneCandidate(browser, { selector: GPT_COMPOSER_SELECTOR, maxMatches: 2 });
    const value = await browser.executeDomIntent({
      kind: "fill", selector: GPT_COMPOSER_SELECTOR,
      approvedText: prompt, clearBeforeType: true, expectedMatches: 1,
    });
    if (!value || typeof value !== "object" || Array.isArray(value)
      || (value as { retainedValueVerified?: unknown }).retainedValueVerified !== true) {
      throw new Error("review_required:GPT_PROMPT_WRITE_UNCONFIRMED");
    }
    return success({
      value: promptIdentity(prompt), candidateCount: 1,
      observedSemantics: ["one composer", "approved prompt retained", "no local prompt ceiling"],
      committedMutation: "yes",
    });
  },

  async verify_exact_gpt_prompt(intent, context) {
    requireExactInputKeys(intent, ["prompt", "turnMarker"]);
    const prompt = stringInput(intent, "prompt");
    const marker = stringInput(intent, "turnMarker");
    if (!prompt.includes(marker)) throw new Error("failed:GPT_PROMPT_MARKER_MISSING");
    const browser = requireBrowser(context);
    const observed = await readExactText(browser, GPT_COMPOSER_SELECTOR, 65_536);
    if (observed !== prompt) throw new Error("review_required:GPT_PROMPT_READBACK_MISMATCH");
    const sendCount = await findCount(browser, { selector: GPT_SEND_SELECTOR, maxMatches: 2 });
    if (sendCount !== 1) throw new Error(`review_required:GPT_SEND_CONTROL_COUNT_${sendCount}`);
    return success({
      value: promptIdentity(observed), candidateCount: 1,
      observedSemantics: ["exact prompt bytes", "immutable turn marker", "one send control"],
      committedMutation: "no",
    });
  },

  async submit_exact_gpt_turn(intent, context) {
    requireExactInputKeys(intent, ["promptHash"]);
    const promptHash = stringInput(intent, "promptHash");
    if (!/^sha256:[a-f0-9]{64}$/u.test(promptHash)) throw new Error("failed:GPT_PROMPT_HASH_INVALID");
    const browser = requireBrowser(context);
    await requireOneCandidate(browser, { selector: GPT_SEND_SELECTOR, maxMatches: 2 });
    const inspected = await browser.executeDomIntent({
      kind: "inspect", selector: GPT_SEND_SELECTOR,
      fields: ["tagName", "visible", "disabled"],
    });
    if (!inspected || typeof inspected !== "object" || Array.isArray(inspected)) {
      throw new Error("review_required:GPT_SEND_CONTROL_INVALID");
    }
    const state = inspected as Record<string, unknown>;
    if (state.tagName !== "BUTTON" || state.visible !== true || state.disabled === true) {
      throw new Error("review_required:GPT_SEND_CONTROL_INVALID");
    }
    await browser.executeDomIntent({ kind: "click", selector: GPT_SEND_SELECTOR, expectedMatches: 1 });
    return success({
      value: { promptHash, mutationSent: true }, candidateCount: 1,
      observedSemantics: ["one enabled send control", promptHash], committedMutation: "yes",
    });
  },

  async verify_gpt_turn_submission(intent, context) {
    requireExactInputKeys(intent, ["turnMarker"]);
    const marker = stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const count = await findCount(browser, {
      selector: GPT_USER_TURN_SELECTOR, textContains: marker, maxMatches: 20,
    });
    if (count !== 1) throw new Error(`review_required:GPT_SUBMITTED_TURN_COUNT_${count}`);
    const userTurnId = await readExactAttribute(browser, GPT_USER_TURN_SELECTOR, "data-testid", marker);
    const composerText = await readExactText(browser, GPT_COMPOSER_SELECTOR, 65_536);
    if (composerText.trim().length !== 0) throw new Error("review_required:GPT_SUBMISSION_COMPOSER_NOT_CLEARED");
    const document = await readGptDocument(browser);
    const canonicalConversationUrl = canonicalGptConversationUrl(document.url);
    return success({
      value: {
        turnMarker: marker,
        userTurnId,
        canonicalConversationUrl,
        conversationIdentityHash: hash(`${canonicalConversationUrl}\n${marker}\n${userTurnId}`),
      },
      candidateCount: count,
      observedSemantics: ["one exact user turn", "composer cleared", "canonical conversation URL"],
      committedMutation: "no",
    });
  },
};
