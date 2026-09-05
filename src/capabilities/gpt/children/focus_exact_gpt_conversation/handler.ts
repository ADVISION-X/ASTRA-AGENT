import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { readConversationState } from "./observation.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";
import { waitForGptDirectMutationSettlement } from "../../web/direct-mutation-settlement.js";

export const focusExactGptConversationHandler: GptChildHandler<"focus_exact_gpt_conversation"> =
  async (intent, context) => {
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
    const readback = await waitForGptDirectMutationSettlement(
      browser,
      () => readConversationState(browser),
      (state) => state.currentUrl === expected,
      () => false,
    );
    if (readback.currentUrl !== expected) {
      throw executionFailure("failed", "GPT_CONVERSATION_NAVIGATION_NOT_YET_CONFIRMED");
    }
    return success({
      value: { url: expected, state: "focused" },
      ...declaredFacts({ ...readback.facts, decision: "ACT", mutationOutcome: "confirmed",
        browserFact: null, nativeFailureCode: null }),
    });
  };
