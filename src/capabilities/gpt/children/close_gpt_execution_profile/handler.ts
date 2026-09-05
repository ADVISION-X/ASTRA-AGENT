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
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
} from "./selectors.js";
import { profileFromIntent } from "../../web/execution-profile-input.js";
import { topology } from "./observation.js";

export const closeGptExecutionProfileHandler: GptChildHandler<"close_gpt_execution_profile"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["profile"]);
    profileFromIntent(intent);
    const browser = requireBrowser(context);
    const observed = await topology(browser);
    if (observed.popup === 0) return success({
      value: { state: "profile-popup-closed" },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
    if (observed.popup !== 1 || observed.trigger !== 1 || observed.triggerExpanded !== "true") {
      throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_TRIGGER_INVALID");
    }
    if (context.mutationMode === "readback") {
      throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_PENDING");
    }
    await browser.executeDomIntent({
      kind: "click", selector: GPT_PROFILE_TRIGGER_SELECTOR, expectedMatches: 1,
      postClickMatch: { selector: GPT_PROFILE_POPUP_SELECTOR, expectedMatches: 0, timeoutMs: 5_000 },
    });
    const readback = await topology(browser);
    if (readback.popup !== 0) throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_PENDING");
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    return success({
      value: { state: "profile-popup-closed" },
      ...declaredFacts({ ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null }),
    });
  };
