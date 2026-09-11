import type { BrowserDomPostconditionQuery } from "../../../../lib/browser/browser-authority-api.js";
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
import { decodeCoherentObservationPacket } from "../../web/gpt-dom-observation.js";
import { GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR } from "./selectors.js";
import { profileFromIntent } from "../../web/execution-profile-input.js";
import {
  MODEL_SELECTOR_TOPOLOGY_QUERIES,
  modelSelectorAlreadyOpen,
  modelSelectorOpenable,
  modelSelectorTopologyCode,
  projectModelSelectorTopology,
  readModelSelectorTopology,
} from "./observation.js";

const SELECTION_POSTCONDITION = Object.freeze({
  queries: Object.freeze(MODEL_SELECTOR_TOPOLOGY_QUERIES.map((query) => Object.freeze({
    ...query,
    expectedEligibleCount: query.queryId === "advanced-panel" ? 0 : 1,
  }))) as readonly BrowserDomPostconditionQuery[],
  timeoutMs: 5_000,
  clickedCandidateAttribute: Object.freeze({ name: "aria-checked", equals: "true" }),
});

const selectedReadbackValid = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).sort().join("|") === "name|value|verified"
    && Reflect.get(value, "name") === "aria-checked"
    && Reflect.get(value, "value") === "true"
    && Reflect.get(value, "verified") === true;
};

export const selectExactGptModelV2Handler: GptChildHandler<"select_exact_gpt_model_v2"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["profile"]);
    const profile = profileFromIntent(intent);
    const browser = requireBrowser(context);
    const observed = await readModelSelectorTopology(browser, profile.modelDisplayName);
    if (!modelSelectorAlreadyOpen(observed)) {
      throw executionFailure("failed", `GPT_MODEL_SELECTION_V2_STATE_INVALID:${modelSelectorTopologyCode(observed)}`);
    }
    const candidate = observed.modelChoice ?? Object.freeze({ count: 0, ariaChecked: null });
    if (candidate.count !== 1 || (candidate.ariaChecked !== "true" && candidate.ariaChecked !== "false")) {
      throw executionFailure(
        "failed",
        `GPT_MODEL_SELECTION_V2_CANDIDATE_INVALID:count=${candidate.count}:checked=${candidate.ariaChecked ?? "missing"}`,
      );
    }
    const mutation = await browser.executeDomIntent({
      kind: "click", selector: GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
      expectedTextEquals: profile.modelDisplayName, expectedMatches: 1,
      postClickObservation: SELECTION_POSTCONDITION,
    });
    const mutationRecord = mutation && typeof mutation === "object" && !Array.isArray(mutation)
      ? mutation as Readonly<Record<string, unknown>> : {};
    const selectedReadback = mutationRecord.clickedCandidateAttributeReadback;
    if (!selectedReadbackValid(selectedReadback)) {
      throw executionFailure("failed", "GPT_MODEL_SELECTION_V2_SELECTED_FACT_INVALID");
    }
    const restored = projectModelSelectorTopology(decodeCoherentObservationPacket(
      mutationRecord.postconditionObservation,
      MODEL_SELECTOR_TOPOLOGY_QUERIES,
    ));
    if (!modelSelectorOpenable(restored)) {
      throw executionFailure(
        "failed",
        `GPT_MODEL_SELECTION_V2_POSTCONDITION_INVALID:${modelSelectorTopologyCode(restored)}`,
      );
    }
    const browserFact = requireConfirmedBrowserFact(intent, context);
    return success({
      value: { modelDisplayName: profile.modelDisplayName, previousChecked: candidate.ariaChecked,
        selectionVersion: GPT_MODEL_SELECTION_VERSION, state: "exact-model-selected" },
      ...declaredFacts({
        ...restored.facts, decision: "ACT",
        factResultIds: Object.freeze([...restored.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...restored.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
      }),
    });
  };
