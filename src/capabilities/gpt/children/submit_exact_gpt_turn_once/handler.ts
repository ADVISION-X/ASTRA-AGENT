import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  canonicalConversationOrNull,
  composerFilesInput,
  composerHashInput,
  exactAttachmentSet,
  gptComposerHash,
  readDraftState,
  requireExactComposer,
  submissionMatch,
} from "./observation.js";
import { GPT_SEND_SELECTOR, GPT_USER_TURN_SELECTOR } from "./selectors.js";

export const submitExactGptTurnOnceHandler: GptChildHandler<"submit_exact_gpt_turn_once"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["files", "promptHash", "turnMarker"]);
    const files = composerFilesInput(intent);
    const promptHash = composerHashInput(intent, "promptHash");
    stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const observed = await readDraftState(browser, "precondition");
    requireExactComposer(observed);
    const alreadySubmitted = submissionMatch(observed, promptHash);
    if (alreadySubmitted.length > 1) {
      throw executionFailure("failed", `GPT_SUBMITTED_TURN_COUNT_${alreadySubmitted.length}`);
    }
    if (alreadySubmitted.length === 1 && canonicalConversationOrNull(observed.currentUrl)) return success({
      value: { promptHash, mutationSent: false },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
    if (context.mutationMode === "readback") throw executionFailure("failed", "GPT_TURN_SUBMISSION_PENDING");
    if (observed.composerHash !== promptHash
      || observed.sendRaw !== 1 || observed.sendEligible !== 1 || observed.sendTag !== "BUTTON"
      || observed.sendDisabled !== false || observed.sendAriaDisabled !== false
      || !exactAttachmentSet(observed, files)
      || observed.userTurns.length >= 20) {
      throw executionFailure("failed", "GPT_SUBMIT_PRECONDITION_INVALID");
    }
    await browser.executeDomIntent({
      kind: "click", selector: GPT_SEND_SELECTOR, expectedMatches: 1,
      postClickMatch: { selector: GPT_USER_TURN_SELECTOR,
        expectedMatches: observed.userTurns.length + 1, timeoutMs: 5_000 },
    });
    const readback = await readDraftState(browser, "postcondition");
    requireExactComposer(readback);
    const submitted = submissionMatch(readback, promptHash);
    const canonicalUrl = canonicalConversationOrNull(readback.currentUrl);
    if (submitted.length !== 1 || readback.composerHash !== gptComposerHash("") || canonicalUrl === null) {
      throw executionFailure("failed", "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED");
    }
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    return success({
      value: { promptHash, mutationSent: true },
      ...declaredFacts({ ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }),
    });
  };
