
import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/execution-failure.js";
import type { GptChildCapabilityIntent } from "../../contract.js";
import {
  declaredFacts,
  numberInput,
  requireConfirmedBrowserFact,
  stringInput,
} from "../../web/child-handler.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
  readExactAssistantTurn,
  type GptCoherentFactProjection,
  type GptExactAssistantTurnObservation,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_ATTACHMENT_ITEM_SELECTOR,
  GPT_COMPOSER_FORM_SELECTOR,
} from "./selectors.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";
import {
  GPT_ASSISTANT_TURN_SELECTOR,
  GPT_CHECKPOINT_ACTIONS_MENU_SELECTOR,
  GPT_COMPOSER_SELECTOR,
  GPT_FORK_DESTINATION_MENU_SELECTOR,
  GPT_FORK_TO_NEW_CHAT_SELECTOR,
  GPT_FORK_TO_NEW_CHAT_TEXT,
  GPT_GENERATING_STOP_SELECTOR,
  GPT_OPEN_FORK_ACTION_SELECTOR,
  GPT_OPEN_FORK_ACTION_TEXT,
  GPT_USER_TURN_SELECTOR,
  gptMoreActionsButtonSelector,
} from "./selectors.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TURN = /^conversation-turn-([1-9][0-9]*)$/u;
const hashInput = (
  intent: GptChildCapabilityIntent<"open_gpt_checkpoint_actions_menu">,
  key: string,
): `sha256:${string}` => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value as `sha256:${string}`;
};

