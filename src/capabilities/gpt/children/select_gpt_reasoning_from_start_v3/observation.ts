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
  GPT_PROFILE_REASONING_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
} from "./selectors.js";
import type { GptExecutionProfile } from "../../schema.js";

export type ProfileTopology = Readonly<{
  reasoningControl: number;
  enabledReasoningControl: number;
  reasoningValue: number;
  reasoningMinimum: string | null;
  reasoningMaximum: string | null;
  reasoningCurrent: string | null;
  proFifthLabelRaw: number;
  proFifthLabelEligible: number;
  selectedModelRaw: number;
  selectedModelEligible: number;
  selectedModelChecked: string | null;
  selectedModelInert: boolean | null;
  proDisabledRaw: number;
  proDisabledEligible: number;
  proAriaDisabled: boolean | null;
  proInert: boolean | null;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  rows: readonly GptCoherentObservationRow[];
  facts: GptCoherentFactProjection;
}>;

const profileTopologyQueries = (actualModelDisplayName: GptExecutionProfile["startModelDisplayName"]) => Object.freeze([
  { queryId: "reasoning-control", selector: GPT_PROFILE_REASONING_CONTROL_SELECTOR, maxMatches: 2, fields: [] },
  { queryId: "enabled-reasoning-control", selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
    maxMatches: 2, fields: [] },
  { queryId: "reasoning-value", selector: GPT_PROFILE_REASONING_VALUE_SELECTOR, maxMatches: 2,
    readEligibility: "non-actionable-aria-state" as const,
    fields: ["ariaValueMin", "ariaValueMax", "ariaValueNow"] as const },
  { queryId: "pro-fifth-label", selector: "[role='menuitem'][aria-label='能力'] + span",
    textEquals: "Pro，第 5 项，共 5 项。", maxMatches: 2, fields: [] },
  { queryId: "selected-model", selector: "[role='menuitemradio'][aria-checked='true']",
    textEquals: actualModelDisplayName, maxMatches: 2,
    readEligibility: "non-actionable-inert-state" as const,
    fields: ["ariaChecked", "inert"] as const },
  { queryId: "pro-disabled", selector: "[role='menuitemradio'][aria-label='Pro'][aria-disabled='true']",
    maxMatches: 2, readEligibility: "non-actionable-inert-state" as const,
    fields: ["ariaDisabled", "inert"] as const },
] satisfies readonly BrowserDomObservationQuery[]);
const projectTopology = (observation: GptCoherentObservation): ProfileTopology => {
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const reasoning = row("reasoning-value").matches[0];
  const selectedModel = row("selected-model").matches[0];
  const proDisabled = row("pro-disabled").matches[0];
  return Object.freeze({
    reasoningControl: row("reasoning-control").eligibleCount,
    enabledReasoningControl: row("enabled-reasoning-control").eligibleCount,
    reasoningValue: row("reasoning-value").eligibleCount,
    reasoningMinimum: typeof reasoning?.ariaValueMin === "string" ? reasoning.ariaValueMin : null,
    reasoningMaximum: typeof reasoning?.ariaValueMax === "string" ? reasoning.ariaValueMax : null,
    reasoningCurrent: typeof reasoning?.ariaValueNow === "string" ? reasoning.ariaValueNow : null,
    proFifthLabelRaw: row("pro-fifth-label").rawCount,
    proFifthLabelEligible: row("pro-fifth-label").eligibleCount,
    selectedModelRaw: row("selected-model").rawCount,
    selectedModelEligible: row("selected-model").eligibleCount,
    selectedModelChecked: typeof selectedModel?.ariaChecked === "string" ? selectedModel.ariaChecked : null,
    selectedModelInert: typeof selectedModel?.inert === "boolean" ? selectedModel.inert : null,
    proDisabledRaw: row("pro-disabled").rawCount,
    proDisabledEligible: row("pro-disabled").eligibleCount,
    proAriaDisabled: typeof proDisabled?.ariaDisabled === "boolean" ? proDisabled.ariaDisabled : null,
    proInert: typeof proDisabled?.inert === "boolean" ? proDisabled.inert : null,
    targetRefHash: observation.targetRefHash,
    documentRefHash: observation.documentRefHash,
    rows: observation.rows,
    facts: projectCoherentObservation(observation, "reasoning-control"),
  });
};

