import { createHash } from "node:crypto";
import { executionFailure } from "../../../../lib/typed-failure.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  arrayInput,
  booleanInput,
  numberInput,
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

export const composerSubmissionChildHandlers = {
  async write_exact_gpt_prompt(intent, context) {
    requireExactInputKeys(intent, ["prompt"], ["reconcileOnly"]);
    const prompt = stringInput(intent, "prompt");
    const browser = requireBrowser(context);
    const reconcileOnly = intent.input.reconcileOnly === undefined ? false : booleanInput(intent, "reconcileOnly");
    const composerCount = await findCount(browser, { selector: GPT_COMPOSER_SELECTOR, maxMatches: 2 });
    if (composerCount !== 1) throw executionFailure("recovery_pending", `GPT_COMPOSER_COUNT_${composerCount}`);
    const existing = await readExactText(browser, GPT_COMPOSER_SELECTOR, 65_536);
    if (existing === prompt) return success({
      value: promptIdentity(prompt), candidateCount: 1,
      observedSemantics: ["exact prompt already retained"], committedMutation: "no",
    });
    if (reconcileOnly) throw executionFailure("recovery_pending", "GPT_PROMPT_WRITE_PENDING");
    const value = await browser.executeDomIntent({
      kind: "fill", selector: GPT_COMPOSER_SELECTOR,
      approvedText: prompt, clearBeforeType: true, expectedMatches: 1,
    });
    if (!value || typeof value !== "object" || Array.isArray(value)
      || (value as { retainedValueVerified?: unknown }).retainedValueVerified !== true) {
      throw executionFailure("review_required", "GPT_PROMPT_WRITE_UNCONFIRMED");
    }
    return success({
      value: promptIdentity(prompt), candidateCount: 1,
      observedSemantics: ["one composer", "approved prompt retained", "no local prompt ceiling"],
      committedMutation: "confirmed",
    });
  },

  async reconcile_gpt_draft(intent, context) {
    requireExactInputKeys(intent, ["files", "prompt", "turnMarker"]);
    const prompt = stringInput(intent, "prompt");
    const marker = stringInput(intent, "turnMarker");
    const expectedNames = arrayInput(intent, "files").map((file) => {
      if (!file || typeof file !== "object" || Array.isArray(file)
        || typeof (file as { displayName?: unknown }).displayName !== "string") {
        throw executionFailure("failed", "GPT_ATTACHMENT_INPUT_INVALID");
      }
      return (file as { displayName: string }).displayName.normalize("NFC");
    });
    if (!prompt.includes(marker)) throw executionFailure("failed", "GPT_PROMPT_MARKER_MISSING");
    const browser = requireBrowser(context);
    const observed = await readExactText(browser, GPT_COMPOSER_SELECTOR, 65_536);
    if (observed !== prompt) throw executionFailure("review_required", "GPT_PROMPT_READBACK_MISMATCH");
    const sendCount = await findCount(browser, { selector: GPT_SEND_SELECTOR, maxMatches: 2 });
    if (sendCount !== 1) throw executionFailure("recovery_pending", `GPT_SEND_CONTROL_COUNT_${sendCount}`);
    const send = await browser.executeDomIntent({
      kind: "inspect", selector: GPT_SEND_SELECTOR, fields: ["visible", "disabled"],
    });
    if (!send || typeof send !== "object" || Array.isArray(send)
      || (send as { visible?: unknown }).visible !== true || (send as { disabled?: unknown }).disabled === true) {
      throw executionFailure("recovery_pending", "GPT_SEND_CONTROL_NOT_READY");
    }
    return success({
      value: { ...promptIdentity(observed), attachmentDisplayNames: expectedNames }, candidateCount: 1,
      observedSemantics: ["exact prompt bytes", "immutable turn marker", "approved attachment identity", "one enabled send control"],
      committedMutation: "no",
    });
  },

  async submit_exact_gpt_turn_once(intent, context) {
    requireExactInputKeys(intent, ["promptHash", "turnMarker"], ["reconcileOnly"]);
    const promptHash = stringInput(intent, "promptHash");
    const turnMarker = stringInput(intent, "turnMarker");
    if (!/^sha256:[a-f0-9]{64}$/u.test(promptHash)) throw executionFailure("failed", "GPT_PROMPT_HASH_INVALID");
    const browser = requireBrowser(context);
    const reconcileOnly = intent.input.reconcileOnly === undefined ? false : booleanInput(intent, "reconcileOnly");
    const submitted = await findCount(browser, {
      selector: GPT_USER_TURN_SELECTOR, textContains: turnMarker, maxMatches: 20,
    });
    if (submitted === 1) return success({
      value: { promptHash, mutationSent: false }, candidateCount: 1,
      observedSemantics: ["one exact user turn already submitted", promptHash], committedMutation: "no",
    });
    if (submitted > 1) throw executionFailure("review_required", `GPT_SUBMITTED_TURN_COUNT_${submitted}`);
    if (reconcileOnly) throw executionFailure("recovery_pending", "GPT_TURN_SUBMISSION_PENDING");
    const sendCount = await findCount(browser, { selector: GPT_SEND_SELECTOR, maxMatches: 2 });
    if (sendCount !== 1) throw executionFailure("recovery_pending", `GPT_SEND_CONTROL_COUNT_${sendCount}`);
    const inspected = await browser.executeDomIntent({
      kind: "inspect", selector: GPT_SEND_SELECTOR,
      fields: ["tagName", "visible", "disabled"],
    });
    if (!inspected || typeof inspected !== "object" || Array.isArray(inspected)) {
      throw executionFailure("review_required", "GPT_SEND_CONTROL_INVALID");
    }
    const state = inspected as Record<string, unknown>;
    if (state.tagName !== "BUTTON" || state.visible !== true || state.disabled === true) {
      throw executionFailure("review_required", "GPT_SEND_CONTROL_INVALID");
    }
    await browser.executeDomIntent({
      kind: "click",
      selector: GPT_SEND_SELECTOR,
      expectedMatches: 1,
      postClickMatch: {
        selector: GPT_USER_TURN_SELECTOR,
        expectedMatches: 1,
        textContains: turnMarker,
        timeoutMs: 5_000,
      },
    });
    return success({
      value: { promptHash, mutationSent: true }, candidateCount: 1,
      observedSemantics: ["one enabled send control", promptHash, "one exact user turn"], committedMutation: "confirmed",
    });
  },

  async reconcile_gpt_turn_submission(intent, context) {
    requireExactInputKeys(intent, ["timeoutMs", "turnMarker"]);
    const marker = stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const timeoutMs = Math.max(1_000, Math.min(numberInput(intent, "timeoutMs"), 60_000));
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const count = await findCount(browser, {
        selector: GPT_USER_TURN_SELECTOR, textContains: marker, maxMatches: 20,
      });
      if (count > 1) throw executionFailure("review_required", `GPT_SUBMITTED_TURN_COUNT_${count}`);
      if (count === 1) {
        const composerText = await readExactText(browser, GPT_COMPOSER_SELECTOR, 65_536);
        let canonicalConversationUrl: string | null = null;
        try { canonicalConversationUrl = canonicalGptConversationUrl((await readGptDocument(browser)).url); } catch {}
        if (composerText.trim().length === 0 && canonicalConversationUrl) {
          const userTurnId = await readExactAttribute(browser, GPT_USER_TURN_SELECTOR, "data-testid", marker);
          return success({
            value: {
              turnMarker: marker,
              userTurnId,
              canonicalConversationUrl,
              conversationIdentityHash: hash(`${canonicalConversationUrl}\n${marker}\n${userTurnId}`),
            },
            candidateCount: count,
            observedSemantics: ["one exact user turn", "composer cleared", "permanent canonical conversation URL"],
            committedMutation: "no",
          });
        }
      }
      const remaining = deadline - Date.now();
      if (remaining > 0) await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
    }
    throw executionFailure("recovery_pending", "GPT_TURN_SUBMISSION_RECONCILIATION_PENDING");
  },
} satisfies GptChildHandlerMap;