const timeoutInput = (intent: GptChildCapabilityIntent<"open_gpt_checkpoint_actions_menu">): number => {
  const value = numberInput(intent, "timeoutMs");
  if (!Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:timeoutMs`);
  }
  return value;
};

const turnOrdinal = (turnId: string): number => {
  const match = TURN.exec(turnId);
  const ordinal = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) {
    throw executionFailure("failed", "GPT_TURN_ID_INVALID");
  }
  return ordinal;
};

type PageTurn = Readonly<{ testId: string; contentHash: string }>;
export type ConversationState = Readonly<{
  currentUrl: string;
  composerRaw: number;
  composerEligible: number;
  composerHash: string | null;
  userRaw: number;
  userTurns: readonly PageTurn[];
  assistantRaw: number;
  assistantTurnIds: readonly string[];
  attachmentsRaw: number;
  generatingRaw: number;
  triggerRaw: number;
  triggerEligible: number;
  triggerId: string | null;
  triggerExpanded: string | null;
  triggerMenuId: string | null;
  checkpointMenuRaw: number;
  checkpointMenuEligible: number;
  checkpointMenuId: string | null;
  checkpointMenuLabelledBy: string | null;
  openForkRaw: number;
  openForkEligible: number;
  openForkId: string | null;
  openForkExpanded: string | null;
  openForkMenuId: string | null;
  destinationMenuRaw: number;
  destinationMenuEligible: number;
  destinationMenuId: string | null;
  destinationMenuLabelledBy: string | null;
  forkToNewChatRaw: number;
  forkToNewChatEligible: number;
  facts: GptCoherentFactProjection;
}>;

export const readConversationState = async (
  browser: BrowserTargetLease,
  triggerAssistantTurnId?: string,
): Promise<ConversationState> => {
  const queries = [
    { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2,
      fields: ["exactEditableTextHash" as const] },
    { queryId: "user-turns", selector: GPT_USER_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId" as const, "exactGptUserPromptHash" as const] },
    { queryId: "assistant-turns", selector: GPT_ASSISTANT_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId" as const] },
    { queryId: "attachments", selector: GPT_ATTACHMENT_ITEM_SELECTOR,
      scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, maxMatches: 20, fields: [] },
    { queryId: "generating", selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2, fields: [] },
    ...(triggerAssistantTurnId === undefined ? [] : [
      { queryId: "source-trigger", selector: gptMoreActionsButtonSelector(triggerAssistantTurnId),
        maxMatches: 2, fields: ["id", "ariaExpanded", "ariaControls"] as const },
      { queryId: "checkpoint-menu", selector: GPT_CHECKPOINT_ACTIONS_MENU_SELECTOR, maxMatches: 2,
        fields: ["id", "ariaLabelledBy"] as const },
      { queryId: "open-fork-leaf", selector: GPT_OPEN_FORK_ACTION_SELECTOR,
        scope: { selector: GPT_CHECKPOINT_ACTIONS_MENU_SELECTOR }, textEquals: GPT_OPEN_FORK_ACTION_TEXT,
        maxMatches: 2, fields: ["id", "ariaExpanded", "ariaControls"] as const },
      { queryId: "destination-menu", selector: GPT_FORK_DESTINATION_MENU_SELECTOR, maxMatches: 2,
        fields: ["id", "ariaLabelledBy"] as const },
      { queryId: "fork-to-new-chat-leaf", selector: GPT_FORK_TO_NEW_CHAT_SELECTOR,
        scope: { selector: GPT_FORK_DESTINATION_MENU_SELECTOR }, textEquals: GPT_FORK_TO_NEW_CHAT_TEXT,
        maxMatches: 2, fields: [] },
    ]),
  ];
  const observation = await readCoherentObservation(browser, queries);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId);
  const composer = row("composer")!;
  const users = row("user-turns")!;
  const assistants = row("assistant-turns")!;
  const userTurns = users.matches.map((match) => {
    if (typeof match.testId !== "string" || !TURN.test(match.testId)
      || typeof match.exactGptUserPromptHash !== "string" || !HASH.test(match.exactGptUserPromptHash)) {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return Object.freeze({ testId: match.testId, contentHash: match.exactGptUserPromptHash });
  });
  const assistantTurnIds = assistants.matches.map((match) => {
    if (typeof match.testId !== "string" || !TURN.test(match.testId)) {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return match.testId;
  });
  const trigger = row("source-trigger");
  const checkpointMenu = row("checkpoint-menu");
  const openFork = row("open-fork-leaf");
  const destinationMenu = row("destination-menu");
  const stringField = (value: unknown): string | null => typeof value === "string" ? value : null;
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
    userRaw: users.rawCount,
    userTurns: Object.freeze(userTurns),
    assistantRaw: assistants.rawCount,
    assistantTurnIds: Object.freeze(assistantTurnIds),
    attachmentsRaw: row("attachments")!.rawCount,
    generatingRaw: row("generating")!.rawCount,
    triggerRaw: trigger?.rawCount ?? 0,
    triggerEligible: trigger?.eligibleCount ?? 0,
    triggerId: stringField(trigger?.matches[0]?.id),
    triggerExpanded: stringField(trigger?.matches[0]?.ariaExpanded),
    triggerMenuId: stringField(trigger?.matches[0]?.ariaControls),
    checkpointMenuRaw: checkpointMenu?.rawCount ?? 0,
    checkpointMenuEligible: checkpointMenu?.eligibleCount ?? 0,
    checkpointMenuId: stringField(checkpointMenu?.matches[0]?.id),
    checkpointMenuLabelledBy: stringField(checkpointMenu?.matches[0]?.ariaLabelledBy),
    openForkRaw: openFork?.rawCount ?? 0,
    openForkEligible: openFork?.eligibleCount ?? 0,
    openForkId: stringField(openFork?.matches[0]?.id),
    openForkExpanded: stringField(openFork?.matches[0]?.ariaExpanded),
    openForkMenuId: stringField(openFork?.matches[0]?.ariaControls),
    destinationMenuRaw: destinationMenu?.rawCount ?? 0,
    destinationMenuEligible: destinationMenu?.eligibleCount ?? 0,
    destinationMenuId: stringField(destinationMenu?.matches[0]?.id),
    destinationMenuLabelledBy: stringField(destinationMenu?.matches[0]?.ariaLabelledBy),
    forkToNewChatRaw: row("fork-to-new-chat-leaf")?.rawCount ?? 0,
    forkToNewChatEligible: row("fork-to-new-chat-leaf")?.eligibleCount ?? 0,
    facts: projectCoherentObservation(observation, "composer"),
  });
};

const assistantFacts = (
  facts: GptCoherentFactProjection,
  assistant: GptExactAssistantTurnObservation,
): GptCoherentFactProjection => {
  if (!facts.authorityRefHashes.includes(assistant.targetRefHash)
    || !facts.authorityRefHashes.includes(assistant.documentRefHash)) {
    throw executionFailure("failed", "GPT_EXACT_ASSISTANT_TURN_DOCUMENT_MISMATCH");
  }
  return Object.freeze({
    ...facts,
    factResultIds: Object.freeze([
      ...facts.factResultIds, `gpt-assistant-turn-fact:${assistant.exactCallIdentityHash.slice(7)}`,
    ]),
  });
};

export const sourceCheckpointInput = (
  intent: GptChildCapabilityIntent<"open_gpt_checkpoint_actions_menu">,
) => {
  const assistantTurnId = stringInput(intent, "sourceAssistantTurnId");
  if (!TURN.test(assistantTurnId)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:sourceAssistantTurnId`);
  }
  return Object.freeze({
    assistantTurnId,
    sourceUrl: canonicalGptConversationUrl(stringInput(intent, "sourceCanonicalConversationUrl")),
    promptHash: hashInput(intent, "sourcePromptHash"),
    responseHash: hashInput(intent, "sourceResponseHash"),
    marker: stringInput(intent, "sourceTurnMarker"),
    timeoutMs: timeoutInput(intent),
  });
};

