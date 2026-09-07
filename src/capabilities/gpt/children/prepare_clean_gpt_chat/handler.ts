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
  type ConversationState,
  hashConversationValue,
  readConversationState,
  timeoutInput,
} from "./observation.js";
import { isGptRootUrl } from "../../web/contracts/target-document.contract.js";
import { GPT_COMPOSER_SELECTOR } from "./selectors.js";

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

export const prepareCleanGptChatHandler: GptChildHandler<"prepare_clean_gpt_chat"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["timeoutMs"]);
    const deadline = Date.now() + timeoutInput(intent);
    const browser = requireBrowser(context);
    let draftNeedsClear = false;
    do {
      const observed = await readConversationState(browser);
      const freshTopology = freshChatTopology(observed);
      if (freshTopology && observed.composerHash === hashConversationValue("")) return success({
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
      if (remaining > 0) {
        await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
      }
    } while (Date.now() < deadline);
    if (!draftNeedsClear) throw executionFailure("failed", "GPT_CHAT_HYDRATION_PENDING");
    if (context.mutationMode === "readback") {
      throw executionFailure("failed", "GPT_CHAT_DRAFT_CLEAR_PENDING");
    }
    await browser.executeDomIntent({
      kind: "fill", selector: GPT_COMPOSER_SELECTOR, approvedText: "",
      clearBeforeType: true, expectedMatches: 1,
    });
    const browserFact = requireConfirmedBrowserFact(intent, browser, { allowNoMutationOutcome: true });
    const readback = await readConversationState(browser);
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
