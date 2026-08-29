import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/typed-failure.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  recordInput,
  booleanInput,
  requireBrowser,
  requireExactInputKeys,
  success,
} from "../child-handler.js";
import { findCount, readExactAttribute } from "../gpt-dom-observation.js";
import {
  GPT_PROFILE_DISMISS_SELECTOR,
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
}>;

const topology = async (browser: BrowserTargetLease): Promise<ProfileTopology> => {
  const popup = await findCount(browser, { selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2 });
  const simplePanel = await findCount(browser, { selector: GPT_PROFILE_SIMPLE_PANEL_SELECTOR, maxMatches: 2 });
  const reasoningControl = await findCount(browser, { selector: GPT_PROFILE_REASONING_CONTROL_SELECTOR, maxMatches: 2 });
  const enabledReasoningControl = await findCount(browser, {
    selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
    maxMatches: 2,
  });
  const reasoningValue = await findCount(browser, { selector: GPT_PROFILE_REASONING_VALUE_SELECTOR, maxMatches: 2 });
  return { popup, simplePanel, reasoningControl, enabledReasoningControl, reasoningValue };
};

const topologyCode = (value: ProfileTopology): string => [
  `popup=${value.popup}`,
  `simple=${value.simplePanel}`,
  `reasoningControl=${value.reasoningControl}`,
  `enabledReasoningControl=${value.enabledReasoningControl}`,
  `reasoningValue=${value.reasoningValue}`,
].join(":");

