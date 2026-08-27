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
  GPT_PROFILE_DIAGNOSTIC_SELECTOR,
  GPT_PROFILE_POPUP_SELECTOR,
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

type ProfileDiagnosticNode = Readonly<{
  id: string;
  tagName: string;
  role: string;
  ariaLabel: string;
  ariaExpanded: string;
  testId: string;
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

const diagnosticToken = (value: string): string =>
  encodeURIComponent(value.replace(/\s+/gu, " ").trim().slice(0, 160));

const profileSurfaceSummary = (surface: readonly ProfileNode[]): string =>
  surface.length === 0 ? "none" : surface.map((node) => [
    node.role,
    node.ariaChecked,
    node.ariaExpanded,
    node.text,
  ].map(diagnosticToken).join("~")).join("|");

const diagnosticMatches = (result: unknown): readonly ProfileDiagnosticNode[] => {
  if (!result || typeof result !== "object" || Array.isArray(result)
    || !Array.isArray((result as { matches?: unknown }).matches)) return [];
  return (result as { matches: unknown[] }).matches.flatMap((value): ProfileDiagnosticNode[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.tagName !== "string"
      || typeof item.role !== "string" || typeof item.ariaLabel !== "string"
      || typeof item.ariaExpanded !== "string" || typeof item.testId !== "string"
      || typeof item.text !== "string") return [];
    return [{
      id: item.id,
      tagName: item.tagName,
      role: item.role,
      ariaLabel: item.ariaLabel,
      ariaExpanded: item.ariaExpanded,
      testId: item.testId,
      text: item.text,
    }];
  });
};

const diagnosticNodeSummary = (matches: readonly ProfileDiagnosticNode[]): string => {
  if (matches.length === 0) return "none";
  return matches.slice(0, 8).map((node) => [
    node.id,
    node.testId,
    node.tagName,
    node.role,
    node.ariaLabel,
    node.ariaExpanded,
    node.text,
  ].map(diagnosticToken).join("~")).join("|");
};

const diagnosticSummary = async (browser: BrowserTargetLease): Promise<string> => {
  const fields = ["id", "tagName", "role", "ariaLabel", "ariaExpanded", "testId", "text"] as const;
  const candidates = [
    { selector: GPT_PROFILE_DIAGNOSTIC_SELECTOR },
    { selector: "[id],[data-testid],[aria-label]", textContains: "GPT" },
    { selector: "[id],[data-testid],[aria-label]", textContains: "5.6" },
  ] as const;
  let result: unknown = null;
  for (const candidate of candidates) {
    const observed = await browser.executeDomIntent({
      kind: "find",
      selector: candidate.selector,
      ...("textContains" in candidate ? { textContains: candidate.textContains } : {}),
      maxMatches: 20,
      fields,
    });
    result = observed;
    if (observed && typeof observed === "object" && !Array.isArray(observed)
      && Array.isArray((observed as { matches?: unknown }).matches)
      && (observed as { matches: unknown[] }).matches.length > 0) break;
  }
  return diagnosticNodeSummary(diagnosticMatches(result));
};

const choiceDiagnosticSummary = async (
  browser: BrowserTargetLease,
  exactText: string,
): Promise<string> => {
  const fields = ["id", "tagName", "role", "ariaLabel", "ariaExpanded", "testId", "text"] as const;
  const primaryText = exactText.startsWith("GPT-") ? exactText.split(/\s+/u)[0]! : exactText;
  const candidates = [
    { selector: "[role],button", textContains: primaryText },
    { selector: "[role='menuitem'],[role='menuitemradio'],[role='option'],[role='radio']" },
    { selector: "[role],button", textContains: "GPT" },
  ] as const;
  for (const candidate of candidates) {
    const observed = await browser.executeDomIntent({
      kind: "find",
      selector: candidate.selector,
      ...("textContains" in candidate ? { textContains: candidate.textContains } : {}),
      maxMatches: 20,
      fields,
    });
    const matches = diagnosticMatches(observed);
    if (matches.length > 0) return diagnosticNodeSummary(matches);
  }
  return "none";
};

const openSelectorOneMutation = async (
  browser: BrowserTargetLease,
  label: string,
) => {
  const surface = await nodes(browser);
  const popupCount = await findCount(browser, { selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2 });
  if (popupCount === 1) return success({
    value: { state: "choices-open" }, candidateCount: 1,
    observedSemantics: ["one visible profile popup already open"], committedMutation: "no",
  });
  if (popupCount > 1) throw new Error(`review_required:GPT_EXECUTION_PROFILE_POPUP_COUNT_${popupCount}`);
  const triggerCount = await findCount(browser, {
    selector: GPT_PROFILE_TRIGGER_SELECTOR,
    maxMatches: 2,
    waitFor: { minimumMatches: 1, timeoutMs: 5_000 },
  });
  if (triggerCount === 1 && !surface.some((node) => node.ariaExpanded === "true")) {
    await browser.executeDomIntent({
      kind: "click",
      selector: GPT_PROFILE_TRIGGER_SELECTOR,
      expectedMatches: 1,
      postClickMatch: { selector: GPT_PROFILE_POPUP_SELECTOR, expectedMatches: 1, timeoutMs: 5_000 },
    });
    return success({
      value: { state: "profile-menu-open" }, candidateCount: 1,
      observedSemantics: ["one profile trigger", "zero-to-one visible profile popup"], committedMutation: "yes",
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
  if (parents.length !== 1) {
    const diagnostics = await diagnosticSummary(browser);
    throw new Error(`review_required:GPT_EXECUTION_PROFILE_${label}_CONTROL_COUNT_${parents.length}:visible=${diagnostics}`);
  }
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
  if (matching.length !== 1) {
    const diagnostics = await choiceDiagnosticSummary(browser, exactText);
    throw new Error(`review_required:GPT_EXECUTION_PROFILE_CHOICE_COUNT_${matching.length}:visible=${diagnostics}:surface=${profileSurfaceSummary(surface)}`);
  }
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
