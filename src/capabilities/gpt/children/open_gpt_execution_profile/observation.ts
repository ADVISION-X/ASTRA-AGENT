import type {
  BrowserDomObservationQuery,
  BrowserTargetLease,
} from "../../../../lib/browser/browser-authority-api.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
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
  simplePanel: number;
  reasoningControl: number;
  enabledReasoningControl: number;
  reasoningValue: number;
  reasoningMinimum: string | null;
  reasoningMaximum: string | null;
  reasoningCurrent: string | null;
  trigger: number;
  triggerExpanded: string | null;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  rows: readonly GptCoherentObservationRow[];
  facts: GptCoherentFactProjection;
}>;

export const PROFILE_HYDRATION_TIMEOUT_MS = 5_000;
export const PROFILE_TOPOLOGY_QUERIES = Object.freeze([
  { queryId: "popup", selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2, fields: [] },
  { queryId: "simple-panel", selector: GPT_PROFILE_SIMPLE_PANEL_SELECTOR, maxMatches: 2, fields: [] },
  { queryId: "reasoning-control", selector: GPT_PROFILE_REASONING_CONTROL_SELECTOR, maxMatches: 2, fields: [] },
  { queryId: "enabled-reasoning-control", selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
    maxMatches: 2, fields: [] },
  { queryId: "reasoning-value", selector: GPT_PROFILE_REASONING_VALUE_SELECTOR, maxMatches: 2,
    readEligibility: "non-actionable-aria-state" as const,
    fields: ["ariaValueMin", "ariaValueMax", "ariaValueNow"] as const },
  { queryId: "trigger", selector: GPT_PROFILE_TRIGGER_SELECTOR, maxMatches: 2,
    fields: ["ariaExpanded"] as const },
] satisfies readonly BrowserDomObservationQuery[]);

export const PROFILE_OPEN_POSTCONDITION = Object.freeze({
  queries: Object.freeze(PROFILE_TOPOLOGY_QUERIES.map((query) => Object.freeze({
    ...query,
    expectedEligibleCount: 1,
  }))),
  timeoutMs: PROFILE_HYDRATION_TIMEOUT_MS,
});

export const projectTopology = (observation: GptCoherentObservation): ProfileTopology => {
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const trigger = row("trigger");
  const expanded = trigger.matches[0]?.ariaExpanded;
  const reasoning = row("reasoning-value").matches[0];
  return Object.freeze({
    popup: row("popup").eligibleCount,
    simplePanel: row("simple-panel").eligibleCount,
    reasoningControl: row("reasoning-control").eligibleCount,
    enabledReasoningControl: row("enabled-reasoning-control").eligibleCount,
    reasoningValue: row("reasoning-value").eligibleCount,
    reasoningMinimum: typeof reasoning?.ariaValueMin === "string" ? reasoning.ariaValueMin : null,
    reasoningMaximum: typeof reasoning?.ariaValueMax === "string" ? reasoning.ariaValueMax : null,
    reasoningCurrent: typeof reasoning?.ariaValueNow === "string" ? reasoning.ariaValueNow : null,
    trigger: trigger.eligibleCount,
    triggerExpanded: typeof expanded === "string" ? expanded : null,
    targetRefHash: observation.targetRefHash,
    documentRefHash: observation.documentRefHash,
    rows: observation.rows,
    facts: projectCoherentObservation(observation, "popup"),
  });
};

export const topology = async (browser: BrowserTargetLease): Promise<ProfileTopology> =>
  projectTopology(await readCoherentObservation(browser, PROFILE_TOPOLOGY_QUERIES));

const rowCode = (row: GptCoherentObservationRow): string => {
  const rejected = [...row.scopeRejections, ...row.rejections]
    .map((entry) => `${entry.index}.${entry.reasons.join("+")}`).join(",") || "none";
  return `${row.queryId}[scope=${row.scopeRawCount}/${row.scopeEligibleCount};raw=${row.rawCount};eligible=${row.eligibleCount};rejected=${rejected};native=${row.nativeCauseCode ?? "none"}/${row.nativeCauseCount}]`;
};

export const topologyCode = (value: ProfileTopology): string => [
  `popup=${value.popup}`,
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

export const profileFullyAbsent = (value: ProfileTopology): boolean =>
  value.rows.every((row) => row.rawCount === 0 && row.eligibleCount === 0);

const approvedReasoningScale = (value: ProfileTopology): boolean =>
  value.reasoningMinimum === "0" && (
    (value.reasoningMaximum === "2" && /^[0-2]$/u.test(value.reasoningCurrent ?? ""))
    || (value.reasoningMaximum === "4" && /^[0-4]$/u.test(value.reasoningCurrent ?? ""))
  );

export const profileOpenReady = (value: ProfileTopology): boolean =>
  ["popup", "simple-panel", "reasoning-control", "enabled-reasoning-control", "reasoning-value", "trigger"]
    .every((queryId) => rowIs(value, queryId, 1, 1))
  && approvedReasoningScale(value)
  && value.triggerExpanded === "true";

export const profileOpenable = (value: ProfileTopology): boolean =>
  ["popup", "simple-panel", "reasoning-control", "enabled-reasoning-control", "reasoning-value"]
    .every((queryId) => rowIs(value, queryId, 0, 0))
  && rowIs(value, "trigger", 1, 1)
  && value.triggerExpanded === "false";
