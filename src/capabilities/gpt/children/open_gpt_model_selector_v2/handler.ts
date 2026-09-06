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
import {
  GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR,
} from "./selectors.js";
import { profileFromIntent } from "../../web/execution-profile-input.js";
import {
  modelSelectorTopologyQueries,
  modelSelectorAlreadyOpen,
  modelSelectorOpenable,
  modelSelectorTopologyCode,
  projectModelSelectorTopology,
  readModelSelectorTopology,
} from "./observation.js";

const OPEN_POSTCONDITION = (modelDisplayName: string) => Object.freeze({
  queries: Object.freeze(modelSelectorTopologyQueries(modelDisplayName).map((query) => Object.freeze({
    ...query, expectedEligibleCount: query.queryId === "popup" || query.queryId === "advanced-panel"
      || query.queryId === "model-choice" ? 1 : 0,
  }))) as readonly BrowserDomPostconditionQuery[],
  timeoutMs: 5_000,
});

export const openGptModelSelectorV2Handler: GptChildHandler<"open_gpt_model_selector_v2"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["profile"]);
    const profile = profileFromIntent(intent);
    const browser = requireBrowser(context);
    const queries = modelSelectorTopologyQueries(profile.modelDisplayName);
    const observed = await readModelSelectorTopology(browser, profile.modelDisplayName);
    if (modelSelectorAlreadyOpen(observed)) return success({
      value: { selectionVersion: GPT_MODEL_SELECTION_VERSION, state: "model-selector-open" },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
    if (!modelSelectorOpenable(observed)) {
      throw executionFailure("failed", `GPT_MODEL_SELECTION_V2_STATE_INVALID:${modelSelectorTopologyCode(observed)}`);
    }
    if (context.mutationMode === "readback") {
      throw executionFailure("failed", "GPT_MODEL_SELECTION_V2_OPEN_PENDING");
    }
    const mutation = await browser.executeDomIntent({
      kind: "click", selector: GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR, expectedMatches: 1,
      postClickObservation: OPEN_POSTCONDITION(profile.modelDisplayName),
    });
    const mutationRecord = mutation && typeof mutation === "object" && !Array.isArray(mutation)
      ? mutation as Readonly<Record<string, unknown>> : {};
    const readback = projectModelSelectorTopology(decodeCoherentObservationPacket(
      mutationRecord.postconditionObservation,
      queries,
    ));
    if (!modelSelectorAlreadyOpen(readback)) {
      throw executionFailure("failed", `GPT_MODEL_SELECTION_V2_STATE_INVALID:${modelSelectorTopologyCode(readback)}`);
    }
    const browserFact = requireConfirmedBrowserFact(intent, browser, { allowNoMutationOutcome: true });
    const didMutate = browserFact.mutationOutcome === "confirmed";
    return success({
      value: { selectionVersion: GPT_MODEL_SELECTION_VERSION,
        state: didMutate ? "model-selector-opened" : "model-selector-open" },
      ...declaredFacts({
        ...readback.facts, decision: didMutate ? "ACT" : "DONE",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: browserFact.mutationOutcome, browserFact, nativeFailureCode: null,
      }),
    });
  };
