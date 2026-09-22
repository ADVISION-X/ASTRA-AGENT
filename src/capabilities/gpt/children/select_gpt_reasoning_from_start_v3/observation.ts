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
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
} from "./selectors.js";
export type ProfileTopology = Readonly<{
  enabledReasoningControl: number;
  reasoningValue: number;
  reasoningMinimum: string | null;
  reasoningMaximum: string | null;
  reasoningCurrent: string | null;
  rows: readonly GptCoherentObservationRow[];
  facts: GptCoherentFactProjection;
}>;

const profileTopologyQueries = Object.freeze([
  { queryId: "enabled-reasoning-control", selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
    maxMatches: 2, fields: [] },
  { queryId: "reasoning-value", selector: GPT_PROFILE_REASONING_VALUE_SELECTOR, maxMatches: 2,
    readEligibility: "non-actionable-aria-state" as const,
    fields: ["ariaValueMin", "ariaValueMax", "ariaValueNow"] as const },
] satisfies readonly BrowserDomObservationQuery[]);
const projectTopology = (observation: GptCoherentObservation): ProfileTopology => {
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const reasoning = row("reasoning-value").matches[0];
  return Object.freeze({
    enabledReasoningControl: row("enabled-reasoning-control").eligibleCount,
    reasoningValue: row("reasoning-value").eligibleCount,
    reasoningMinimum: typeof reasoning?.ariaValueMin === "string" ? reasoning.ariaValueMin : null,
    reasoningMaximum: typeof reasoning?.ariaValueMax === "string" ? reasoning.ariaValueMax : null,
    reasoningCurrent: typeof reasoning?.ariaValueNow === "string" ? reasoning.ariaValueNow : null,
    rows: observation.rows,
    facts: projectCoherentObservation(observation, "enabled-reasoning-control"),
  });
};

const rowCode = (row: GptCoherentObservationRow): string => {
  const rejected = [...row.scopeRejections, ...row.rejections]
    .map((entry) => `${entry.index}.${entry.reasons.join("+")}`).join(",") || "none";
  return `${row.queryId}[scope=${row.scopeRawCount}/${row.scopeEligibleCount};raw=${row.rawCount};eligible=${row.eligibleCount};rejected=${rejected};native=${row.nativeCauseCode ?? "none"}/${row.nativeCauseCount}]`;
};

export const topologyCode = (value: ProfileTopology): string => [
  `enabledReasoningControl=${value.enabledReasoningControl}`,
  `reasoningValue=${value.reasoningValue}`,
  `reasoningRange=${value.reasoningMinimum ?? "missing"}-${value.reasoningMaximum ?? "missing"}`,
  `reasoningCurrent=${value.reasoningCurrent ?? "missing"}`,
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
  return value.reasoningMinimum === "0"
    && max !== null && /^(?:0|[1-5])$/u.test(max)
    && now !== null && /^(?:0|[1-5])$/u.test(now)
    && Number(now) <= Number(max);
};

export const reasoningControlReady = (value: ProfileTopology): boolean =>
  ["enabled-reasoning-control", "reasoning-value"]
    .every((queryId) => rowIs(value, queryId, 1, 1))
  && approvedReasoningScale(value);

const profileDisposition = (observation: GptCoherentObservation) => {
  const value = projectTopology(observation);
  if (reasoningControlReady(value)) return "STABLE_ACT" as const;
  if (value.rows.some((candidate) => candidate.rawCount > 1 || candidate.eligibleCount > 1)
    || (value.reasoningValue === 1 && !approvedReasoningScale(value))) return "HARD_FAIL" as const;
  return "TRANSIENT_DOM" as const;
};

export const topology = async (
  browser: BrowserTargetLease,
  signal?: AbortSignal,
): Promise<ProfileTopology> => projectTopology(await readConfirmedCoherentObservation(
  browser, profileTopologyQueries, profileDisposition, signal,
));
