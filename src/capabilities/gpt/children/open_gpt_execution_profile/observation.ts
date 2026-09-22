import type {
  BrowserDomObservationQuery,
  BrowserTargetLease,
} from "../../../../lib/browser/browser-authority-api.js";
import {
  projectCoherentObservation,
  readConfirmedCoherentObservation,
  type GptCoherentObservation,
  type GptCoherentObservationRow,
  type GptCoherentFactProjection,
} from "../../web/gpt-dom-observation.js";
import {
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_REASONING_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
  GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
} from "./selectors.js";

export type ProfileTopology = Readonly<{
  popup: number;
  popupLabelledBy: string | null;
  simplePanel: number;
  reasoningControl: number;
  enabledReasoningControl: number;
  reasoningValue: number;
  reasoningMinimum: string | null;
  reasoningMaximum: string | null;
  reasoningCurrent: string | null;
  trigger: number;
  triggerId: string | null;
  triggerExpanded: string | null;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  rows: readonly GptCoherentObservationRow[];
  facts: GptCoherentFactProjection;
}>;

export const PROFILE_TOPOLOGY_QUERIES = Object.freeze([
  { queryId: "popup", selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2,
    fields: ["ariaLabelledBy"] as const },
  { queryId: "simple-panel", selector: GPT_PROFILE_SIMPLE_PANEL_SELECTOR, maxMatches: 2, fields: [] },
  { queryId: "reasoning-control", selector: GPT_PROFILE_REASONING_CONTROL_SELECTOR, maxMatches: 2, fields: [] },
  { queryId: "enabled-reasoning-control", selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
    maxMatches: 2, fields: [] },
  { queryId: "reasoning-value", selector: GPT_PROFILE_REASONING_VALUE_SELECTOR, maxMatches: 2,
    readEligibility: "non-actionable-aria-state" as const,
    fields: ["ariaValueMin", "ariaValueMax", "ariaValueNow"] as const },
  { queryId: "trigger", selector: GPT_PROFILE_TRIGGER_SELECTOR, maxMatches: 2,
    fields: ["id", "ariaExpanded"] as const },
] satisfies readonly BrowserDomObservationQuery[]);

export const PROFILE_OPEN_POSTCONDITION = Object.freeze({
  queries: Object.freeze(PROFILE_TOPOLOGY_QUERIES.map((query) => Object.freeze({
    ...query,
    expectedEligibleCount: 1,
  }))),
});

export const projectTopology = (observation: GptCoherentObservation): ProfileTopology => {
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const trigger = row("trigger");
  const popup = row("popup");
  const expanded = trigger.matches[0]?.ariaExpanded;
  const triggerId = trigger.matches[0]?.id;
  const popupLabelledBy = popup.matches[0]?.ariaLabelledBy;
  const reasoning = row("reasoning-value").matches[0];
  return Object.freeze({
    popup: popup.eligibleCount,
    popupLabelledBy: typeof popupLabelledBy === "string" ? popupLabelledBy : null,
    simplePanel: row("simple-panel").eligibleCount,
    reasoningControl: row("reasoning-control").eligibleCount,
    enabledReasoningControl: row("enabled-reasoning-control").eligibleCount,
    reasoningValue: row("reasoning-value").eligibleCount,
    reasoningMinimum: typeof reasoning?.ariaValueMin === "string" ? reasoning.ariaValueMin : null,
    reasoningMaximum: typeof reasoning?.ariaValueMax === "string" ? reasoning.ariaValueMax : null,
    reasoningCurrent: typeof reasoning?.ariaValueNow === "string" ? reasoning.ariaValueNow : null,
    trigger: trigger.eligibleCount,
    triggerId: typeof triggerId === "string" ? triggerId : null,
    triggerExpanded: typeof expanded === "string" ? expanded : null,
    targetRefHash: observation.targetRefHash,
    documentRefHash: observation.documentRefHash,
    rows: observation.rows,
    facts: projectCoherentObservation(observation, "popup"),
  });
};

const rowCode = (row: GptCoherentObservationRow): string => {
  const rejected = [...row.scopeRejections, ...row.rejections]
    .map((entry) => `${entry.index}.${entry.reasons.join("+")}`).join(",") || "none";
  return `${row.queryId}[scope=${row.scopeRawCount}/${row.scopeEligibleCount};raw=${row.rawCount};eligible=${row.eligibleCount};rejected=${rejected};native=${row.nativeCauseCode ?? "none"}/${row.nativeCauseCount}]`;
};

export const topologyCode = (value: ProfileTopology): string => [
  `popup=${value.popup}`,
  `owner=${value.popupLabelledBy ?? "missing"}/${value.triggerId ?? "missing"}`,
  `simple=${value.simplePanel}`,
  `reasoningControl=${value.reasoningControl}`,
  `enabledReasoningControl=${value.enabledReasoningControl}`,
  `reasoningValue=${value.reasoningValue}`,
  `reasoningRange=${value.reasoningMinimum ?? "missing"}-${value.reasoningMaximum ?? "missing"}`,
  `reasoningCurrent=${value.reasoningCurrent ?? "missing"}`,
  `trigger=${value.trigger}`,
  `expanded=${value.triggerExpanded ?? "missing"}`,
  `revision=${value.facts.observationRevisionHash}`,
  `candidates=${value.rows.map(rowCode).join("|")}`,
].join(":");

export const profileNativeCause = (value: ProfileTopology): string | null =>
  value.rows.find((row) => row.nativeCauseCode !== null)?.nativeCauseCode ?? null;

const rowIs = (value: ProfileTopology, queryId: string, raw: number, eligible: number): boolean => {
  const row = value.rows.find((candidate) => candidate.queryId === queryId);
  return row?.rawCount === raw && row.eligibleCount === eligible;
};

const approvedReasoningScale = (value: ProfileTopology): boolean => {
  const max = value.reasoningMaximum;
  const now = value.reasoningCurrent;
  return value.reasoningMinimum === "0" && max !== null && /^(?:0|[1-5])$/u.test(max)
    && now !== null && /^(?:0|[1-5])$/u.test(now) && Number(now) <= Number(max);
};

export const profileOpenReady = (value: ProfileTopology): boolean =>
  ["popup", "simple-panel", "reasoning-control", "enabled-reasoning-control", "reasoning-value", "trigger"]
    .every((queryId) => rowIs(value, queryId, 1, 1))
  && approvedReasoningScale(value)
  && value.triggerExpanded === "true"
  && value.triggerId !== null && value.triggerId.length > 0
  && value.popupLabelledBy === value.triggerId;

export const profileOpenable = (value: ProfileTopology): boolean =>
  ["popup", "simple-panel", "reasoning-control", "enabled-reasoning-control", "reasoning-value"]
    .every((queryId) => rowIs(value, queryId, 0, 0))
  && rowIs(value, "trigger", 1, 1)
  && value.triggerExpanded === "false"
  && value.triggerId !== null && value.triggerId.length > 0;

const profileDisposition = (observation: GptCoherentObservation) => {
  const value = projectTopology(observation);
  if (profileOpenReady(value)) return "STABLE_DONE" as const;
  if (profileOpenable(value)) return "STABLE_ACT" as const;
  if (value.rows.some((candidate) => candidate.rawCount > 1 || candidate.eligibleCount > 1)
    || (value.trigger === 1 && !["true", "false"].includes(value.triggerExpanded ?? ""))
    || (value.reasoningValue === 1 && !approvedReasoningScale(value))
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
