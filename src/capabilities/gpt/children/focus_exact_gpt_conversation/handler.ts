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

const NAVIGATION_SETTLE_TIMEOUT_MS = 5_000;

const focused = (
  observed: Awaited<ReturnType<typeof readConversationState>>,
  expected: string,
): boolean => observed.currentUrl === expected
  && observed.composerEligible === 1
  && observed.matchingTurnCount === 1;

export const focusExactGptConversationHandler: GptChildHandler<"focus_exact_gpt_conversation"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["canonicalConversationUrl", "expectedPromptHash", "turnMarker"]);
    const expected = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));
    const expectedPromptHash = stringInput(intent, "expectedPromptHash");
    if (!/^sha256:[a-f0-9]{64}$/u.test(expectedPromptHash)) {
      throw executionFailure("failed", "GPT_CHILD_INPUT_INVALID:focus_exact_gpt_conversation:expectedPromptHash");
    }
    const turnMarker = stringInput(intent, "turnMarker");
    const browser = requireBrowser(context);
    const readIdentity = () => readConversationState(browser, expectedPromptHash, turnMarker);
    const observed = await readIdentity();
    if (focused(observed, expected)) return success({
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
    const deadline = Date.now() + NAVIGATION_SETTLE_TIMEOUT_MS;
    let readback = await readIdentity();
    while (!focused(readback, expected) && Date.now() < deadline) {
      const remaining = deadline - Date.now();
      if (remaining < 25) break;
      await browser.wait({ durationMs: Math.max(25, Math.min(500, Math.ceil(remaining / 20))) });
      readback = await readIdentity();
    }
    if (!focused(readback, expected)) {
      throw executionFailure("failed", "GPT_CONVERSATION_NAVIGATION_NOT_YET_CONFIRMED");
    }
    return success({
      value: { url: expected, state: "focused" },
      ...declaredFacts({ ...readback.facts, decision: "ACT", mutationOutcome: "confirmed",
        browserFact: null, nativeFailureCode: null }),
    });
  };
