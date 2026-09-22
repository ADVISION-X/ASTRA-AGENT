import type { BrowserDomObservationQuery, BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import {
  projectCoherentObservation,
  readConfirmedCoherentObservation,
  type GptCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import { GPT_MODEL_SELECTOR_OPENABLE_ENTRY, GPT_MODEL_SELECTOR_OPTION } from "./selectors.js";
import type { GptExecutionProfile } from "../../schema.js";

type ModelSelectorState = Readonly<{
  openableEntry: number;
  specifiedModel: number;
  facts: GptCoherentFactProjection;
}>;

const queries = (name: GptExecutionProfile["startModelDisplayName"]) => Object.freeze([
  { queryId: "openable-entry", selector: GPT_MODEL_SELECTOR_OPENABLE_ENTRY,
    maxMatches: 2, fields: ["ariaExpanded"] as const },
  { queryId: "specified-model", selector: GPT_MODEL_SELECTOR_OPTION,
    textEquals: name, maxMatches: 2, fields: [] },
] satisfies readonly BrowserDomObservationQuery[]);

const projectModelSelectorState = (observation: GptCoherentObservation): ModelSelectorState => {
  const count = (id: string) => {
    const row = observation.rows.find((candidate) => candidate.queryId === id);
    return row?.rawCount === 1 && row.eligibleCount === 1 ? 1
      : row?.rawCount === 0 && row.eligibleCount === 0 ? 0 : -1;
  };
  const specifiedModel = observation.rows.find((candidate) => candidate.queryId === "specified-model");
  return Object.freeze({
    openableEntry: count("openable-entry"),
    specifiedModel: specifiedModel && specifiedModel.eligibleCount <= 1
      ? specifiedModel.eligibleCount : -1,
    facts: projectCoherentObservation(observation, "specified-model"),
  });
};

export const modelSelectorReady = (value: ModelSelectorState): boolean =>
  value.specifiedModel === 1;
export const modelSelectorOpenable = (value: ModelSelectorState): boolean =>
  value.openableEntry === 1 && value.specifiedModel === 0;
export const modelSelectorStateCode = (value: ModelSelectorState): string =>
  `openableEntry=${value.openableEntry}:specifiedModel=${value.specifiedModel}`;

export const readModelSelectorState = async (
  browser: BrowserTargetLease,
  name: GptExecutionProfile["startModelDisplayName"],
  signal?: AbortSignal,
): Promise<ModelSelectorState> => projectModelSelectorState(await readConfirmedCoherentObservation(
  browser, queries(name), (observation) => {
    const state = projectModelSelectorState(observation);
    if (modelSelectorReady(state)) return "STABLE_DONE";
    if (modelSelectorOpenable(state)) return "STABLE_ACT";
    return state.openableEntry < 0 || state.specifiedModel < 0
      ? "HARD_FAIL" : "TRANSIENT_DOM";
  }, signal,
));
