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
import { GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR } from "./selectors.js";

type ModelChoiceState = Readonly<{
  count: number;
  ariaChecked: string | null;
  facts: GptCoherentFactProjection;
}>;

export const modelChoiceQuery = (
  modelDisplayName: string,
): BrowserDomObservationQuery => Object.freeze({
  queryId: "model-choice",
  selector: GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
  textEquals: modelDisplayName,
  maxMatches: 2,
  fields: ["ariaChecked"] as const,
});

export const projectModelChoiceState = (
  observation: GptCoherentObservation,
): ModelChoiceState => {
  const choice = observation.rows.find((row) => row.queryId === "model-choice")!;
  const firstChoice = choice.matches[0];
  return Object.freeze({
    count: choice.eligibleCount,
    ariaChecked: typeof firstChoice?.ariaChecked === "string" ? firstChoice.ariaChecked : null,
    facts: projectCoherentObservation(observation, "model-choice"),
  });
};

export const readModelChoiceState = async (
  browser: BrowserTargetLease,
  modelDisplayName: string,
): Promise<ModelChoiceState> => projectModelChoiceState(
  await readCoherentObservation(browser, [modelChoiceQuery(modelDisplayName)]),
);
