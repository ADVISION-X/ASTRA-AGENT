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
  composerFilesInput,
  composerHashInput,
  canonicalConversationOrNull,
  exactAttachmentSet,
  readDraftState,
  requireExactComposer,
  submissionMatch,
} from "./observation.js";
import { GPT_SEND_SELECTOR, GPT_USER_TURN_SELECTOR } from "./selectors.js";

const submissionReady = (
  observed: Awaited<ReturnType<typeof readDraftState>>,
  promptHash: `sha256:${string}`,
  files: ReturnType<typeof composerFilesInput>,
): boolean => observed.composerHash === promptHash
  && observed.sendRaw === 1
  && observed.sendEligible === 1
  && observed.sendTag === "BUTTON"
  && observed.sendDisabled === false
  && observed.sendAriaDisabled === false
  && exactAttachmentSet(observed, files)
  && observed.userTurns.length < 20;

const submissionComplete = (
  observed: Awaited<ReturnType<typeof readDraftState>>,
  promptHash: `sha256:${string}`,
): boolean => submissionMatch(observed, promptHash).length === 1;

export const submitExactGptTurnOnceHandler: GptChildHandler<"submit_exact_gpt_turn_once"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["files", "promptHash", "turnMarker"]);
    const files = composerFilesInput(intent);
    const promptHash = composerHashInput(intent, "promptHash");
    const turnMarker = stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const observed = await readDraftState(browser, "precondition");
    requireExactComposer(observed);
    const alreadySubmitted = submissionMatch(observed, promptHash);
    if (alreadySubmitted.length > 1) {
      throw executionFailure("failed", `GPT_SUBMITTED_TURN_COUNT_${alreadySubmitted.length}`);
    }
    if (alreadySubmitted.length === 1) {
      throw executionFailure("failed", "GPT_TURN_ALREADY_SUBMITTED_OUTSIDE_CALL");
    }
    if (context.mutationMode === "readback") throw executionFailure("failed", "GPT_TURN_SUBMISSION_PENDING");
    if (!submissionReady(observed, promptHash, files)) {
      throw executionFailure("failed", "GPT_SUBMIT_PRECONDITION_INVALID");
    }
    await browser.executeDomIntent({
      kind: "click", selector: GPT_SEND_SELECTOR, expectedMatches: 1,
      postClickMatch: { selector: GPT_USER_TURN_SELECTOR,
        expectedMatches: observed.userTurns.length + 1, timeoutMs: 5_000 },
    });
    const readback = await readDraftState(browser, "postcondition");
    if (!submissionComplete(readback, promptHash)) {
      throw executionFailure("failed", "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED");
    }
    const canonicalConversationUrl = canonicalConversationOrNull(readback.currentUrl);
    const userTurn = submissionMatch(readback, promptHash)[0];
    if (!canonicalConversationUrl || !userTurn) {
      throw executionFailure("failed", "GPT_TURN_SUBMISSION_LOCATOR_MISSING");
    }
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    return success({
      value: { status: "CONFIRMED", promptHash, turnMarker, mutationSent: true,
        canonicalConversationUrl, userTurnId: userTurn.testId },
      ...declaredFacts({ ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }),
    });
  };
