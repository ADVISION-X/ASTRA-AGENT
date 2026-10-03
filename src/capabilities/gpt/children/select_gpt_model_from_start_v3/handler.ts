import { executionFailure } from "../../../../lib/execution-failure.js";
import { GPT_MODEL_SELECTION_VERSION } from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success,
  type GptChildHandler } from "../../web/child-handler.js";
import { decodeCoherentObservationPacket, projectCoherentObservation } from "../../web/gpt-dom-observation.js";
import { GPT_LATEST_MODEL_LABELS, profileFromIntent } from "../../web/execution-profile-input.js";
import { GPT_MODEL_CHOICE_SELECTOR } from "./selectors.js";
import { modelChoiceQuery, readModelChoiceState } from "./observation.js";
const selectedReadbackValid = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Readonly<Record<string, unknown>>;
  return Object.keys(row).sort().join("|") === "name|value|verified"
    && Object.entries({ name: "aria-checked", value: "true", verified: true }).every(([key, expected]) => row[key] === expected);
};
export const selectGptModelFromStartV3Handler: GptChildHandler<"select_gpt_model_from_start_v3"> = async (intent, context) => {
  requireExactInputKeys(intent, ["profile"]);
  const profile = profileFromIntent(intent), browser = requireBrowser(context);
  const observed = await readModelChoiceState(browser, profile.startModelDisplayName, context.signal), chosen = observed.choice;
  const expected = { name: profile.startModelDisplayName, count: 1, ariaDisabled: false, disabled: false, inert: false };
  if (Object.entries(expected).some(([key, value]) => chosen[key as keyof typeof chosen] !== value)
    || !["true", "false"].includes(chosen.checked ?? "") || chosen.checked === "true" && observed.selectedRawCount !== 1) {
    throw executionFailure("failed", "GPT_MODEL_V3_CANDIDATE_NOT_PROVEN");
  }
  const query = modelChoiceQuery(chosen.name);
  const mutation = await browser.executeDomIntent({ kind: "click", selector: GPT_MODEL_CHOICE_SELECTOR, expectedMatches: 1,
    expectedTextEquals: chosen.name === "最新" ? GPT_LATEST_MODEL_LABELS : chosen.name,
    postClickObservation: { queries: [{ ...query, fields: ["ariaChecked", "ariaDisabled", "disabled", "inert"], expectedEligibleCount: 0 }],
      clickedCandidateAttribute: { name: "aria-checked", equals: "true" } } });
  const projected = projectBrowserFact(intent, context);
  if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.outcome.physicalInputCount !== 1
    || projected.fact.mutationOutcome !== "confirmed") throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  const record = mutation && typeof mutation === "object" ? mutation as Readonly<Record<string, unknown>> : {};
  if (!selectedReadbackValid(record.clickedCandidateAttributeReadback)) throw executionFailure("failed", "GPT_MODEL_V3_SELECTED_FACT_INVALID");
  const packet = decodeCoherentObservationPacket(record.postconditionObservation, [query]);
  if (packet.rows[0]!.eligibleCount !== 0) throw executionFailure("failed", "GPT_MODEL_V3_MENU_CLOSE_INVALID");
  const facts = projectCoherentObservation(packet, packet.rows[0]!.queryId), { fact } = projected;
  return success({ value: { modelDisplayName: chosen.name, previousChecked: chosen.checked as "true" | "false",
    selectionVersion: GPT_MODEL_SELECTION_VERSION, state: "model-selected" }, ...declaredFacts({ ...facts, decision: "ACT",
    mutationOutcome: "confirmed", browserFact: fact, nativeFailureCode: null,
    factResultIds: [...facts.factResultIds, fact.evidenceRef], authorityRefHashes: [...facts.authorityRefHashes, fact.evidenceHash] }) });
};