const rowCode = (row: GptCoherentObservationRow): string => {
  const rejected = [...row.scopeRejections, ...row.rejections]
    .map((entry) => `${entry.index}.${entry.reasons.join("+")}`).join(",") || "none";
  return `${row.queryId}[scope=${row.scopeRawCount}/${row.scopeEligibleCount};raw=${row.rawCount};eligible=${row.eligibleCount};rejected=${rejected};native=${row.nativeCauseCode ?? "none"}/${row.nativeCauseCount}]`;
};

export const topologyCode = (value: ProfileTopology): string => [
  `reasoningControl=${value.reasoningControl}`,
  `enabledReasoningControl=${value.enabledReasoningControl}`,
  `reasoningValue=${value.reasoningValue}`,
  `reasoningRange=${value.reasoningMinimum ?? "missing"}-${value.reasoningMaximum ?? "missing"}`,
  `reasoningCurrent=${value.reasoningCurrent ?? "missing"}`,
  `proFifthLabel=${value.proFifthLabelRaw}/${value.proFifthLabelEligible}`,
  `selectedModel=${value.selectedModelRaw}/${value.selectedModelEligible}:${value.selectedModelChecked ?? "missing"}:${value.selectedModelInert ?? "missing"}`,
  `proDisabled=${value.proDisabledRaw}/${value.proDisabledEligible}:${value.proAriaDisabled ?? "missing"}:${value.proInert ?? "missing"}`,
  `revision=${value.facts.observationRevisionHash}`,
  `candidates=${value.rows.map(rowCode).join("|")}`,
].join(":");

export const profileNativeCause = (value: ProfileTopology): string | null =>
  value.rows.find((row) => row.nativeCauseCode !== null)?.nativeCauseCode ?? null;

const rowIs = (value: ProfileTopology, queryId: string, raw: number, eligible: number): boolean => {
  const row = value.rows.find((candidate) => candidate.queryId === queryId);
  return row?.rawCount === raw && row.eligibleCount === eligible;
};
const approvedReasoningScale = (value: ProfileTopology): boolean =>
  value.reasoningMinimum === "0" && (
    (value.reasoningMaximum === "2" && /^[0-2]$/u.test(value.reasoningCurrent ?? ""))
    || (value.reasoningMaximum === "3" && /^[0-3]$/u.test(value.reasoningCurrent ?? ""))
    || (value.reasoningMaximum === "4" && /^[0-4]$/u.test(value.reasoningCurrent ?? ""))
  );

export const profileOpenReady = (value: ProfileTopology): boolean =>
  ["reasoning-control", "enabled-reasoning-control", "reasoning-value"]
    .every((queryId) => rowIs(value, queryId, 1, 1))
  && approvedReasoningScale(value);

const profileDisposition = (observation: GptCoherentObservation) => {
  const value = projectTopology(observation);
  if (profileOpenReady(value)) return "STABLE_ACT" as const;
  if (value.rows.some((candidate) => candidate.rawCount > 1 || candidate.eligibleCount > 1)
    || (value.reasoningValue === 1 && !approvedReasoningScale(value))) return "HARD_FAIL" as const;
  return "TRANSIENT_DOM" as const;
};

export const topology = async (
  browser: BrowserTargetLease,
  actualModelDisplayName: GptExecutionProfile["startModelDisplayName"],
  signal?: AbortSignal,
): Promise<ProfileTopology> => projectTopology(await readConfirmedCoherentObservation(
  browser, profileTopologyQueries(actualModelDisplayName), profileDisposition, signal,
));
