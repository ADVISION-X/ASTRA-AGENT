import { createHash } from "node:crypto";
import { executionFailure } from "../../../../lib/typed-failure.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  booleanInput,
  numberInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
} from "../child-handler.js";
import { findCount, readExactAttribute, readGptDocument } from "../gpt-dom-observation.js";
import { GPT_GENERATING_STOP_SELECTOR, GPT_USER_TURN_SELECTOR } from "../contracts/conversation.contract.js";
import { canonicalGptConversationUrl } from "../contracts/target-document.contract.js";
import { GPT_ATTACHMENT_REGION_SELECTOR } from "../contracts/attachment.contract.js";
import { GPT_COMPOSER_SELECTOR } from "../contracts/composer.contract.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const boundedTimeout = (intent: Parameters<NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>>[0]): number =>
  Math.max(1_000, Math.min(numberInput(intent, "timeoutMs"), 60_000));

const canonicalOrNull = (value: string): string | null => {
  try { return canonicalGptConversationUrl(value); }
  catch { return null; }
};

const waitSlice = async (browser: ReturnType<typeof requireBrowser>, deadline: number): Promise<void> => {
  const remaining = deadline - Date.now();
  if (remaining > 0) await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
};

export const conversationChildHandlers = {
  async prepare_clean_gpt_chat(intent, context) {
    requireExactInputKeys(intent, ["timeoutMs"]);
    const browser = requireBrowser(context);
    const deadline = Date.now() + boundedTimeout(intent);
    let observed = { composer: 0, turns: 0, attachments: 0, generating: 0 };
    while (Date.now() < deadline) {
      observed = {
        composer: await findCount(browser, { selector: GPT_COMPOSER_SELECTOR, maxMatches: 2 }),
        turns: await findCount(browser, { selector: GPT_USER_TURN_SELECTOR, maxMatches: 20 }),
        attachments: await findCount(browser, { selector: GPT_ATTACHMENT_REGION_SELECTOR, maxMatches: 2 }),
        generating: await findCount(browser, { selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2 }),
      };
      if (observed.composer === 1 && observed.turns === 0
        && observed.attachments === 0 && observed.generating === 0) {
        return success({
          value: observed, candidateCount: 1,
          observedSemantics: ["hydrated fresh composer", "zero prior turns", "zero attachments", "not generating"],
          committedMutation: "no",
        });
      }
      await waitSlice(browser, deadline);
    }
    throw executionFailure("failed", `GPT_CHAT_HYDRATION_PENDING:composer=${observed.composer}:turns=${observed.turns}:attachments=${observed.attachments}:generating=${observed.generating}`);
  },

  async focus_exact_gpt_conversation(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl"], ["reconcileOnly"]);
    const expected = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const reconcileOnly = intent.input.reconcileOnly === undefined ? false : booleanInput(intent, "reconcileOnly");
    const browser = requireBrowser(context);
    const before = canonicalOrNull((await readGptDocument(browser)).url);
    if (before === expected) return success({
      value: { url: expected, state: "already-focused" }, candidateCount: 1,
      observedSemantics: ["exact permanent conversation already focused"], committedMutation: "no",
    });
    if (reconcileOnly) {
      throw executionFailure("failed", "GPT_CONVERSATION_NAVIGATION_NOT_YET_CONFIRMED");
    }
    await browser.navigate({ url: expected, title: "focus exact GPT conversation" });
    const after = canonicalOrNull((await readGptDocument(browser)).url);
    if (after !== expected) throw executionFailure("failed", "GPT_CONVERSATION_NAVIGATION_NOT_YET_CONFIRMED");
    return success({
      value: { url: after }, candidateCount: 1,
      observedSemantics: ["exact permanent conversation URL"], committedMutation: "confirmed",
    });
  },

  async verify_gpt_conversation_identity(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl", "timeoutMs", "turnMarker"]);
    const expected = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const marker = stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const deadline = Date.now() + boundedTimeout(intent);
    let markerCount = 0;
    let composerCount = 0;
    while (Date.now() < deadline) {
      const observed = canonicalOrNull((await readGptDocument(browser)).url);
      composerCount = await findCount(browser, { selector: GPT_COMPOSER_SELECTOR, maxMatches: 2 });
      markerCount = await findCount(browser, {
        selector: GPT_USER_TURN_SELECTOR, textContains: marker, maxMatches: 20,
      });
      if (observed === expected && composerCount === 1 && markerCount === 1) {
        const userTurnId = await readExactAttribute(browser, GPT_USER_TURN_SELECTOR, "data-testid", marker);
        return success({
          value: {
            canonicalConversationUrl: observed,
            turnMarker: marker,
            userTurnId,
            conversationHash: hash(`${observed}\n${marker}\n${userTurnId}`),
          },
          candidateCount: markerCount,
          observedSemantics: ["permanent canonical URL", "hydrated composer", "one exact turn marker"],
          committedMutation: "no",
        });
      }
      await waitSlice(browser, deadline);
    }
    throw executionFailure("failed", `GPT_CONVERSATION_HYDRATION_PENDING:marker=${markerCount}:composer=${composerCount}`);
  },
} satisfies GptChildHandlerMap;
