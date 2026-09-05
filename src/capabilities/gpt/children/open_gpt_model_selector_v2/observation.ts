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
  GPT_MODEL_SELECTION_V2_ENTRY_INNER_SELECTOR,
  GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_INNER_SELECTOR,
  GPT_MODEL_SELECTION_V2_PANEL_SELECTOR,
} from "./selectors.js";
import {
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
} from "./selectors.js";

type ModelSelectorTopology = Readonly<{
  popup: number;
  entry: number;
  openableEntry: number;
  simplePanel: number;
  advancedPanel: number;
  facts: GptCoherentFactProjection;
}>;

export const MODEL_SELECTOR_TOPOLOGY_QUERIES = Object.freeze([
  { queryId: "popup", selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2, fields: [] },
  { queryId: "entry", selector: GPT_MODEL_SELECTION_V2_ENTRY_INNER_SELECTOR,
    maxMatches: 2, fields: [], scope: { selector: GPT_PROFILE_POPUP_SELECTOR } },
  { queryId: "openable-entry", selector: GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_INNER_SELECTOR,
    maxMatches: 2, fields: [], scope: { selector: GPT_PROFILE_POPUP_SELECTOR } },
  { queryId: "simple-panel", selector: GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
    maxMatches: 2, fields: [], scope: { selector: GPT_PROFILE_POPUP_SELECTOR } },
  { queryId: "advanced-panel", selector: GPT_MODEL_SELECTION_V2_PANEL_SELECTOR,
    maxMatches: 2, fields: [], scope: { selector: GPT_PROFILE_POPUP_SELECTOR } },
] as const satisfies readonly BrowserDomObservationQuery[]);

export const projectModelSelectorTopology = (
  observation: GptCoherentObservation,
): ModelSelectorTopology => {
  const count = (queryId: string): number =>
    observation.rows.find((row) => row.queryId === queryId)!.eligibleCount;
  return Object.freeze({
    popup: count("popup"), entry: count("entry"), openableEntry: count("openable-entry"),
    simplePanel: count("simple-panel"), advancedPanel: count("advanced-panel"),
    facts: projectCoherentObservation(observation, "entry"),
  });
};

export const readModelSelectorTopology = async (
  browser: BrowserTargetLease,
): Promise<ModelSelectorTopology> => projectModelSelectorTopology(
  await readCoherentObservation(browser, MODEL_SELECTOR_TOPOLOGY_QUERIES),
);

export const modelSelectorTopologyCode = (value: ModelSelectorTopology): string => [
  `popup=${value.popup}`,
  `entry=${value.entry}`,
  `openableEntry=${value.openableEntry}`,
  `simple=${value.simplePanel}`,
  `advanced=${value.advancedPanel}`,
].join(":");

export const modelSelectorAlreadyOpen = (value: ModelSelectorTopology): boolean => value.popup === 1
  && value.entry === 0 && value.openableEntry === 0
  && value.simplePanel === 0 && value.advancedPanel === 1;

export const modelSelectorOpenable = (value: ModelSelectorTopology): boolean => value.popup === 1
  && value.entry === 1 && value.openableEntry === 1
  && value.simplePanel === 1 && value.advancedPanel === 0;
