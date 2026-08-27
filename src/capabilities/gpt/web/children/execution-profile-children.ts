import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  recordInput,
  requireBrowser,
  requireExactInputKeys,
  success,
} from "../child-handler.js";
import { findCount, requireOneCandidate } from "../gpt-dom-observation.js";
import {
  GPT_ADVANCED_CLOSED_SELECTOR,
  GPT_MODEL_LABEL,
  GPT_MODEL_SUBMENU_SELECTOR,
  GPT_PROFILE_CHOICE_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
  GPT_REASONING_LABEL,
  reasoningTierUiLabel,
} from "../contracts/execution-profile.contract.js";
import {
  assertGptExecutionProfileIntegrity,
  type GptExecutionProfile,
} from "../../schema.js";

type ProfileNode = Readonly<{
  role: string;
  ariaChecked: string;
  ariaExpanded: string;
  text: string;
}>;

const normalized = (value: string): string => value.replace(/\s+/gu, "").trim();

const profileFromIntent = (intent: Parameters<NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>>[0]): GptExecutionProfile =>
  assertGptExecutionProfileIntegrity(recordInput(intent, "profile"));

const nodes = async (browser: BrowserTargetLease): Promise<readonly ProfileNode[]> => {
  const result = await browser.executeDomIntent({
    kind: "find",
    selector: [GPT_PROFILE_TRIGGER_SELECTOR, GPT_ADVANCED_CLOSED_SELECTOR, GPT_MODEL_SUBMENU_SELECTOR, GPT_PROFILE_CHOICE_SELECTOR].join(","),
    maxMatches: 20,
    fields: ["role", "ariaChecked", "ariaExpanded", "text"],
  });
  if (!result || typeof result !== "object" || Array.isArray(result)
    || !Array.isArray((result as { matches?: unknown }).matches)) {
    throw new Error("review_required:GPT_EXECUTION_PROFILE_SURFACE_INVALID");
  }
  return (result as { matches: unknown[] }).matches.map((value): ProfileNode => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("review_required:GPT_EXECUTION_PROFILE_SURFACE_INVALID");
    }
    const item = value as Record<string, unknown>;
    if (typeof item.role !== "string" || typeof item.ariaChecked !== "string"
      || typeof item.ariaExpanded !== "string" || typeof item.text !== "string") {
      throw new Error("review_required:GPT_EXECUTION_PROFILE_SURFACE_INVALID");
    }
    return { role: item.role, ariaChecked: item.ariaChecked, ariaExpanded: item.ariaExpanded, text: item.text };
  });
};

const summary = (surface: readonly ProfileNode[], label: string): readonly ProfileNode[] =>
  surface.filter((node) => node.role === "menuitem" && normalized(node.text).startsWith(normalized(label)));

const selectedChoice = (surface: readonly ProfileNode[]): ProfileNode | null => {
  const selected = surface.filter((node) => node.role === "menuitemradio" && node.ariaChecked === "true");
  if (selected.length > 1) throw new Error("review_required:GPT_EXECUTION_PROFILE_SELECTION_AMBIGUOUS");
  return selected[0] ?? null;
};

const openSelectorOneMutation = async (
  browser: BrowserTargetLease,
  label: string,
) => {
  const surface = await nodes(browser);
  if (surface.some((node) => node.role === "menuitemradio")) return success({
    value: { state: "choices-open" }, candidateCount: 1,
    observedSemantics: ["profile choices already open"], committedMutation: "no",
  });
  const triggerCount = await findCount(browser, { selector: GPT_PROFILE_TRIGGER_SELECTOR, maxMatches: 2 });
  if (triggerCount === 1 && !surface.some((node) => node.ariaExpanded === "true")) {
    await browser.executeDomIntent({ kind: "click", selector: GPT_PROFILE_TRIGGER_SELECTOR, expectedMatches: 1 });
    return success({
      value: { state: "profile-menu-open" }, candidateCount: 1,
      observedSemantics: ["one profile trigger", "menu opening dispatched"], committedMutation: "yes",
    });
  }
  const advanced = await findCount(browser, { selector: GPT_ADVANCED_CLOSED_SELECTOR, maxMatches: 2 });
  if (advanced === 1) {
    await browser.executeDomIntent({ kind: "click", selector: GPT_ADVANCED_CLOSED_SELECTOR, expectedMatches: 1 });
    return success({
      value: { state: "advanced-options-open" }, candidateCount: 1,
      observedSemantics: ["one advanced-options control"], committedMutation: "yes",
    });
  }
  const parents = summary(surface, label);
  if (parents.length !== 1) throw new Error(`review_required:GPT_EXECUTION_PROFILE_${label}_CONTROL_COUNT_${parents.length}`);
  await browser.executeDomIntent({
    kind: "click", selector: GPT_MODEL_SUBMENU_SELECTOR,
    expectedText: label, expectedMatches: 1,
  });
  return success({
    value: { state: "choices-opening", label }, candidateCount: 1,
    observedSemantics: [`one ${label} submenu`], committedMutation: "yes",
  });
};

