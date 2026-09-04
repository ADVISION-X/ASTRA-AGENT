import { createHash } from "node:crypto";
import { executionFailure } from "../../../../lib/execution-failure.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  declaredFacts, numberInput, requireBrowser, requireConfirmedBrowserFact,
  requireExactInputKeys, stringInput, success,
} from "../child-handler.js";
import {
  projectCoherentObservation, readCoherentObservation, readExactAssistantTurn,
  type GptCoherentFactProjection, type GptExactAssistantTurnObservation,
} from "../gpt-dom-observation.js";
import { GPT_ATTACHMENT_REGION_SELECTOR } from "../contracts/attachment.contract.js";
import {
  GPT_ACTIVE_ACTIONS_MENU_SELECTOR, GPT_ASSISTANT_TURN_SELECTOR, GPT_COMPOSER_SELECTOR,
  GPT_FORK_ACTION_SELECTOR, GPT_GENERATING_STOP_SELECTOR, GPT_USER_TURN_SELECTOR,
  gptMoreActionsButtonSelector,
} from "../gpt-page-selectors.js";
import {
  canonicalGptConversationUrl, isGptRootUrl,
} from "../contracts/target-document.contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const TURN = /^conversation-turn-([1-9][0-9]*)$/u;
type AnyHandler = NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>;
type AnyIntent = Parameters<AnyHandler>[0];

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const hashInput = (intent: AnyIntent, key: string): `sha256:${string}` => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  return value as `sha256:${string}`;
};

