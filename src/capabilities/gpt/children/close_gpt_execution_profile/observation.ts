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
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
} from "./selectors.js";

type ProfileTopology = Readonly<{
  popup: number;
  trigger: number;
  triggerExpanded: string | null;
  facts: GptCoherentFactProjection;
}>;

const PROFILE_TOPOLOGY_QUERIES = Object.freeze([
  { queryId: "popup", selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2, fields: [] },
  { queryId: "trigger", selector: GPT_PROFILE_TRIGGER_SELECTOR, maxMatches: 2,
    fields: ["ariaExpanded"] as const },
] satisfies readonly BrowserDomObservationQuery[]);
const projectTopology = (observation: GptCoherentObservation): ProfileTopology => {
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const trigger = row("trigger");
  const expanded = trigger.matches[0]?.ariaExpanded;
  return Object.freeze({
    popup: row("popup").eligibleCount,
    trigger: trigger.eligibleCount,
    triggerExpanded: typeof expanded === "string" ? expanded : null,
    facts: projectCoherentObservation(observation, "popup"),
  });
};

export const topology = async (browser: BrowserTargetLease): Promise<ProfileTopology> =>
  projectTopology(await readCoherentObservation(browser, PROFILE_TOPOLOGY_QUERIES));
