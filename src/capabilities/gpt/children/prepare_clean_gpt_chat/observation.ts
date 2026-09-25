import { createHash } from "node:crypto";

import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/execution-failure.js";
import type { GptChildCapabilityIntent } from "../../contract.js";
import { numberInput } from "../../web/child-handler.js";
import { isGptRootUrl } from "../../web/contracts/target-document.contract.js";
import {
  projectCoherentObservation,
  readConfirmedCoherentObservation,
  type GptCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_ASSISTANT_TURN_SELECTOR,
  GPT_ATTACHMENT_ITEM_SELECTOR,
  GPT_CHAT_MODE_CHAT_SELECTOR,
  GPT_CHAT_MODE_WORK_SELECTOR,
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
  chatModeRaw: number;
  chatModeEligible: number;
  chatModePressed: "true" | "false" | null;
  workModeRaw: number;
  workModeEligible: number;
  workModePressed: "true" | "false" | null;
  facts: GptCoherentFactProjection;
}>;

export const CHAT_MODE_QUERIES = Object.freeze([
  { queryId: "chat-mode", selector: GPT_CHAT_MODE_CHAT_SELECTOR,
    textEquals: "聊天", maxMatches: 2, fields: ["ariaPressed" as const] },
  { queryId: "work-mode", selector: GPT_CHAT_MODE_WORK_SELECTOR,
    textEquals: "工作", maxMatches: 2, fields: ["ariaPressed" as const] },
]);

const CONVERSATION_QUERIES = Object.freeze([
  { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2,
    fields: ["exactEditableTextHash" as const] },
  { queryId: "user-turns", selector: GPT_USER_TURN_SELECTOR, maxMatches: 20, fields: [] },
  { queryId: "assistant-turns", selector: GPT_ASSISTANT_TURN_SELECTOR, maxMatches: 20, fields: [] },
  { queryId: "attachments", selector: GPT_ATTACHMENT_ITEM_SELECTOR,
    scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: 20, fields: [] },
  { queryId: "generating", selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2, fields: [] },
  ...CHAT_MODE_QUERIES,
]);

type ChatModeState = Readonly<{
  currentUrl: string;
  chatModeRaw: number;
  chatModeEligible: number;
  chatModePressed: "true" | "false" | null;
  workModeRaw: number;
  workModeEligible: number;
  workModePressed: "true" | "false" | null;
  facts: GptCoherentFactProjection;
}>;

const pressedValue = (value: unknown): "true" | "false" | null =>
  value === "true" || value === "false" ? value : null;

export const projectChatModeState = (observation: GptCoherentObservation): ChatModeState => {
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const chat = row("chat-mode");
  const work = row("work-mode");
  return Object.freeze({
    currentUrl: observation.currentUrl,
    chatModeRaw: chat.rawCount,
    chatModeEligible: chat.eligibleCount,
    chatModePressed: pressedValue(chat.matches[0]?.ariaPressed),
    workModeRaw: work.rawCount,
    workModeEligible: work.eligibleCount,
    workModePressed: pressedValue(work.matches[0]?.ariaPressed),
    facts: projectCoherentObservation(observation, "chat-mode"),
  });
};

export const exactChatModeSelected = (state: Pick<ChatModeState,
  "chatModeRaw" | "chatModeEligible" | "chatModePressed"
  | "workModeRaw" | "workModeEligible" | "workModePressed">): boolean =>
  state.chatModeRaw === 1 && state.chatModeEligible === 1 && state.chatModePressed === "true"
  && state.workModeRaw === 1 && state.workModeEligible === 1 && state.workModePressed === "false";

export const exactWorkModeSelected = (state: Pick<ChatModeState,
  "chatModeRaw" | "chatModeEligible" | "chatModePressed"
  | "workModeRaw" | "workModeEligible" | "workModePressed">): boolean =>
  state.chatModeRaw === 1 && state.chatModeEligible === 1 && state.chatModePressed === "false"
  && state.workModeRaw === 1 && state.workModeEligible === 1 && state.workModePressed === "true";

const projectConversationState = (observation: GptCoherentObservation): ConversationState => {
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const composer = row("composer");
  const mode = projectChatModeState(observation);
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
    chatModeRaw: mode.chatModeRaw,
    chatModeEligible: mode.chatModeEligible,
    chatModePressed: mode.chatModePressed,
    workModeRaw: mode.workModeRaw,
    workModeEligible: mode.workModeEligible,
    workModePressed: mode.workModePressed,
    facts: projectCoherentObservation(observation, "composer"),
  });
};

const invalidConversation = (state: ConversationState): boolean =>
  !isGptRootUrl(state.currentUrl)
  || state.userRaw !== 0 || state.assistantRaw !== 0
  || state.attachmentsRaw !== 0 || state.generatingRaw !== 0
  || state.composerRaw > 1 || state.chatModeRaw > 1 || state.workModeRaw > 1
  || (state.chatModePressed !== null && state.workModePressed !== null
    && state.chatModePressed === state.workModePressed);

const conversationModeUnsettled = (state: ConversationState): boolean =>
  state.chatModeRaw !== 1 || state.chatModeEligible !== 1
  || state.workModeRaw !== 1 || state.workModeEligible !== 1;

const conversationDisposition = (observation: GptCoherentObservation) => {
  const state = projectConversationState(observation);
  if (invalidConversation(state)) return "HARD_FAIL" as const;
  if (conversationModeUnsettled(state)) return "TRANSIENT_DOM" as const;
  if (state.chatModePressed === null || state.workModePressed === null) return "HARD_FAIL" as const;
  return state.composerRaw === 1 && state.composerEligible === 1 && state.composerHash !== null
    ? exactChatModeSelected(state) && state.composerHash === hashConversationValue("")
      ? "STABLE_DONE" as const : "STABLE_ACT" as const
    : "TRANSIENT_DOM" as const;
};

export const readConversationState = async (
  browser: BrowserTargetLease,
  signal?: AbortSignal,
): Promise<ConversationState> => projectConversationState(
  await readConfirmedCoherentObservation(
    browser, CONVERSATION_QUERIES, conversationDisposition, signal,
  ),
);
