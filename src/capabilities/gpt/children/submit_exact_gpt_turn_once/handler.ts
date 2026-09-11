import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  composerFilesInput,
  composerHashInput,
  canonicalConversationOrNull,
  readSubmittedTurnState,
} from "./observation.js";
import {
  GPT_ATTACHMENT_ITEM_SELECTOR,
  GPT_COMPOSER_FORM_SELECTOR,
  GPT_COMPOSER_SELECTOR,
  GPT_SEND_SELECTOR,
  GPT_SUBMITTED_USER_TURN_SELECTOR,
} from "./selectors.js";

export const submitExactGptTurnOnceHandler: GptChildHandler<"submit_exact_gpt_turn_once"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["files", "promptHash"]);
    const files = composerFilesInput(intent);
    const promptHash = composerHashInput(intent, "promptHash");
    const browser = requireBrowser(context);
    await browser.executeDomIntent({
      kind: "click", selector: GPT_SEND_SELECTOR, expectedMatches: 1,
      preClickExactOutgoingTurn: {
        composerSelector: GPT_COMPOSER_SELECTOR,
        composerFormSelector: GPT_COMPOSER_FORM_SELECTOR,
        attachmentSelector: GPT_ATTACHMENT_ITEM_SELECTOR,
        expectedPromptHash: promptHash,
        expectedAttachmentLabels: Object.freeze(files.map((file) => file.providerDisplayName)),
      },
      postClickMatch: { selector: GPT_SUBMITTED_USER_TURN_SELECTOR, expectedMatches: 1, timeoutMs: 5_000 },
    });
    const readback = await readSubmittedTurnState(browser);
    const canonicalConversationUrl = canonicalConversationOrNull(readback.currentUrl);
    if (!canonicalConversationUrl || readback.userTurn?.promptHash !== promptHash) {
      throw executionFailure("failed", "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED");
    }
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    return success({
      value: { status: "CONFIRMED", promptHash, mutationSent: true,
        canonicalConversationUrl, userTurnId: readback.userTurn.testId },
      ...declaredFacts({ ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }),
    });
  };