const timeoutInput = (intent: AnyIntent): number => {
  const value = numberInput(intent, "timeoutMs");
  if (!Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:timeoutMs`);
  }
  return value;
};

const turnOrdinal = (turnId: string): number => {
  const match = TURN.exec(turnId);
  const ordinal = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) throw executionFailure("failed", "GPT_TURN_ID_INVALID");
  return ordinal;
};

type PageTurn = Readonly<{ testId: string; contentHash: string }>;
type ConversationState = Readonly<{
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
  triggerExpanded: string | null;
  menuRaw: number;
  menuEligible: number;
  forkRaw: number;
  forkEligible: number;
  facts: GptCoherentFactProjection;
}>;

const readConversationState = async (
  browser: BrowserTargetLease,
  triggerAssistantTurnId?: string,
): Promise<ConversationState> => {
  const queries = [
    { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2,
      fields: ["semanticTextHash" as const] },
    { queryId: "user-turns", selector: GPT_USER_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId" as const, "semanticTextHash" as const] },
    { queryId: "assistant-turns", selector: GPT_ASSISTANT_TURN_SELECTOR, maxMatches: 20,
      fields: ["testId" as const] },
    { queryId: "attachments", selector: GPT_ATTACHMENT_REGION_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "generating", selector: GPT_GENERATING_STOP_SELECTOR, maxMatches: 2, fields: [] },
    ...(triggerAssistantTurnId === undefined ? [] : [
      { queryId: "source-trigger", selector: gptMoreActionsButtonSelector(triggerAssistantTurnId),
        maxMatches: 2, fields: ["ariaExpanded" as const] },
      { queryId: "active-menu", selector: GPT_ACTIVE_ACTIONS_MENU_SELECTOR, maxMatches: 2, fields: [] },
      { queryId: "fork-leaf", selector: GPT_FORK_ACTION_SELECTOR, maxMatches: 2, fields: [] },
    ]),
  ];
  const observation = await readCoherentObservation(browser, queries);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId);
  const composer = row("composer")!;
  const users = row("user-turns")!;
  const assistants = row("assistant-turns")!;
  const userTurns = users.matches.map((match) => {
    if (typeof match.testId !== "string" || !TURN.test(match.testId)
      || typeof match.semanticTextHash !== "string" || !HASH.test(match.semanticTextHash)) {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return Object.freeze({ testId: match.testId, contentHash: match.semanticTextHash });
  });
  const assistantTurnIds = assistants.matches.map((match) => {
    if (typeof match.testId !== "string" || !TURN.test(match.testId)) {
      throw executionFailure("failed", "GPT_DOM_RESULT_INVALID");
    }
    return match.testId;
  });
  const trigger = row("source-trigger");
  const triggerExpanded = trigger?.matches[0]?.ariaExpanded;
  const composerHash = composer.matches[0]?.semanticTextHash;
  return Object.freeze({
    currentUrl: observation.currentUrl,
    composerRaw: composer.rawCount,
    composerEligible: composer.eligibleCount,
    composerHash: typeof composerHash === "string" ? composerHash : null,
    userRaw: users.rawCount,
    userTurns: Object.freeze(userTurns),
    assistantRaw: assistants.rawCount,
    assistantTurnIds: Object.freeze(assistantTurnIds),
    attachmentsRaw: row("attachments")!.rawCount,
    generatingRaw: row("generating")!.rawCount,
    triggerRaw: trigger?.rawCount ?? 0,
    triggerEligible: trigger?.eligibleCount ?? 0,
    triggerExpanded: typeof triggerExpanded === "string" ? triggerExpanded : null,
    menuRaw: row("active-menu")?.rawCount ?? 0,
    menuEligible: row("active-menu")?.eligibleCount ?? 0,
    forkRaw: row("fork-leaf")?.rawCount ?? 0,
    forkEligible: row("fork-leaf")?.eligibleCount ?? 0,
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

const sourceCheckpointInput = (intent: AnyIntent) => {
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

const requireSourceCheckpoint = async (
  browser: BrowserTargetLease,
  source: ReturnType<typeof sourceCheckpointInput>,
  state: ConversationState,
): Promise<GptCoherentFactProjection> => {
  if (state.currentUrl !== source.sourceUrl) throw executionFailure("failed", "GPT_FORK_SOURCE_CONVERSATION_MISMATCH");
  const userOrdinal = turnOrdinal(source.assistantTurnId) - 1;
  if (userOrdinal < 1) throw executionFailure("failed", "GPT_FORK_SOURCE_INVALID");
  const userTurnId = `conversation-turn-${userOrdinal}`;
  const user = state.userTurns.filter((turn) => turn.testId === userTurnId && turn.contentHash === source.promptHash);
  if (user.length !== 1 || !state.assistantTurnIds.includes(source.assistantTurnId)) {
    throw executionFailure("failed", "GPT_FORK_SOURCE_CHECKPOINT_MISMATCH");
  }
  const assistant = await readExactAssistantTurn(browser, source.assistantTurnId);
  if (assistant.semanticTextHash !== source.responseHash) {
    throw executionFailure("failed", "GPT_FORK_SOURCE_CHECKPOINT_MISMATCH");
  }
  return assistantFacts(state.facts, assistant);
};

const mutationFacts = (
  intent: AnyIntent,
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

const freshChatTopology = (state: ConversationState): boolean => state.composerRaw === 1
  && state.composerEligible === 1 && state.composerHash !== null
  && state.userRaw === 0 && state.assistantRaw === 0
  && state.attachmentsRaw === 0 && state.generatingRaw === 0
  && isGptRootUrl(state.currentUrl);

const freshChatFailureCode = (state: ConversationState): string => {
  const failure = [
    [!isGptRootUrl(state.currentUrl), "GPT_CHAT_ROOT_URL_CHANGED"],
    [state.composerRaw === 0, "GPT_CHAT_COMPOSER_MISSING"],
    [state.composerRaw !== 1, "GPT_CHAT_COMPOSER_AMBIGUOUS"],
    [state.composerEligible !== 1, "GPT_CHAT_COMPOSER_NOT_ACTIONABLE"],
    [state.composerHash === null, "GPT_CHAT_DRAFT_HASH_MISSING"],
    [state.userRaw !== 0, "GPT_CHAT_PRIOR_USER_TURN_PRESENT"],
    [state.assistantRaw !== 0, "GPT_CHAT_PRIOR_ASSISTANT_TURN_PRESENT"],
    [state.attachmentsRaw !== 0, "GPT_CHAT_ATTACHMENT_PRESENT"],
    [state.generatingRaw !== 0, "GPT_CHAT_GENERATION_PRESENT"],
  ] as const;
  return failure.find(([matches]) => matches)?.[1] ?? "GPT_CHAT_DRAFT_NOT_EMPTY_AFTER_CLEAR";
};

const checkpointActionsMenuReady = (state: ConversationState): boolean => state.menuRaw === 1
  && state.menuEligible === 1 && state.forkRaw === 1 && state.forkEligible === 1
  && state.triggerExpanded === "true";

const checkpointActionsMenuAbsent = (state: ConversationState): boolean => state.menuRaw === 0
  && state.forkRaw === 0 && state.triggerExpanded !== "true";

const checkpointActionsReadbackReady = (state: ConversationState): boolean => state.triggerRaw === 1
  && state.triggerEligible === 1 && state.triggerExpanded === "true"
  && checkpointActionsMenuReady(state);

export const conversationChildHandlers = {
  async prepare_clean_gpt_chat(intent, context) {
    requireExactInputKeys(intent, ["timeoutMs"]);
    const deadline = Date.now() + timeoutInput(intent);
    const browser = requireBrowser(context);
    let draftNeedsClear = false;
    do {
      const observed = await readConversationState(browser);
      const freshTopology = freshChatTopology(observed);
      if (freshTopology && observed.composerHash === hash("")) return success({
        value: { composer: 1, turns: 0, attachments: 0, generating: 0,
          draftEmpty: true, staleDraftCleared: false },
        ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
          browserFact: null, nativeFailureCode: null }),
      });
      if (freshTopology) {
        draftNeedsClear = true;
        break;
      }
      const remaining = deadline - Date.now();
      if (remaining > 0) await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
    } while (Date.now() < deadline);
    if (!draftNeedsClear) throw executionFailure("failed", "GPT_CHAT_HYDRATION_PENDING");
    if (context.mutationMode === "readback") throw executionFailure("failed", "GPT_CHAT_DRAFT_CLEAR_PENDING");
    await browser.executeDomIntent({
      kind: "fill", selector: GPT_COMPOSER_SELECTOR, approvedText: "",
      clearBeforeType: true, expectedMatches: 1,
    });
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    const readback = await readConversationState(browser);
    const proofFacts = declaredFacts({
      ...readback.facts, decision: "ACT", mutationOutcome: browserFact.mutationOutcome,
      factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
      authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
      browserFact, nativeFailureCode: null,
    });
    if (!freshChatTopology(readback) || readback.composerHash !== hash("")) {
      const causeCode = freshChatFailureCode(readback);
      throw gptExecutionFailure("GPT_CHAT_DRAFT_CLEAR_FAILED", {
        mutationOutcome: browserFact.mutationOutcome,
        evidence: { evidenceRef: browserFact.evidenceRef, evidenceHash: browserFact.evidenceHash },
        browserEffect: {
          effectScope: browserFact.effectScope,
          childCapabilityId: browserFact.childCapabilityId,
          browserOutcome: browserFact.browserOutcome,
        },
        proofFacts,
        cause: Object.assign(new Error(causeCode), { code: causeCode }),
      });
    }
    return success({
      value: { composer: 1, turns: 0, attachments: 0, generating: 0,
        draftEmpty: true, staleDraftCleared: browserFact.mutationOutcome === "confirmed" },
      ...proofFacts,
    });
  },

  async focus_exact_gpt_conversation(intent, context) {
    requireExactInputKeys(intent, ["canonicalConversationUrl"]);
    const expected = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const browser = requireBrowser(context);
    const observed = await readConversationState(browser);
    if (observed.currentUrl === expected) return success({
      value: { url: expected, state: "already-focused" },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
    if (context.mutationMode === "readback") {
      throw executionFailure("failed", "GPT_CONVERSATION_NAVIGATION_NOT_YET_CONFIRMED");
    }
    await browser.navigate({ url: expected, title: "focus exact GPT conversation" });
    const readback = await readConversationState(browser);
    if (readback.currentUrl !== expected) {
      throw executionFailure("failed", "GPT_CONVERSATION_NAVIGATION_NOT_YET_CONFIRMED");
    }
    return success({
      value: { url: expected, state: "focused" },
      ...declaredFacts({ ...readback.facts, decision: "ACT", mutationOutcome: "confirmed",
        browserFact: null, nativeFailureCode: null }),
    });
  },

  async verify_gpt_conversation_identity(intent, context) {
    requireExactInputKeys(intent, [
      "canonicalConversationUrl", "expectedPromptHash", "expectedResponseHash", "timeoutMs", "turnMarker",
    ]);
    const expectedUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const expectedPromptHash = hashInput(intent, "expectedPromptHash");
    const expectedResponseHash = hashInput(intent, "expectedResponseHash");
    const marker = stringInput(intent, "turnMarker");
    const deadline = Date.now() + timeoutInput(intent);
    const browser = requireBrowser(context);
    do {
      const observed = await readConversationState(browser);
      const matchingUsers = observed.userTurns.filter((turn) => turn.contentHash === expectedPromptHash);
      if (observed.currentUrl === expectedUrl && observed.composerEligible === 1 && matchingUsers.length === 1) {
        const userTurnId = matchingUsers[0]!.testId;
        const assistantTurnId = `conversation-turn-${turnOrdinal(userTurnId) + 1}`;
        if (observed.assistantTurnIds.includes(assistantTurnId)) {
          const assistant = await readExactAssistantTurn(browser, assistantTurnId);
          if (assistant.semanticTextHash !== expectedResponseHash) {
            throw executionFailure("failed", "GPT_RESPONSE_CHECKPOINT_MISMATCH");
          }
          const facts = assistantFacts(observed.facts, assistant);
          return success({
            value: { canonicalConversationUrl: expectedUrl, turnMarker: marker, userTurnId, assistantTurnId,
              semanticText: assistant.semanticText, promptHash: expectedPromptHash,
              responseHash: expectedResponseHash,
              conversationHash: hash(`${expectedUrl}\n${marker}\n${userTurnId}\n${expectedPromptHash}\n${expectedResponseHash}`) },
            ...declaredFacts({ ...facts, decision: "DONE", mutationOutcome: "no",
              browserFact: null, nativeFailureCode: null }),
          });
        }
      }
      const remaining = deadline - Date.now();
      if (remaining > 0) await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
    } while (Date.now() < deadline);
    throw executionFailure("failed", "GPT_CONVERSATION_HYDRATION_PENDING");
  },

  async open_gpt_checkpoint_actions_menu(intent, context) {
    requireExactInputKeys(intent, ["sourceAssistantTurnId", "sourceCanonicalConversationUrl", "sourcePromptHash",
      "sourceResponseHash", "sourceTurnMarker", "timeoutMs"]);
    const source = sourceCheckpointInput(intent);
    const browser = requireBrowser(context);
    const observed = await readConversationState(browser, source.assistantTurnId);
    const sourceFacts = await requireSourceCheckpoint(browser, source, observed);
    if (observed.triggerRaw !== 1 || observed.triggerEligible !== 1) {
      throw executionFailure("failed", "GPT_CHECKPOINT_ACTIONS_TRIGGER_NOT_UNIQUE");
    }
    if (checkpointActionsMenuReady(observed)) {
      return success({
        value: { sourceAssistantTurnId: source.assistantTurnId, state: "already-open" },
        ...declaredFacts({ ...sourceFacts, decision: "DONE", mutationOutcome: "no",
          browserFact: null, nativeFailureCode: null }),
      });
    }
    if (!checkpointActionsMenuAbsent(observed)) {
      throw executionFailure("failed", "GPT_CHECKPOINT_ACTIONS_MENU_AMBIGUOUS");
    }
    if (context.mutationMode === "readback") {
      throw executionFailure("failed", "GPT_CHECKPOINT_ACTIONS_MENU_NOT_CONFIRMED");
    }
    await browser.executeDomIntent({
      kind: "click", selector: gptMoreActionsButtonSelector(source.assistantTurnId), expectedMatches: 1,
      postClickMatch: { selector: GPT_FORK_ACTION_SELECTOR, expectedMatches: 1,
        timeoutMs: Math.min(source.timeoutMs, 5_000) },
    });
    const readback = await readConversationState(browser, source.assistantTurnId);
    if (!checkpointActionsReadbackReady(readback)) {
      throw executionFailure("failed", "GPT_CHECKPOINT_ACTIONS_MENU_NOT_CONFIRMED");
    }
    return success({
      value: { sourceAssistantTurnId: source.assistantTurnId, state: "opened" },
      ...mutationFacts(intent, browser, readback.facts),
    });
  },

  async fork_exact_gpt_conversation_at_checkpoint(intent, context) {
    requireExactInputKeys(intent, ["sourceAssistantTurnId", "sourceCanonicalConversationUrl", "sourcePromptHash",
      "sourceResponseHash", "sourceTurnMarker", "timeoutMs"]);
    const source = sourceCheckpointInput(intent);
    const browser = requireBrowser(context);
    const observed = await readConversationState(browser, source.assistantTurnId);
    if (context.mutationMode === "readback") {
      const childUrl = canonicalGptConversationUrl(observed.currentUrl);
      if (childUrl === source.sourceUrl) throw executionFailure("failed", "GPT_FORK_CHILD_NOT_CONFIRMED");
      const childFacts = await requireSourceCheckpoint(browser, { ...source, sourceUrl: childUrl }, observed);
      return success({
        value: { sourceCanonicalConversationUrl: source.sourceUrl, sourceAssistantTurnId: source.assistantTurnId,
          childCanonicalConversationUrl: childUrl,
          sourceToChildRelationHash: hash(`${source.sourceUrl}\n${source.assistantTurnId}\n${source.responseHash}\n${childUrl}`) },
        ...declaredFacts({ ...childFacts, decision: "DONE", mutationOutcome: "no",
          browserFact: null, nativeFailureCode: null }),
      });
    }
    await requireSourceCheckpoint(browser, source, observed);
    if (observed.triggerExpanded !== "true" || observed.menuEligible !== 1 || observed.forkEligible !== 1) {
      throw executionFailure("failed", "GPT_FORK_ACTION_NOT_UNIQUE");
    }
    await browser.executeDomIntent({
      kind: "click", selector: GPT_FORK_ACTION_SELECTOR, expectedMatches: 1,
      postClickUrl: { notEquals: source.sourceUrl, timeoutMs: Math.min(source.timeoutMs, 5_000) },
    });
    const readback = await readConversationState(browser);
    const childUrl = canonicalGptConversationUrl(readback.currentUrl);
    if (childUrl === source.sourceUrl) throw executionFailure("failed", "GPT_FORK_CHILD_NOT_CONFIRMED");
    const childFacts = await requireSourceCheckpoint(browser, { ...source, sourceUrl: childUrl }, readback);
    return success({
      value: { sourceCanonicalConversationUrl: source.sourceUrl, sourceAssistantTurnId: source.assistantTurnId,
        childCanonicalConversationUrl: childUrl,
        sourceToChildRelationHash: hash(`${source.sourceUrl}\n${source.assistantTurnId}\n${source.responseHash}\n${childUrl}`) },
      ...mutationFacts(intent, browser, childFacts),
    });
  },
} satisfies GptChildHandlerMap;