const selectExactChoice = async (
  browser: BrowserTargetLease,
  exactText: string,
) => {
  const surface = await nodes(browser);
  const matching = surface.filter((node) => node.role === "menuitemradio"
    && normalized(node.text) === normalized(exactText));
  if (matching.length !== 1) throw new Error(`review_required:GPT_EXECUTION_PROFILE_CHOICE_COUNT_${matching.length}`);
  if (matching[0]!.ariaChecked === "true") return success({
    value: { exactText, state: "already-selected" }, candidateCount: 1,
    observedSemantics: ["one exact choice already selected"], committedMutation: "no",
  });
  await browser.executeDomIntent({
    kind: "click", selector: GPT_PROFILE_CHOICE_SELECTOR,
    expectedTextEquals: matching[0]!.text, expectedMatches: 1,
    postClickAttribute: { name: "aria-checked", equals: "true" },
  });
  return success({
    value: { exactText, state: "selected" }, candidateCount: 1,
    observedSemantics: ["one exact choice", "aria-checked=true"], committedMutation: "yes",
  });
};

export const executionProfileChildHandlers = {
  async observe_gpt_execution_profile(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    const profile = profileFromIntent(intent);
    const surface = await nodes(requireBrowser(context));
    return success({
      value: {
        expectedProfileHash: profile.profileHash,
        observedSummaries: surface.filter((node) => node.role === "menuitem").map((node) => node.text),
        selectedChoice: selectedChoice(surface)?.text ?? null,
      },
      candidateCount: surface.length,
      observedSemantics: ["current model/reasoning surface", profile.profileHash],
      committedMutation: "no",
    });
  },

  async open_gpt_model_selector(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    profileFromIntent(intent);
    return openSelectorOneMutation(requireBrowser(context), GPT_MODEL_LABEL);
  },

  async select_exact_gpt_model(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    const profile = profileFromIntent(intent);
    return selectExactChoice(requireBrowser(context), profile.modelDisplayName);
  },

  async open_gpt_reasoning_selector(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    profileFromIntent(intent);
    return openSelectorOneMutation(requireBrowser(context), GPT_REASONING_LABEL);
  },

  async select_exact_gpt_reasoning_tier(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    const profile = profileFromIntent(intent);
    return selectExactChoice(requireBrowser(context), reasoningTierUiLabel[profile.reasoningTier]);
  },

  async verify_gpt_execution_profile(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    const profile = profileFromIntent(intent);
    const surface = await nodes(requireBrowser(context));
    const model = summary(surface, GPT_MODEL_LABEL);
    const reasoning = summary(surface, GPT_REASONING_LABEL);
    const modelMatches = model.length === 1
      && normalized(model[0]!.text) === normalized(`${GPT_MODEL_LABEL}${profile.modelDisplayName}`);
    const reasoningLabel = reasoningTierUiLabel[profile.reasoningTier];
    const reasoningMatches = reasoning.length === 1
      && normalized(reasoning[0]!.text) === normalized(`${GPT_REASONING_LABEL}${reasoningLabel}`);
    if (!modelMatches || !reasoningMatches) {
      throw new Error(`review_required:GPT_EXECUTION_PROFILE_READBACK_MISMATCH:model=${model.length}:reasoning=${reasoning.length}`);
    }
    return success({
      value: {
        profileRef: profile.profileRef,
        profileHash: profile.profileHash,
        modelDisplayName: profile.modelDisplayName,
        modelFamily: profile.modelFamily,
        reasoningTier: profile.reasoningTier,
        reasoningUiLabel: reasoningLabel,
      },
      candidateCount: 2,
      observedSemantics: ["exact model readback", "exact reasoning readback", profile.profileHash],
      committedMutation: "no",
    });
  },
} satisfies GptChildHandlerMap;
