import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { projectCoherentObservation, readCoherentObservation } from "../../web/gpt-dom-observation.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

const readCurrentUrl = async (browser: ReturnType<typeof requireBrowser>) => {
  const observed = await readCoherentObservation(browser, [
    { queryId: "document", selector: "html", maxMatches: 1, fields: [] },
  ]);
  return Object.freeze({
    currentUrl: observed.currentUrl,
    facts: projectCoherentObservation(observed, "document"),
  });
};

export const focusExactGptConversationHandler: GptChildHandler<"focus_exact_gpt_conversation"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["canonicalConversationUrl"]);
    const expected = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const browser = requireBrowser(context);
    const observed = await readCurrentUrl(browser);
    if (observed.currentUrl === expected) return success({
      value: { url: expected, state: "already-focused" },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
    if (context.mutationMode === "readback") {
      throw executionFailure("failed", "GPT_CONVERSATION_NAVIGATION_NOT_YET_CONFIRMED");
    }
    if (new URL(expected).pathname.split("/")[2]?.startsWith("WEB:")) {
      throw executionFailure("failed", "GPT_TRANSIENT_WEB_CONVERSATION_NAVIGATION_FORBIDDEN");
    }
    await browser.navigate({ url: expected, title: "focus exact GPT conversation" });
    const readback = await readCurrentUrl(browser);
    if (readback.currentUrl !== expected) {
      throw executionFailure("failed", "GPT_CONVERSATION_NAVIGATION_NOT_YET_CONFIRMED");
    }
    return success({
      value: { url: expected, state: "focused" },
      ...declaredFacts({ ...readback.facts, decision: "ACT", mutationOutcome: "confirmed",
        browserFact: null, nativeFailureCode: null }),
    });
  };
