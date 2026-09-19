import { executionFailure } from "../../../../lib/execution-failure.js";

import { gptExecutionFailure } from "../../execution-fault.js";
import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  CHAT_MODE_QUERIES,
  type ConversationState,
  exactChatModeSelected,
  exactWorkModeSelected,
  hashConversationValue,
  projectChatModeState,
  readConversationState,
  timeoutInput,
} from "./observation.js";
import { decodeCoherentObservationPacket } from "../../web/gpt-dom-observation.js";
import { isGptRootUrl } from "../../web/contracts/target-document.contract.js";
import {
  GPT_CHAT_MODE_CHAT_SELECTOR,
  GPT_COMPOSER_SELECTOR,
} from "./selectors.js";

const CHAT_MODE_POSTCONDITION = Object.freeze({
  queries: Object.freeze(CHAT_MODE_QUERIES.map((query) => Object.freeze({
    ...query, expectedEligibleCount: 1,
  }))),
  clickedCandidateAttribute: Object.freeze({ name: "aria-checked", equals: "true" }),
});

const freshChatTopology = (state: ConversationState): boolean => state.composerRaw === 1
  && state.composerEligible === 1 && state.composerHash !== null
  && state.userRaw === 0 && state.assistantRaw === 0
  && state.attachmentsRaw === 0 && state.generatingRaw === 0
  && isGptRootUrl(state.currentUrl) && exactChatModeSelected(state);

const terminalFreshChatFailureCode = (state: ConversationState): string | null => {
  const failure = [
    [state.generatingRaw !== 0, "GPT_CHAT_GENERATION_PRESENT"],
    [state.attachmentsRaw !== 0, "GPT_CHAT_ATTACHMENT_PRESENT"],
    [state.userRaw !== 0, "GPT_CHAT_PRIOR_USER_TURN_PRESENT"],
    [state.assistantRaw !== 0, "GPT_CHAT_PRIOR_ASSISTANT_TURN_PRESENT"],
    [!isGptRootUrl(state.currentUrl), "GPT_CHAT_ROOT_URL_CHANGED"],
    [state.composerRaw > 1, "GPT_CHAT_COMPOSER_AMBIGUOUS"],
    [state.chatModeRaw === 0 || state.workModeRaw === 0, "GPT_CHAT_MODE_MISSING"],
    [state.chatModeRaw !== 1 || state.workModeRaw !== 1, "GPT_CHAT_MODE_AMBIGUOUS"],
    [state.chatModeEligible !== 1 || state.workModeEligible !== 1, "GPT_CHAT_MODE_NOT_ACTIONABLE"],
    [state.chatModeChecked === null || state.workModeChecked === null
      || state.chatModeChecked === state.workModeChecked, "GPT_CHAT_MODE_INVALID"],
  ] as const;
  return failure.find(([matches]) => matches)?.[1] ?? null;
};

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
    [!exactChatModeSelected(state), "GPT_CHAT_MODE_NOT_CHAT"],
  ] as const;
  return failure.find(([matches]) => matches)?.[1] ?? "GPT_CHAT_DRAFT_NOT_EMPTY_AFTER_CLEAR";
};

export const prepareCleanGptChatHandler: GptChildHandler<"prepare_clean_gpt_chat"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["timeoutMs"]);
    timeoutInput(intent);
    const browser = requireBrowser(context);
    const observed = await readConversationState(browser, context.signal);
    const failureCode = terminalFreshChatFailureCode(observed);
    if (failureCode) throw executionFailure("failed", failureCode);
    if (!freshChatTopology(observed) && (observed.composerRaw !== 1
      || observed.composerEligible !== 1 || observed.composerHash === null)) {
      throw executionFailure("failed", "GPT_CHAT_HYDRATION_PENDING");
    }
    if (exactWorkModeSelected(observed)) {
      if (observed.composerHash !== hashConversationValue("")) {
        throw executionFailure("failed", "GPT_CHAT_MODE_WORK_SELECTED_WITH_DRAFT");
      }
      const mutation = await browser.executeDomIntent({
        kind: "click", selector: GPT_CHAT_MODE_CHAT_SELECTOR, expectedMatches: 1,
        postClickObservation: CHAT_MODE_POSTCONDITION,
      });
      const mutationRecord = mutation && typeof mutation === "object" && !Array.isArray(mutation)
        ? mutation as Readonly<Record<string, unknown>> : {};
      const postcondition = decodeCoherentObservationPacket(
        mutationRecord.postconditionObservation, CHAT_MODE_QUERIES,
      );
      const selected = projectChatModeState(postcondition);
      if (!exactChatModeSelected(selected)
        || selected.currentUrl !== observed.currentUrl
        || selected.facts.authorityRefHashes[0] !== observed.facts.authorityRefHashes[0]
        || selected.facts.authorityRefHashes[1] !== observed.facts.authorityRefHashes[1]) {
        throw executionFailure("failed", "GPT_CHAT_MODE_SELECTION_POSTCONDITION_INVALID");
      }
      const browserFact = requireConfirmedBrowserFact(intent, context);
      const readback = await readConversationState(browser, context.signal);
      if (!freshChatTopology(readback) || readback.composerHash !== hashConversationValue("")) {
        throw gptExecutionFailure("GPT_CHAT_MODE_SELECTION_POSTCONDITION_INVALID", {
          mutationOutcome: browserFact.mutationOutcome,
          evidence: { evidenceRef: browserFact.evidenceRef, evidenceHash: browserFact.evidenceHash },
          browserEffect: {
            effectScope: browserFact.effectScope,
            childCapabilityId: browserFact.childCapabilityId,
            browserOutcome: browserFact.browserOutcome,
          },
          proofFacts: declaredFacts({
            ...readback.facts, decision: "ACT", mutationOutcome: browserFact.mutationOutcome,
            factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
            authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
            browserFact, nativeFailureCode: null,
          }),
          cause: new Error(freshChatFailureCode(readback)),
        });
      }
      return success({
        value: { composer: 1, turns: 0, attachments: 0, generating: 0,
          draftEmpty: true, staleDraftCleared: false },
        ...declaredFacts({
          ...readback.facts, decision: "ACT", mutationOutcome: browserFact.mutationOutcome,
          factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
          authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
          browserFact, nativeFailureCode: null,
        }),
      });
    }
    if (observed.composerHash === hashConversationValue("")) return success({
      value: { composer: 1, turns: 0, attachments: 0, generating: 0,
        draftEmpty: true, staleDraftCleared: false },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
    await browser.executeDomIntent({
      kind: "fill", selector: GPT_COMPOSER_SELECTOR, approvedText: "",
      clearBeforeType: true, expectedMatches: 1,
    });
    const browserFact = requireConfirmedBrowserFact(intent, context, { allowNoMutationOutcome: true });
    const readback = await readConversationState(browser, context.signal);
    const proofFacts = declaredFacts({
      ...readback.facts, decision: "ACT", mutationOutcome: browserFact.mutationOutcome,
      factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
      authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
      browserFact, nativeFailureCode: null,
    });
    if (!freshChatTopology(readback) || readback.composerHash !== hashConversationValue("")) {
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
  };
