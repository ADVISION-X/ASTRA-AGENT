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
import { decodeCoherentObservationPacket, projectCoherentObservation } from "../../web/gpt-dom-observation.js";
import { GPT_LATEST_MODEL_LABELS, profileFromIntent } from "../../web/execution-profile-input.js";
import { GPT_MODEL_CHOICE_SELECTOR } from "./selectors.js";
import { modelChoiceQuery, readModelChoiceState } from "./observation.js";

const postcondition = (name: "最新" | "GPT-5.6 Sol") => Object.freeze({
  queries: Object.freeze([Object.freeze({
    ...modelChoiceQuery(name), expectedEligibleCount: 0,
  })]) as readonly BrowserDomPostconditionQuery[],
  clickedCandidateAttribute: Object.freeze({ name: "aria-checked" as const, equals: "true" as const }),
});
const selectedReadbackValid = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).sort().join("|") === "name|value|verified"
    && Reflect.get(value, "name") === "aria-checked"
    && Reflect.get(value, "value") === "true"
    && Reflect.get(value, "verified") === true;
};

export const selectGptModelFromStartV3Handler: GptChildHandler<"select_gpt_model_from_start_v3"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["profile"]);
    const profile = profileFromIntent(intent);
    const browser = requireBrowser(context);
    const observed = await readModelChoiceState(browser, profile.startModelDisplayName, context.signal);
    const chosen = observed.choice;
    if (chosen.name !== profile.startModelDisplayName || chosen.count !== 1
      || chosen.ariaDisabled !== false || chosen.disabled !== false || chosen.inert !== false
      || !["true", "false"].includes(chosen.checked ?? "")
      || (chosen.checked === "true" && observed.selectedRawCount !== 1)) {
      throw executionFailure("failed", "GPT_MODEL_V3_CANDIDATE_NOT_PROVEN");
    }
    const mutation = await browser.executeDomIntent({
      kind: "click", selector: GPT_MODEL_CHOICE_SELECTOR,
      expectedTextEquals: chosen.name === "最新" ? GPT_LATEST_MODEL_LABELS : chosen.name, expectedMatches: 1,
      postClickObservation: postcondition(chosen.name),
    });
    const record = mutation && typeof mutation === "object" && !Array.isArray(mutation)
      ? mutation as Readonly<Record<string, unknown>> : {};
    if (!selectedReadbackValid(record.clickedCandidateAttributeReadback)) {
      throw executionFailure("failed", "GPT_MODEL_V3_SELECTED_FACT_INVALID");
    }
    const packet = decodeCoherentObservationPacket(
      record.postconditionObservation, [modelChoiceQuery(chosen.name)],
    );
    const row = packet.rows[0]!;
    if (row.eligibleCount !== 0) {
      throw executionFailure("failed", "GPT_MODEL_V3_MENU_CLOSE_INVALID");
    }
    const browserFact = requireConfirmedBrowserFact(intent, context);
    const facts = projectCoherentObservation(packet, row.queryId);
    return success({
      value: {
        modelDisplayName: chosen.name,
        previousChecked: chosen.checked as "true" | "false",
        selectionVersion: GPT_MODEL_SELECTION_VERSION,
        state: "model-selected",
      },
      ...declaredFacts({
        ...facts, decision: "ACT",
        factResultIds: Object.freeze([...facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
      }),
    });
  };
