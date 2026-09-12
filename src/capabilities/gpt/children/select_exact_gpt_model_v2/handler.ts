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
  modelChoiceQuery,
  projectModelChoiceState,
  readModelChoiceState,
} from "./observation.js";

const SELECTION_POSTCONDITION = (modelDisplayName: string) => Object.freeze({
  queries: Object.freeze([Object.freeze({
    ...modelChoiceQuery(modelDisplayName),
    expectedEligibleCount: 0,
  })]) as readonly BrowserDomPostconditionQuery[],
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
    const candidate = await readModelChoiceState(browser, profile.modelDisplayName);
    if (candidate.count !== 1 || (candidate.ariaChecked !== "true" && candidate.ariaChecked !== "false")) {
      throw executionFailure(
        "failed",
        `GPT_MODEL_SELECTION_V2_CANDIDATE_INVALID:count=${candidate.count}:checked=${candidate.ariaChecked ?? "missing"}`,
      );
    }
    const mutation = await browser.executeDomIntent({
      kind: "click", selector: GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
      expectedTextEquals: profile.modelDisplayName, expectedMatches: 1,
      postClickObservation: SELECTION_POSTCONDITION(profile.modelDisplayName),
    });
    const mutationRecord = mutation && typeof mutation === "object" && !Array.isArray(mutation)
      ? mutation as Readonly<Record<string, unknown>> : {};
    const selectedReadback = mutationRecord.clickedCandidateAttributeReadback;
    if (!selectedReadbackValid(selectedReadback)) {
      throw executionFailure("failed", "GPT_MODEL_SELECTION_V2_SELECTED_FACT_INVALID");
    }
    const closed = projectModelChoiceState(decodeCoherentObservationPacket(
      mutationRecord.postconditionObservation,
      [modelChoiceQuery(profile.modelDisplayName)],
    ));
    if (closed.count !== 0) {
      throw executionFailure(
        "failed",
        `GPT_MODEL_SELECTION_V2_POSTCONDITION_INVALID:count=${closed.count}`,
      );
    }
    const browserFact = requireConfirmedBrowserFact(intent, context);
    return success({
      value: { modelDisplayName: profile.modelDisplayName, previousChecked: candidate.ariaChecked,
        selectionVersion: GPT_MODEL_SELECTION_VERSION, state: "exact-model-selected" },
      ...declaredFacts({
        ...candidate.facts, decision: "ACT",
        factResultIds: Object.freeze([...candidate.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...candidate.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
      }),
    });
  };
