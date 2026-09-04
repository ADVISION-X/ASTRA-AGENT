import type {
  BrowserDomObservationQuery,
  BrowserTargetLease,
} from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import type { GptChildObservation } from "../child-handler.js";
import type { GptChildBrowserFact, GptChildCapabilityIntent } from "../../contract.js";
import { gptExecutionFailure } from "../../execution-fault.js";
import {
  declaredFacts,
  recordInput,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
} from "../child-handler.js";
import {
  decodeCoherentObservationPacket,
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentObservation,
  type GptCoherentObservationRow,
  type GptCoherentFactProjection,
} from "../gpt-dom-observation.js";
import {
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_REASONING_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
  GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
  reasoningTierUiLabel,
  reasoningTierUiValue,
} from "../contracts/execution-profile.contract.js";
import {
  assertGptExecutionProfileIntegrity,
  type GptExecutionProfile,
} from "../../schema.js";

const profileFromIntent = (intent: Parameters<NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>>[0]): GptExecutionProfile =>
  assertGptExecutionProfileIntegrity(recordInput(intent, "profile"));

type ProfileTopology = Readonly<{
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

const PROFILE_HYDRATION_TIMEOUT_MS = 5_000;
const PROFILE_TOPOLOGY_QUERIES = Object.freeze([
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

const PROFILE_OPEN_POSTCONDITION = Object.freeze({
  queries: Object.freeze(PROFILE_TOPOLOGY_QUERIES.map((query) => Object.freeze({
    ...query,
    expectedEligibleCount: 1,
  }))),
  timeoutMs: PROFILE_HYDRATION_TIMEOUT_MS,
});

const projectTopology = (observation: GptCoherentObservation): ProfileTopology => {
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

const topology = async (browser: BrowserTargetLease): Promise<ProfileTopology> =>
  projectTopology(await readCoherentObservation(browser, PROFILE_TOPOLOGY_QUERIES));

const rowCode = (row: GptCoherentObservationRow): string => {
  const rejected = [...row.scopeRejections, ...row.rejections]
    .map((entry) => `${entry.index}.${entry.reasons.join("+")}`).join(",") || "none";
  return `${row.queryId}[scope=${row.scopeRawCount}/${row.scopeEligibleCount};raw=${row.rawCount};eligible=${row.eligibleCount};rejected=${rejected};native=${row.nativeCauseCode ?? "none"}/${row.nativeCauseCount}]`;
};

const topologyCode = (value: ProfileTopology): string => [
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

const failTopology = (code: string, value: ProfileTopology): never => {
  throw executionFailure("failed", `${code}:${topologyCode(value)}`);
};

const profileNativeCause = (value: ProfileTopology): string | null =>
  value.rows.find((row) => row.nativeCauseCode !== null)?.nativeCauseCode ?? null;

const failProfileOpen = (
  code: string,
  value: ProfileTopology,
  browserFact: GptChildBrowserFact | null = null,
): never => {
  const mutationOutcome = browserFact?.mutationOutcome ?? "no";
  const nativeFailureCode = profileNativeCause(value);
  throw gptExecutionFailure(`${code}:${topologyCode(value)}`, {
    mutationOutcome,
    ...(browserFact ? {
      browserEffect: Object.freeze({
        effectScope: browserFact.effectScope,
        childCapabilityId: browserFact.childCapabilityId,
        browserOutcome: browserFact.browserOutcome,
      }),
    } : {}),
    proofFacts: Object.freeze({
      ...value.facts,
      decision: "FAIL_CLOSED",
      mutationOutcome,
      browserFact,
      nativeFailureCode,
    }),
  });
};

const rowIs = (value: ProfileTopology, queryId: string, raw: number, eligible: number): boolean => {
  const row = value.rows.find((candidate) => candidate.queryId === queryId);
  return row?.rawCount === raw && row.eligibleCount === eligible;
};

const profileFullyAbsent = (value: ProfileTopology): boolean =>
  value.rows.every((row) => row.rawCount === 0 && row.eligibleCount === 0);

const profileOpenReady = (value: ProfileTopology): boolean =>
  ["popup", "simple-panel", "reasoning-control", "enabled-reasoning-control", "reasoning-value", "trigger"]
    .every((queryId) => rowIs(value, queryId, 1, 1))
  && value.reasoningMinimum === "0" && value.reasoningMaximum === "4"
  && /^[0-4]$/u.test(value.reasoningCurrent ?? "")
  && value.triggerExpanded === "true";

const profileOpenable = (value: ProfileTopology): boolean =>
  ["popup", "simple-panel", "reasoning-control", "enabled-reasoning-control", "reasoning-value"]
    .every((queryId) => rowIs(value, queryId, 0, 0))
  && rowIs(value, "trigger", 1, 1)
  && value.triggerExpanded === "false";

const waitForProfileHydration = async (
  browser: BrowserTargetLease,
  signal?: AbortSignal,
): Promise<ProfileTopology> => {
  const deadline = Date.now() + PROFILE_HYDRATION_TIMEOUT_MS;
  let observed = await topology(browser);
  const targetRefHash = observed.targetRefHash;
  const documentRefHash = observed.documentRefHash;
  while (profileFullyAbsent(observed)) {
    if (signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
    const remaining = deadline - Date.now();
    if (remaining <= 0) failProfileOpen("GPT_EXECUTION_PROFILE_HYDRATION_TIMEOUT", observed);
    await browser.wait({
      durationMs: Math.min(remaining, Math.max(25, Math.min(250, Math.ceil(remaining / 20)))),
    });
    observed = await topology(browser);
    if (observed.targetRefHash !== targetRefHash || observed.documentRefHash !== documentRefHash) {
      failProfileOpen("GPT_EXECUTION_PROFILE_HYDRATION_DOCUMENT_CHANGED", observed);
    }
  }
  return observed;
};

const requireActiveReasoningProfile = async (browser: BrowserTargetLease): Promise<ProfileTopology> => {
  const observed = await topology(browser);
  if (!profileOpenReady(observed)) {
    failTopology("GPT_EXECUTION_PROFILE_POPUP_INVALID", observed);
  }
  return observed;
};

const openProfilePopup = async (
  intent: GptChildCapabilityIntent<"open_gpt_execution_profile">,
  browser: BrowserTargetLease,
  observed: ProfileTopology,
): Promise<GptChildObservation<"open_gpt_execution_profile">> => {
  if (profileOpenReady(observed)) {
    return success({
      value: { state: "profile-popup-open" as const },
      ...declaredFacts({
        ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
  }
  if (!profileOpenable(observed)) {
    failProfileOpen("GPT_EXECUTION_PROFILE_OPEN_QUALIFICATION_INVALID", observed);
  }
  const mutation = await browser.executeDomIntent({
    kind: "click",
    selector: GPT_PROFILE_TRIGGER_SELECTOR,
    expectedMatches: 1,
    postClickObservation: PROFILE_OPEN_POSTCONDITION,
  });
  const mutationRecord = mutation && typeof mutation === "object" && !Array.isArray(mutation)
    ? mutation as Readonly<Record<string, unknown>> : {};
  const readback = projectTopology(decodeCoherentObservationPacket(
    mutationRecord.postconditionObservation,
    PROFILE_TOPOLOGY_QUERIES,
  ));
  const browserFact = requireConfirmedBrowserFact(intent, browser);
  if (!profileOpenReady(readback)) {
    failProfileOpen("GPT_EXECUTION_PROFILE_POPUP_INVALID", readback, browserFact);
  }
  return success({
    value: { state: "profile-popup-open" as const },
    ...declaredFacts({
      ...readback.facts, decision: "ACT",
      factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
      authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
      mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
    }),
  });
};

const closeProfilePopup = async (
  intent: GptChildCapabilityIntent<"close_gpt_execution_profile">,
  browser: BrowserTargetLease,
  readbackOnly: boolean,
): Promise<GptChildObservation<"close_gpt_execution_profile">> => {
  const observed = await topology(browser);
  if (observed.popup === 0) {
    return success({
      value: { state: "profile-popup-closed" as const },
      ...declaredFacts({
        ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
  }
  if (observed.popup !== 1 || observed.trigger !== 1 || observed.triggerExpanded !== "true") {
    throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_TRIGGER_INVALID");
  }
  if (readbackOnly) {
    throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_PENDING");
  }
  await browser.executeDomIntent({
    kind: "click",
    selector: GPT_PROFILE_TRIGGER_SELECTOR,
    expectedMatches: 1,
    postClickMatch: { selector: GPT_PROFILE_POPUP_SELECTOR, expectedMatches: 0, timeoutMs: 5_000 },
  });
  const readback = await topology(browser);
  if (readback.popup !== 0) throw executionFailure("failed", "GPT_EXECUTION_PROFILE_CLOSE_PENDING");
  const browserFact = requireConfirmedBrowserFact(intent, browser);
  return success({
    value: { state: "profile-popup-closed" as const },
    ...declaredFacts({
      ...readback.facts, decision: "ACT",
      factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
      authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
      mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
    }),
  });
};

export const executionProfileChildHandlers = {
  async open_gpt_execution_profile(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    profileFromIntent(intent);
    const browser = requireBrowser(context);
    const observed = await waitForProfileHydration(browser, context.signal);
    if (!profileOpenReady(observed) && context.mutationMode === "readback") {
      failProfileOpen("GPT_EXECUTION_PROFILE_OPEN_PENDING", observed);
    }
    return openProfilePopup(intent, browser, observed);
  },

  async ensure_exact_gpt_reasoning_tier(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    const profile = profileFromIntent(intent);
    const browser = requireBrowser(context);
    const targetValue = reasoningTierUiValue[profile.reasoningTier];
    const targetLabel = reasoningTierUiLabel[profile.reasoningTier];
    const observed = await requireActiveReasoningProfile(browser);
    const currentValue = Number(observed.reasoningCurrent);
    if (observed.reasoningMinimum !== "0" || observed.reasoningMaximum !== "4"
      || !Number.isSafeInteger(currentValue) || currentValue < 0 || currentValue > 4
      || observed.reasoningControl !== 1 || observed.enabledReasoningControl !== 1) {
      failTopology("GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID", observed);
    }
    if (currentValue === targetValue) {
      return success({
        value: { targetLabel, targetValue, currentValue, state: "already-selected" },
        ...declaredFacts({
          ...observed.facts, decision: "DONE", mutationOutcome: "no",
          browserFact: null, nativeFailureCode: null,
        }),
      });
    }
    if (context.mutationMode === "readback") {
      throw executionFailure("failed", "GPT_EXECUTION_PROFILE_REASONING_PENDING");
    }
    const delta = targetValue - currentValue;
    await browser.executeDomIntent({
      kind: "keypress",
      selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
      key: delta < 0 ? "ArrowLeft" : "ArrowRight",
      repeat: Math.abs(delta) as 1 | 2 | 3 | 4,
      expectedMatches: 1,
      postKeypressMatch: {
        selector: `${GPT_PROFILE_REASONING_VALUE_SELECTOR}[aria-valuenow='${targetValue}']`,
        expectedMatches: 1,
        readEligibility: "non-actionable-aria-state",
        timeoutMs: 5_000,
      },
    });
    const readback = await requireActiveReasoningProfile(browser);
    if (readback.reasoningMinimum !== "0" || readback.reasoningMaximum !== "4"
      || readback.reasoningCurrent !== String(targetValue)) {
      failTopology("GPT_EXECUTION_PROFILE_REASONING_PENDING", readback);
    }
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    return success({
      value: {
        targetLabel, targetValue, previousValue: currentValue,
        currentValue: targetValue, state: "selected",
      },
      ...declaredFacts({
        ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
      }),
    });
  },

  async close_gpt_execution_profile(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    profileFromIntent(intent);
    return closeProfilePopup(intent, requireBrowser(context), context.mutationMode === "readback");
  },
} satisfies GptChildHandlerMap;
