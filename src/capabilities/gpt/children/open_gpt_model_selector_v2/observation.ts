import type {
  BrowserDomObservationQuery,
  BrowserTargetLease,
} from "../../../../lib/browser/browser-authority-api.js";

import {
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
  GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR,
} from "./selectors.js";

type ModelSelectorState = Readonly<{
  openableEntry: number;
  modelChoice: number;
  facts: GptCoherentFactProjection;
}>;

const modelSelectorQueries = (
  modelDisplayName: string,
): readonly BrowserDomObservationQuery[] => Object.freeze([
  { queryId: "openable-entry", selector: GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR,
    maxMatches: 2, fields: [] },
  { queryId: "model-choice", selector: GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
    textEquals: modelDisplayName, maxMatches: 2, fields: [] },
]);

export const modelChoiceQuery = (
  modelDisplayName: string,
): BrowserDomObservationQuery => modelSelectorQueries(modelDisplayName)[1]!;

export const projectModelSelectorState = (
  observation: GptCoherentObservation,
): ModelSelectorState => {
  const count = (queryId: string): number =>
    observation.rows.find((row) => row.queryId === queryId)?.eligibleCount ?? 0;
  return Object.freeze({
    openableEntry: count("openable-entry"),
    modelChoice: count("model-choice"),
    facts: projectCoherentObservation(observation, "model-choice"),
  });
};

export const readModelSelectorState = async (
  browser: BrowserTargetLease,
  modelDisplayName: string,
): Promise<ModelSelectorState> => projectModelSelectorState(
  await readCoherentObservation(browser, modelSelectorQueries(modelDisplayName)),
);

export const modelSelectorStateCode = (value: ModelSelectorState): string => [
  `openableEntry=${value.openableEntry}`,
  `modelChoice=${value.modelChoice}`,
].join(":");

export const modelSelectorReady = (value: ModelSelectorState): boolean => value.modelChoice === 1;
export const modelSelectorOpenable = (value: ModelSelectorState): boolean =>
  value.modelChoice === 0 && value.openableEntry === 1;