const failTopology = (code: string, value: ProfileTopology): never => {
  throw executionFailure("review_required", `${code}:${topologyCode(value)}`);
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

const requireUniqueProfilePopup = async (browser: BrowserTargetLease): Promise<void> => {
  const popupCount = await findCount(browser, { selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2 });
  if (popupCount !== 1) {
    throw executionFailure("review_required", `GPT_EXECUTION_PROFILE_POPUP_COUNT_${popupCount}`);
  }
};

const openProfilePopup = async (browser: BrowserTargetLease) => {
  const popupCount = await findCount(browser, { selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2 });
  if (popupCount === 1) {
    return success({
      value: { state: "profile-popup-open" },
      candidateCount: 1,
      observedSemantics: ["one current execution-profile popup"],
      committedMutation: "no",
    });
  }
  if (popupCount !== 0) {
    throw executionFailure("review_required", `GPT_EXECUTION_PROFILE_POPUP_COUNT_${popupCount}`);
  }
  const triggerCount = await findCount(browser, {
    selector: GPT_PROFILE_TRIGGER_SELECTOR,
    maxMatches: 2,
    waitFor: { minimumMatches: 1, timeoutMs: 5_000 },
  });
  if (triggerCount !== 1) {
    throw executionFailure("review_required", `GPT_EXECUTION_PROFILE_TRIGGER_COUNT_${triggerCount}`);
  }
  await browser.executeDomIntent({
    kind: "click",
    selector: GPT_PROFILE_TRIGGER_SELECTOR,
    expectedMatches: 1,
    postClickAttribute: { name: "aria-expanded", equals: "true", timeoutMs: 5_000 },
  });
  await requireUniqueProfilePopup(browser);
  await requireActiveReasoningProfile(browser);
  return success({
    value: { state: "profile-popup-open" },
    candidateCount: 1,
    observedSemantics: ["one exact current profile trigger", "one active reasoning panel"],
    committedMutation: "confirmed",
  });
};

const readReasoningValue = async (browser: BrowserTargetLease): Promise<number> => {
  const rawMin = await readExactAttribute(browser, GPT_PROFILE_REASONING_VALUE_SELECTOR, "aria-valuemin");
  const rawMax = await readExactAttribute(browser, GPT_PROFILE_REASONING_VALUE_SELECTOR, "aria-valuemax");
  const rawNow = await readExactAttribute(browser, GPT_PROFILE_REASONING_VALUE_SELECTOR, "aria-valuenow");
  const minimum = Number(rawMin);
  const maximum = Number(rawMax);
  const value = Number(rawNow);
  if (minimum !== 0 || maximum !== 4 || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw executionFailure(
      "review_required",
      `GPT_EXECUTION_PROFILE_REASONING_RANGE_INVALID:min=${encodeURIComponent(rawMin)}:max=${encodeURIComponent(rawMax)}:now=${encodeURIComponent(rawNow)}`,
    );
  }
  return value;
};

const selectReasoning = async (
  browser: BrowserTargetLease,
  targetValue: number,
  targetLabel: string,
  reconcileOnly: boolean,
) => {
  await requireActiveReasoningProfile(browser);
  const currentValue = await readReasoningValue(browser);
  if (currentValue === targetValue) {
    return success({
      value: { targetLabel, targetValue, currentValue, state: "already-selected" },
      candidateCount: 1,
      observedSemantics: ["one active reasoning slider", `aria-valuenow=${targetValue}`],
      committedMutation: "no",
    });
  }
  if (reconcileOnly) {
    throw executionFailure("recovery_pending", "GPT_EXECUTION_PROFILE_REASONING_SELECTION_PENDING");
  }
  const key = currentValue < targetValue ? "ArrowRight" : "ArrowLeft";
  const repeat = Math.abs(targetValue - currentValue) as 1 | 2 | 3 | 4;
  await browser.executeDomIntent({
    kind: "keypress",
    selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
    key,
    repeat,
    expectedMatches: 1,
    postKeypressMatch: {
      selector: `${GPT_PROFILE_REASONING_VALUE_SELECTOR}[aria-valuenow='${targetValue}']`,
      expectedMatches: 1,
      timeoutMs: 5_000,
    },
  });
  return success({
    value: { targetLabel, targetValue, previousValue: currentValue, currentValue: targetValue, state: "selected" },
    candidateCount: 1,
    observedSemantics: ["one active reasoning slider", `${key} repeated ${repeat}`, `aria-valuenow=${targetValue}`],
    committedMutation: "confirmed",
  });
};

const closeProfilePopup = async (browser: BrowserTargetLease, reconcileOnly: boolean) => {
  const popupCount = await findCount(browser, { selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2 });
  if (popupCount === 0) {
    return success({
      value: { state: "profile-popup-closed" },
      candidateCount: 0,
      observedSemantics: ["profile popup already closed"],
      committedMutation: "no",
    });
  }
  await requireUniqueProfilePopup(browser);
  if (reconcileOnly) {
    throw executionFailure("recovery_pending", "GPT_EXECUTION_PROFILE_CLOSE_PENDING");
  }
  await browser.executeDomIntent({
    kind: "click",
    selector: GPT_PROFILE_DISMISS_SELECTOR,
    expectedMatches: 1,
    postClickMatch: { selector: GPT_PROFILE_POPUP_SELECTOR, expectedMatches: 0, timeoutMs: 5_000 },
  });
  return success({
    value: { state: "profile-popup-closed" },
    candidateCount: 1,
    observedSemantics: ["one exact composer focus surface", "profile popup absent"],
    committedMutation: "confirmed",
  });
};

export const executionProfileChildHandlers = {
  async open_gpt_execution_profile(intent, context) {
    requireExactInputKeys(intent, ["profile"], ["reconcileOnly"]);
    profileFromIntent(intent);
    const reconcileOnly = intent.input.reconcileOnly === undefined ? false : booleanInput(intent, "reconcileOnly");
    const browser = requireBrowser(context);
    const popupCount = await findCount(browser, { selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2 });
    if (popupCount === 1) return openProfilePopup(browser);
    if (reconcileOnly) throw executionFailure("recovery_pending", "GPT_EXECUTION_PROFILE_OPEN_PENDING");
    return openProfilePopup(browser);
  },

  async ensure_exact_gpt_reasoning_tier(intent, context) {
    requireExactInputKeys(intent, ["profile"], ["reconcileOnly"]);
    const profile = profileFromIntent(intent);
    const reconcileOnly = intent.input.reconcileOnly === undefined ? false : booleanInput(intent, "reconcileOnly");
    return selectReasoning(
      requireBrowser(context),
      reasoningTierUiValue[profile.reasoningTier],
      reasoningTierUiLabel[profile.reasoningTier],
      reconcileOnly,
    );
  },

  async close_gpt_execution_profile(intent, context) {
    requireExactInputKeys(intent, ["profile"], ["reconcileOnly"]);
    profileFromIntent(intent);
    const reconcileOnly = intent.input.reconcileOnly === undefined ? false : booleanInput(intent, "reconcileOnly");
    return closeProfilePopup(requireBrowser(context), reconcileOnly);
  },
} satisfies GptChildHandlerMap;
