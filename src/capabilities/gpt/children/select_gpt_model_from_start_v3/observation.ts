import { GPT_LATEST_MODEL_LABELS } from "../../web/execution-profile-input.js";
import type { BrowserDomObservationQuery, BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import {
  projectCoherentObservation,
  readConfirmedCoherentObservation,
  type GptCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import type { GptExecutionProfile } from "../../schema.js";
import { GPT_MODEL_CHOICE_SELECTOR } from "./selectors.js";

type ModelName = GptExecutionProfile["startModelDisplayName"];
type ModelChoice = Readonly<{
  name: ModelName;
  count: number;
  checked: string | null;
  ariaDisabled: boolean | null;
  disabled: boolean | null;
  inert: boolean | null;
}>;
type ModelChoiceState = Readonly<{
  choice: ModelChoice;
  selectedRawCount: number;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  facts: GptCoherentFactProjection;
}>;

export const modelChoiceQuery = (name: ModelName): BrowserDomObservationQuery => Object.freeze({
  queryId: name === "最新" ? "latest-model" : name === "GPT-6.1 Sol" ? "sol-6-1-model" : "sol-model",
  selector: GPT_MODEL_CHOICE_SELECTOR,
  textEquals: name === "最新" ? GPT_LATEST_MODEL_LABELS : name,
  maxMatches: 2,
  fields: ["ariaChecked", "ariaDisabled", "disabled", "inert"] as const,
});
const queries = (name: ModelName) => Object.freeze([
  modelChoiceQuery(name),
  { queryId: "selected-model-count", selector: "[role='menuitemradio'][aria-checked='true']",
    maxMatches: 2, fields: [] },
] satisfies readonly BrowserDomObservationQuery[]);

const projectModelChoiceState = (observation: GptCoherentObservation, modelName: ModelName): ModelChoiceState => {
  const choice = (name: ModelName): ModelChoice => {
    const row = observation.rows.find((candidate) => candidate.queryId === modelChoiceQuery(name).queryId)!;
    const first = row.matches[0];
    return Object.freeze({
      name, count: row.eligibleCount,
      checked: typeof first?.ariaChecked === "string" ? first.ariaChecked : null,
      ariaDisabled: typeof first?.ariaDisabled === "boolean" ? first.ariaDisabled : null,
      disabled: typeof first?.disabled === "boolean" ? first.disabled : null,
      inert: typeof first?.inert === "boolean" ? first.inert : null,
    });
  };
  return Object.freeze({
    choice: choice(modelName),
    selectedRawCount: observation.rows.find((row) => row.queryId === "selected-model-count")!.rawCount,
    targetRefHash: observation.targetRefHash,
    documentRefHash: observation.documentRefHash,
    facts: projectCoherentObservation(observation, "selected-model-count"),
  });
};

export const readModelChoiceState = async (
  browser: BrowserTargetLease,
  start: ModelName,
  signal?: AbortSignal,
): Promise<ModelChoiceState> => projectModelChoiceState(await readConfirmedCoherentObservation(
  browser, queries(start), (observation) => {
    const state = projectModelChoiceState(observation, start);
    if (state.selectedRawCount > 1 || state.choice.count > 1) return "HARD_FAIL";
    const first = state.choice;
    if (first.count === 0) return "TRANSIENT_DOM";
    if (first.count !== 1 || !["true", "false"].includes(first.checked ?? "")
      || first.ariaDisabled === null || first.disabled === null || first.inert !== false) return "HARD_FAIL";
    return "STABLE_ACT";
  }, signal,
), start);
