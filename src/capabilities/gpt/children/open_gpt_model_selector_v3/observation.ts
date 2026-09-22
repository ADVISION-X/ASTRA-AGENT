import type { BrowserDomObservationQuery, BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import {
  projectCoherentObservation,
  readConfirmedCoherentObservation,
  type GptCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_MODEL_SELECTOR_EXPANDED_ENTRY,
  GPT_MODEL_SELECTOR_OPENABLE_ENTRY,
} from "./selectors.js";

type ModelSelectorState = Readonly<{
  openableEntry: number;
  expandedEntry: number;
  facts: GptCoherentFactProjection;
}>;

const QUERIES = Object.freeze([
  { queryId: "openable-entry", selector: GPT_MODEL_SELECTOR_OPENABLE_ENTRY,
    maxMatches: 2, fields: ["ariaExpanded"] as const },
  { queryId: "expanded-entry", selector: GPT_MODEL_SELECTOR_EXPANDED_ENTRY,
    maxMatches: 2, fields: ["ariaExpanded"] as const },
] satisfies readonly BrowserDomObservationQuery[]);

export const projectModelSelectorState = (observation: GptCoherentObservation): ModelSelectorState => {
  const count = (id: string) => {
    const row = observation.rows.find((candidate) => candidate.queryId === id);
    return row?.rawCount === 1 && row.eligibleCount === 1 ? 1
      : row?.rawCount === 0 && row.eligibleCount === 0 ? 0 : -1;
  };
  return Object.freeze({
    openableEntry: count("openable-entry"),
    expandedEntry: count("expanded-entry"),
    facts: projectCoherentObservation(observation, "expanded-entry"),
  });
};

export const modelSelectorReady = (value: ModelSelectorState): boolean =>
  value.expandedEntry === 1 && value.openableEntry === 0;
export const modelSelectorOpenable = (value: ModelSelectorState): boolean =>
  value.openableEntry === 1 && value.expandedEntry === 0;
export const modelSelectorStateCode = (value: ModelSelectorState): string =>
  `openableEntry=${value.openableEntry}:expandedEntry=${value.expandedEntry}`;

export const readModelSelectorState = async (
  browser: BrowserTargetLease,
  signal?: AbortSignal,
): Promise<ModelSelectorState> => projectModelSelectorState(await readConfirmedCoherentObservation(
  browser, QUERIES, (observation) => {
    const state = projectModelSelectorState(observation);
    if (modelSelectorReady(state)) return "STABLE_DONE";
    if (modelSelectorOpenable(state)) return "STABLE_ACT";
    return state.openableEntry < 0 || state.expandedEntry < 0
      || state.openableEntry + state.expandedEntry > 1 ? "HARD_FAIL" : "TRANSIENT_DOM";
  }, signal,
));