export const requireSourceCheckpoint = async (
  browser: BrowserTargetLease,
  source: ReturnType<typeof sourceCheckpointInput>,
  state: ConversationState,
): Promise<GptCoherentFactProjection> => {
  if (state.currentUrl !== source.sourceUrl) {
    throw executionFailure("failed", "GPT_FORK_SOURCE_CONVERSATION_MISMATCH");
  }
  const userOrdinal = turnOrdinal(source.assistantTurnId) - 1;
  if (userOrdinal < 1) throw executionFailure("failed", "GPT_FORK_SOURCE_INVALID");
  const userTurnId = `conversation-turn-${userOrdinal}`;
  const user = state.userTurns.filter((turn) => turn.testId === userTurnId && turn.contentHash === source.promptHash);
  if (user.length !== 1 || !state.assistantTurnIds.includes(source.assistantTurnId)) {
    throw executionFailure("failed", "GPT_FORK_SOURCE_CHECKPOINT_MISMATCH");
  }
  const assistant = await readExactAssistantTurn(browser, source.assistantTurnId, {
    canonicalConversationUrl: source.sourceUrl,
    expectedPromptHash: source.promptHash,
    turnMarker: source.marker,
  });
  if (assistant.semanticTextHash !== source.responseHash) {
    throw executionFailure("failed", "GPT_FORK_SOURCE_CHECKPOINT_MISMATCH");
  }
  return assistantFacts(state.facts, assistant);
};

export const mutationFacts = (
  intent: GptChildCapabilityIntent<"open_gpt_checkpoint_actions_menu">,
  browser: BrowserTargetLease,
  facts: GptCoherentFactProjection,
) => {
  const browserFact = requireConfirmedBrowserFact(intent, browser);
  return declaredFacts({
    ...facts, decision: "ACT" as const,
    factResultIds: Object.freeze([...facts.factResultIds, browserFact.evidenceRef]),
    authorityRefHashes: Object.freeze([...facts.authorityRefHashes, browserFact.evidenceHash]),
    mutationOutcome: browserFact.mutationOutcome, browserFact, nativeFailureCode: null,
  });
};
