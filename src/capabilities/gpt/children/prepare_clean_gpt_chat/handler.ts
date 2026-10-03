import { executionFailure } from "../../../../lib/execution-failure.js";
import type { GptChildBrowserFact } from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success, type GptChildHandler } from "../../web/child-handler.js";
import { decodeCoherentObservationPacket } from "../../web/gpt-dom-observation.js";
import { isGptRootUrl } from "../../web/contracts/target-document.contract.js";
import { CHAT_MODE_QUERIES, exactChatModeSelected, exactWorkModeSelected, hashConversationValue,
  projectChatModeState, readConversationState, timeoutInput, type ConversationState } from "./observation.js";
import { GPT_CHAT_MODE_CHAT_SELECTOR, GPT_COMPOSER_SELECTOR } from "./selectors.js";

const freshFailureCode = (state: ConversationState): string | null => {
  const failures = [
    [state.generatingRaw !== 0, "GPT_CHAT_GENERATION_PRESENT"], [state.attachmentsRaw !== 0, "GPT_CHAT_ATTACHMENT_PRESENT"],
    [state.userRaw !== 0, "GPT_CHAT_PRIOR_USER_TURN_PRESENT"], [state.assistantRaw !== 0, "GPT_CHAT_PRIOR_ASSISTANT_TURN_PRESENT"],
    [!isGptRootUrl(state.currentUrl), "GPT_CHAT_ROOT_URL_CHANGED"], [state.composerRaw === 0, "GPT_CHAT_COMPOSER_MISSING"],
    [state.composerRaw !== 1, "GPT_CHAT_COMPOSER_AMBIGUOUS"], [state.composerEligible !== 1, "GPT_CHAT_COMPOSER_NOT_ACTIONABLE"],
    [state.composerHash === null, "GPT_CHAT_DRAFT_HASH_MISSING"],
    [[state.chatModeRaw, state.workModeRaw].includes(0), "GPT_CHAT_MODE_MISSING"],
    [[state.chatModeRaw, state.workModeRaw].some(count => count !== 1), "GPT_CHAT_MODE_AMBIGUOUS"],
    [[state.chatModeEligible, state.workModeEligible].some(count => count !== 1), "GPT_CHAT_MODE_NOT_ACTIONABLE"],
    [[state.chatModePressed, state.workModePressed].includes(null), "GPT_CHAT_MODE_INVALID"],
    [state.chatModePressed === state.workModePressed, "GPT_CHAT_MODE_INVALID"],
  ] as const;
  return failures.find(([invalid]) => invalid)?.[1] ?? null;
};
const chatSelectionPostcondition = Object.freeze({ queries: CHAT_MODE_QUERIES.map(query => ({ ...query, expectedEligibleCount: 1 })),
  clickedCandidateAttribute: { name: "aria-pressed" as const, equals: "true" as const } });
const assertChatSelection = (mutation: unknown, before: ConversationState): void => {
  const packet = mutation && typeof mutation === "object" ? Reflect.get(mutation, "postconditionObservation") : null;
  const selected = projectChatModeState(decodeCoherentObservationPacket(packet, CHAT_MODE_QUERIES));
  if (!exactChatModeSelected(selected) || selected.currentUrl !== before.currentUrl
    || selected.facts.authorityRefHashes.slice(0, 2).join("|") !== before.facts.authorityRefHashes.slice(0, 2).join("|")) {
    throw executionFailure("failed", "GPT_CHAT_MODE_SELECTION_POSTCONDITION_INVALID");
  }
};
const preparedResult = (state: ConversationState, fact: GptChildBrowserFact, selectedMode: boolean) => {
  const facts = declaredFacts({ ...state.facts, decision: fact.mutationOutcome === "no" ? "DONE" : "ACT", mutationOutcome: fact.mutationOutcome,
    browserFact: fact, nativeFailureCode: null, factResultIds: [...state.facts.factResultIds, fact.evidenceRef],
    authorityRefHashes: [...state.facts.authorityRefHashes, fact.evidenceHash] });
  const failure = freshFailureCode(state) ?? (!exactChatModeSelected(state) ? "GPT_CHAT_MODE_NOT_CHAT"
    : state.composerHash !== hashConversationValue("") ? "GPT_CHAT_DRAFT_NOT_EMPTY_AFTER_CLEAR" : null);
  if (failure) throw gptExecutionFailure(selectedMode ? "GPT_CHAT_MODE_SELECTION_POSTCONDITION_INVALID" : "GPT_CHAT_DRAFT_CLEAR_FAILED", {
    mutationOutcome: fact.mutationOutcome, proofFacts: { ...facts, decision: "FAIL_CLOSED" },
    evidence: { evidenceRef: fact.evidenceRef, evidenceHash: fact.evidenceHash },
    browserEffect: { effectScope: fact.effectScope, childCapabilityId: fact.childCapabilityId, browserOutcome: fact.browserOutcome },
    cause: Object.assign(new Error(failure), { code: failure }) });
  return success({ value: { composer: 1, turns: 0, attachments: 0, generating: 0, draftEmpty: true as const,
    staleDraftCleared: !selectedMode && fact.mutationOutcome === "confirmed" }, ...facts });
};
export const prepareCleanGptChatHandler: GptChildHandler<"prepare_clean_gpt_chat"> = async (intent, context) => {
  requireExactInputKeys(intent, ["timeoutMs"]); timeoutInput(intent);
  const browser = requireBrowser(context), observed = await readConversationState(browser, context.signal);
  const invalid = freshFailureCode(observed);
  if (invalid) throw executionFailure("failed", invalid);
  const empty = observed.composerHash === hashConversationValue(""), selectMode = exactWorkModeSelected(observed);
  if (selectMode && !empty) throw executionFailure("failed", "GPT_CHAT_MODE_WORK_SELECTED_WITH_DRAFT");
  if (!selectMode && empty) return success({ value: { composer: 1, turns: 0, attachments: 0, generating: 0, draftEmpty: true, staleDraftCleared: false },
    ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no", browserFact: null, nativeFailureCode: null }) });
  const mutation = await browser.executeDomIntent(selectMode
    ? { kind: "click", selector: GPT_CHAT_MODE_CHAT_SELECTOR, expectedTextEquals: "聊天", expectedMatches: 1, postClickObservation: chatSelectionPostcondition }
    : { kind: "fill", selector: GPT_COMPOSER_SELECTOR, approvedText: "", clearBeforeType: true, expectedMatches: 1 });
  const projected = projectBrowserFact(intent, context);
  if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.outcome.physicalInputCount > 1) throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  if (selectMode) assertChatSelection(mutation, observed);
  return preparedResult(await readConversationState(browser, context.signal), projected.fact, selectMode);
};
