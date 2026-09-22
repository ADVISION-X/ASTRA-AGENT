import { executionFailure } from "../../../../lib/execution-failure.js";
import { GPT_MODEL_SELECTION_VERSION } from "../../contract.js";
import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import { profileFromIntent } from "../../web/execution-profile-input.js";
import { GPT_MODEL_SELECTOR_OPENABLE_ENTRY, GPT_MODEL_SELECTOR_OPTION } from "./selectors.js";
import {
  modelSelectorOpenable,
  modelSelectorReady,
  modelSelectorStateCode,
  readModelSelectorState,
} from "./observation.js";

export const openGptModelSelectorV3Handler: GptChildHandler<"open_gpt_model_selector_v3"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["profile"]);
    const profile = profileFromIntent(intent);
    const browser = requireBrowser(context);
    const observed = await readModelSelectorState(browser, profile.startModelDisplayName, context.signal);
    if (modelSelectorReady(observed)) return success({
      value: { selectionVersion: GPT_MODEL_SELECTION_VERSION, state: "model-selector-open" },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
    if (!modelSelectorOpenable(observed)) {
      throw executionFailure("failed", `GPT_MODEL_SELECTOR_V3_STATE_INVALID:${modelSelectorStateCode(observed)}`);
    }
    const mutation = await browser.executeDomIntent({
      kind: "click", selector: GPT_MODEL_SELECTOR_OPENABLE_ENTRY, expectedMatches: 1,
      postClickMinimumDelayMs: 2_500,
      postClickMatch: { selector: GPT_MODEL_SELECTOR_OPTION,
        textEquals: profile.startModelDisplayName, expectedMatches: 1 },
    });
    const record = mutation && typeof mutation === "object" && !Array.isArray(mutation)
      ? mutation as Readonly<Record<string, unknown>> : {};
    if (record.postconditionVerified !== true || record.postconditionEligibleCount !== 1) {
      throw executionFailure("failed", "GPT_MODEL_SELECTOR_V3_POSTCONDITION_INVALID");
    }
    const browserFact = requireConfirmedBrowserFact(intent, context, { allowNoMutationOutcome: true });
    const didMutate = browserFact.mutationOutcome === "confirmed";
    return success({
      value: { selectionVersion: GPT_MODEL_SELECTION_VERSION,
        state: didMutate ? "model-selector-opened" : "model-selector-open" },
      ...declaredFacts({
        ...observed.facts, decision: didMutate ? "ACT" : "DONE",
        factResultIds: Object.freeze([...observed.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...observed.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: browserFact.mutationOutcome, browserFact, nativeFailureCode: null,
      }),
    });
  };
