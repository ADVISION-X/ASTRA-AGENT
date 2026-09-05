import { createHash } from "node:crypto";

import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/execution-failure.js";
import type { GptChildCapabilityIntent } from "../../contract.js";
import { numberInput } from "../../web/child-handler.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_ASSISTANT_TURN_SELECTOR,
  GPT_ATTACHMENT_ITEM_SELECTOR,
  GPT_COMPOSER_FORM_SELECTOR,
  GPT_COMPOSER_SELECTOR,
  GPT_GENERATING_STOP_SELECTOR,
  GPT_USER_TURN_SELECTOR,
} from "./selectors.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;

export const hashConversationValue = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const timeoutInput = (intent: GptChildCapabilityIntent<"prepare_clean_gpt_chat">): number => {
  const value = numberInput(intent, "timeoutMs");
  if (!Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:timeoutMs`);
  }
  return value;
};

export type ConversationState = Readonly<{
  currentUrl: string;
  composerRaw: number;
  composerEligible: number;
  composerHash: string | null;
  userRaw: number;
  assistantRaw: number;
  attachmentsRaw: number;
  generatingRaw: number;
  facts: GptCoherentFactProjection;
}>;

export const readConversationState = async (
  browser: BrowserTargetLease,
): Promise<ConversationState> => {
  const observation = await readCoherentObservation(browser, [
    { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2,
      fields: ["exactEditableTextHash" as const] },
    { queryId: "user-turns", selector: GPT_USER_TURN_SELECTOR, maxMatches: 20, fields: [] },
    { queryId: "assistant-turns", selector: GPT_ASSISTANT_TURN_SELECTOR, maxMatches: 20, fields: [] },
    { queryId: "attachments", selector: GPT_ATTACHMENT_ITEM_SELECTOR,
      scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: 20, fields: [] },
    { queryId: "generating", selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2, fields: [] },
  ]);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const composer = row("composer");
  const rawComposerHash = composer.matches[0]?.exactEditableTextHash;
  if (rawComposerHash !== undefined
    && (typeof rawComposerHash !== "string" || !HASH.test(rawComposerHash))) {
    throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
  }
  return Object.freeze({
    currentUrl: observation.currentUrl,
    composerRaw: composer.rawCount,
    composerEligible: composer.eligibleCount,
    composerHash: typeof rawComposerHash === "string" ? rawComposerHash : null,
    userRaw: row("user-turns").rawCount,
    assistantRaw: row("assistant-turns").rawCount,
    attachmentsRaw: row("attachments").rawCount,
    generatingRaw: row("generating").rawCount,
    facts: projectCoherentObservation(observation, "composer"),
  });
};
