import { GPT_MODEL_SELECTION_VERSION } from "../../contract.js";
import { GPT_LATEST_MODEL_LABELS, profileFromIntent } from "../../web/execution-profile-input.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success,
  type GptChildHandler } from "../../web/child-handler.js";
import { modelSelectorOpenable, modelSelectorReady, modelSelectorStateCode, readModelSelectorState } from "./observation.js";
import { GPT_MODEL_SELECTOR_OPENABLE_ENTRY, GPT_MODEL_SELECTOR_OPTION } from "./selectors.js";
export const openGptModelSelectorV3Handler: GptChildHandler<"open_gpt_model_selector_v3"> = async (intent, context) => {
  requireExactInputKeys(intent, ["profile"]);
  const profile = profileFromIntent(intent), browser = requireBrowser(context);
  const observed = await readModelSelectorState(browser, profile.startModelDisplayName, context.signal);
  if (modelSelectorReady(observed)) return success({ value: { selectionVersion: GPT_MODEL_SELECTION_VERSION, state: "model-selector-open" },
    ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no", browserFact: null, nativeFailureCode: null }) });
  if (!modelSelectorOpenable(observed)) throw gptExecutionFailure(`GPT_MODEL_SELECTOR_V3_STATE_INVALID:${modelSelectorStateCode(observed)}`);
  const mutation = await browser.executeDomIntent({ kind: "click", selector: GPT_MODEL_SELECTOR_OPENABLE_ENTRY,
    expectedMatches: 1, postClickMinimumDelayMs: 2_500,
    postClickMatch: { selector: GPT_MODEL_SELECTOR_OPTION, expectedMatches: 1,
      textEquals: profile.startModelDisplayName === "最新" ? GPT_LATEST_MODEL_LABELS : profile.startModelDisplayName } });
  const projected = projectBrowserFact(intent, context);
  if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.outcome.physicalInputCount > 1) {
    throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  }
  const result = mutation && typeof mutation === "object" ? mutation as Readonly<Record<string, unknown>> : null;
  if (result?.postconditionVerified !== true || result.postconditionEligibleCount !== 1) {
    throw gptExecutionFailure("GPT_MODEL_SELECTOR_V3_POSTCONDITION_INVALID", { mutationOutcome: projected.fact.mutationOutcome,
      proofFacts: { ...observed.facts, decision: "FAIL_CLOSED", mutationOutcome: projected.fact.mutationOutcome,
        browserFact: projected.fact, nativeFailureCode: null } });
  }
  const { fact } = projected;
  return success({ value: { selectionVersion: GPT_MODEL_SELECTION_VERSION,
    state: fact.mutationOutcome === "no" ? "model-selector-open" : "model-selector-opened" }, ...declaredFacts({ ...observed.facts,
      decision: fact.mutationOutcome === "no" ? "DONE" : "ACT", mutationOutcome: fact.mutationOutcome,
      factResultIds: [...observed.facts.factResultIds, fact.evidenceRef], authorityRefHashes: [...observed.facts.authorityRefHashes, fact.evidenceHash],
      browserFact: fact, nativeFailureCode: null }) });
};
