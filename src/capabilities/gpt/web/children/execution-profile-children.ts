import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/typed-failure.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import type { GptChildObservation } from "../child-handler.js";
import type { GptChildCapabilityIntent } from "../../contract.js";
import {
  declaredFacts,
  recordInput,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
} from "../child-handler.js";
import {
  projectCoherentObservation,
  readCoherentObservation,
  type GptCoherentFactProjection,
} from "../gpt-dom-observation.js";
import {
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_REASONING_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
  GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
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
  trigger: number;
  triggerExpanded: string | null;
  facts: GptCoherentFactProjection;
}>;

const topology = async (browser: BrowserTargetLease): Promise<ProfileTopology> => {
  const observation = await readCoherentObservation(browser, [
    { queryId: "popup", selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "simple-panel", selector: GPT_PROFILE_SIMPLE_PANEL_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "reasoning-control", selector: GPT_PROFILE_REASONING_CONTROL_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "enabled-reasoning-control", selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
      maxMatches: 2, fields: [] },
    { queryId: "reasoning-value", selector: GPT_PROFILE_REASONING_VALUE_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "trigger", selector: GPT_PROFILE_TRIGGER_SELECTOR, maxMatches: 2, fields: ["ariaExpanded"] },
  ]);
  const row = (queryId: string) => observation.rows.find((candidate) => candidate.queryId === queryId)!;
  const trigger = row("trigger");
  const expanded = trigger.matches[0]?.ariaExpanded;
  return Object.freeze({
    popup: row("popup").eligibleCount,
    simplePanel: row("simple-panel").eligibleCount,
    reasoningControl: row("reasoning-control").eligibleCount,
    enabledReasoningControl: row("enabled-reasoning-control").eligibleCount,
    reasoningValue: row("reasoning-value").eligibleCount,
    trigger: trigger.eligibleCount,
    triggerExpanded: typeof expanded === "string" ? expanded : null,
    facts: projectCoherentObservation(observation, "popup"),
  });
};

const topologyCode = (value: ProfileTopology): string => [
  `popup=${value.popup}`,
  `simple=${value.simplePanel}`,
  `reasoningControl=${value.reasoningControl}`,
  `enabledReasoningControl=${value.enabledReasoningControl}`,
  `reasoningValue=${value.reasoningValue}`,
  `trigger=${value.trigger}`,
  `expanded=${value.triggerExpanded ?? "missing"}`,
].join(":");

const failTopology = (code: string, value: ProfileTopology): never => {
  throw executionFailure("failed", `${code}:${topologyCode(value)}`);
};

const requireActiveReasoningProfile = async (browser: BrowserTargetLease): Promise<ProfileTopology> => {
  const observed = await topology(browser);
  if (observed.popup !== 1 || observed.simplePanel !== 1
    || observed.reasoningControl !== 1 || observed.enabledReasoningControl !== 1
    || observed.reasoningValue !== 1) {
    failTopology("GPT_EXECUTION_PROFILE_POPUP_INVALID", observed);
  }
  return observed;
};

const openProfilePopup = async (
  intent: GptChildCapabilityIntent<"open_gpt_execution_profile">,
  browser: BrowserTargetLease,
  observed: ProfileTopology,
): Promise<GptChildObservation<"open_gpt_execution_profile">> => {
  if (observed.popup === 1) {
    if (observed.simplePanel !== 1 || observed.reasoningControl !== 1
      || observed.enabledReasoningControl !== 1 || observed.reasoningValue !== 1) {
      failTopology("GPT_EXECUTION_PROFILE_POPUP_INVALID", observed);
    }
    return success({
      value: { state: "profile-popup-open" as const },
      ...declaredFacts({
        ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
  }
  if (observed.popup !== 0 || observed.trigger !== 1) {
    failTopology("GPT_EXECUTION_PROFILE_OPEN_QUALIFICATION_INVALID", observed);
  }
  await browser.executeDomIntent({
    kind: "click",
    selector: GPT_PROFILE_TRIGGER_SELECTOR,
    expectedMatches: 1,
    postClickMatch: { selector: GPT_PROFILE_POPUP_SELECTOR, expectedMatches: 1, timeoutMs: 5_000 },
  });
  const readback = await requireActiveReasoningProfile(browser);
  const browserFact = requireConfirmedBrowserFact(intent, browser);
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
    const observed = await topology(browser);
    if (observed.popup !== 1 && context.mutationMode === "readback") {
      throw executionFailure("failed", "GPT_EXECUTION_PROFILE_OPEN_PENDING");
    }
    return openProfilePopup(intent, browser, observed);
  },

  async ensure_exact_gpt_reasoning_tier(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    profileFromIntent(intent);
    requireBrowser(context);
    throw executionFailure("failed", "GPT_BROWSER_COHERENT_REASONING_HANDOFF_REQUIRED");
  },

  async close_gpt_execution_profile(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    profileFromIntent(intent);
    return closeProfilePopup(intent, requireBrowser(context), context.mutationMode === "readback");
  },
} satisfies GptChildHandlerMap;
