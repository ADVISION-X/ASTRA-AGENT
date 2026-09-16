import type {
  BrowserDomObservationQuery,
  BrowserTargetLease,
} from "../../../../lib/browser/browser-authority-api.js";
import {
  projectCoherentObservation,
  readConfirmedCoherentObservation,
  type GptCoherentObservation,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
  GPT_COMPOSER_SELECTOR,
} from "./selectors.js";

type ProfileTopology = Readonly<{
  popup: number;
  popupLabelledBy: string | null;
  trigger: number;
  triggerId: string | null;
  triggerExpanded: string | null;
  composer: number;
  facts: GptCoherentFactProjection;
}>;

export const PROFILE_TOPOLOGY_QUERIES = Object.freeze([
  { queryId: "popup", selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2,
    fields: ["ariaLabelledBy"] as const },
  { queryId: "trigger", selector: GPT_PROFILE_TRIGGER_SELECTOR, maxMatches: 2,
    fields: ["id", "ariaExpanded"] as const },
  { queryId: "composer", selector: GPT_COMPOSER_SELECTOR, maxMatches: 2, fields: [] },
] satisfies readonly BrowserDomObservationQuery[]);
export const projectTopology = (observation: GptCoherentObservation): ProfileTopology => {
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const trigger = row("trigger");
  const expanded = trigger.matches[0]?.ariaExpanded;
  const triggerId = trigger.matches[0]?.id;
  const popupLabelledBy = row("popup").matches[0]?.ariaLabelledBy;
  return Object.freeze({
    popup: row("popup").eligibleCount,
    popupLabelledBy: typeof popupLabelledBy === "string" ? popupLabelledBy : null,
    trigger: trigger.eligibleCount,
    triggerId: typeof triggerId === "string" ? triggerId : null,
    triggerExpanded: typeof expanded === "string" ? expanded : null,
    composer: row("composer").eligibleCount,
    facts: projectCoherentObservation(observation, "popup"),
  });
};

export const profileClosedReady = (value: ProfileTopology): boolean => value.popup === 0
  && value.trigger === 1 && value.triggerExpanded === "false"
  && value.triggerId !== null && value.triggerId.length > 0 && value.composer === 1;

export const profileOpenReady = (value: ProfileTopology): boolean => value.popup === 1
  && value.trigger === 1 && value.triggerExpanded === "true"
  && value.triggerId !== null && value.triggerId.length > 0
  && value.popupLabelledBy === value.triggerId;

const profileDisposition = (observation: GptCoherentObservation) => {
  const value = projectTopology(observation);
  if (profileClosedReady(value)) return "STABLE_DONE" as const;
  if (profileOpenReady(value)) return "STABLE_ACT" as const;
  if (observation.rows.some((candidate) => candidate.rawCount > 1 || candidate.eligibleCount > 1)
    || (value.trigger === 1 && !["true", "false"].includes(value.triggerExpanded ?? ""))
    || (value.popup === 1 && value.trigger === 1
      && value.popupLabelledBy !== value.triggerId)) return "HARD_FAIL" as const;
  return "TRANSIENT_DOM" as const;
};

export const topology = async (
  browser: BrowserTargetLease,
  signal?: AbortSignal,
): Promise<ProfileTopology> => projectTopology(await readConfirmedCoherentObservation(
  browser, PROFILE_TOPOLOGY_QUERIES, profileDisposition, signal,
));
