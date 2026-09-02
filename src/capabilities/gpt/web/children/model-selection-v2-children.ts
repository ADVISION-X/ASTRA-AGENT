import type { BrowserTargetLease } from "../../../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../../../lib/typed-failure.js";

import { GPT_MODEL_SELECTION_VERSION } from "../../contract.js";
import type { GptChildHandlerMap } from "../child-handler.js";
import {
  recordInput,
  requireBrowser,
  requireExactInputKeys,
  success,
} from "../child-handler.js";
import { readCoherentObservation } from "../gpt-dom-observation.js";
import {
  GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
  GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR,
  GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR,
  GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR,
  GPT_MODEL_SELECTION_V2_OPEN_STATE_SELECTOR,
  GPT_MODEL_SELECTION_V2_PANEL_SELECTOR,
  GPT_MODEL_SELECTION_V2_RESTORED_STATE_SELECTOR,
} from "../contracts/model-selection-v2.contract.js";
import {
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
} from "../contracts/execution-profile.contract.js";
import {
  assertGptExecutionProfileIntegrity,
  type GptExecutionProfile,
} from "../../schema.js";

const profileFromIntent = (
  intent: Parameters<NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>>[0],
): GptExecutionProfile => assertGptExecutionProfileIntegrity(recordInput(intent, "profile"));

type ModelSelectorTopology = Readonly<{
  popup: number;
  entry: number;
  expandedEntry: number;
  openableEntry: number;
  simplePanel: number;
  advancedPanel: number;
  modelChoice?: Readonly<{ count: number; ariaChecked: string | null }>;
}>;

const readModelSelectorTopology = async (
  browser: BrowserTargetLease,
  modelDisplayName?: string,
): Promise<ModelSelectorTopology> => {
  const specs = [
    { queryId: "popup", selector: GPT_PROFILE_POPUP_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "entry", selector: GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "expanded-entry", selector: GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "openable-entry", selector: GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "simple-panel", selector: GPT_PROFILE_SIMPLE_PANEL_SELECTOR, maxMatches: 2, fields: [] },
    { queryId: "advanced-panel", selector: GPT_MODEL_SELECTION_V2_PANEL_SELECTOR, maxMatches: 2, fields: [] },
    ...(modelDisplayName === undefined ? [] : [{
      queryId: "model-choice", selector: GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
      textEquals: modelDisplayName, maxMatches: 2, fields: ["ariaChecked" as const],
    }]),
  ] as const;
  const rows = await readCoherentObservation(browser, specs);
  const count = (queryId: string): number => rows.find((row) => row.queryId === queryId)!.eligibleCount;
  const choice = rows.find((row) => row.queryId === "model-choice");
  const firstChoice = choice?.matches[0];
  const ariaChecked = typeof firstChoice?.ariaChecked === "string" ? firstChoice.ariaChecked : null;
  return Object.freeze({
    popup: count("popup"), entry: count("entry"), expandedEntry: count("expanded-entry"),
    openableEntry: count("openable-entry"), simplePanel: count("simple-panel"),
    advancedPanel: count("advanced-panel"),
    ...(choice === undefined ? {} : { modelChoice: Object.freeze({ count: choice.eligibleCount, ariaChecked }) }),
  });
};

const topologyCode = (value: ModelSelectorTopology): string => [
  `popup=${value.popup}`,
  `entry=${value.entry}`,
  `expandedEntry=${value.expandedEntry}`,
  `openableEntry=${value.openableEntry}`,
  `simple=${value.simplePanel}`,
  `advanced=${value.advancedPanel}`,
].join(":");

const isAlreadyOpen = (value: ModelSelectorTopology): boolean => value.popup === 1
  && value.entry === 1 && value.expandedEntry === 1 && value.openableEntry === 0
  && value.simplePanel === 0 && value.advancedPanel === 1;

const isOpenable = (value: ModelSelectorTopology): boolean => value.popup === 1
  && value.entry === 1 && value.expandedEntry === 0 && value.openableEntry === 1
  && value.simplePanel === 1 && value.advancedPanel === 0;

const requireAlreadyOpen = async (browser: BrowserTargetLease, modelDisplayName?: string): Promise<ModelSelectorTopology> => {
  const observed = await readModelSelectorTopology(browser, modelDisplayName);
  if (!isAlreadyOpen(observed)) {
    throw executionFailure("failed", `GPT_MODEL_SELECTION_V2_STATE_INVALID:${topologyCode(observed)}`);
  }
  return observed;
};

export const modelSelectionV2ChildHandlers = {
  async open_gpt_model_selector_v2(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    const profile = profileFromIntent(intent);
    const browser = requireBrowser(context);
    const observed = await readModelSelectorTopology(browser, profile.modelDisplayName);
    if (isAlreadyOpen(observed)) {
      return success({
        value: { selectionVersion: GPT_MODEL_SELECTION_VERSION, state: "model-selector-open" },
        candidateCount: 1,
        observedSemantics: ["ALREADY_OPEN", "one expanded model entry", "one active non-inert advanced panel"],
        committedMutation: "no",
      });
    }
    if (!isOpenable(observed)) {
      throw executionFailure("failed", `GPT_MODEL_SELECTION_V2_STATE_INVALID:${topologyCode(observed)}`);
    }
    if (context.mutationMode === "readback") {
      throw executionFailure("failed", "GPT_MODEL_SELECTION_V2_OPEN_PENDING");
    }
    await browser.executeDomIntent({
      kind: "click",
      selector: GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR,
      expectedMatches: 1,
      postClickMatch: {
        selector: GPT_MODEL_SELECTION_V2_OPEN_STATE_SELECTOR,
        expectedMatches: 1,
        timeoutMs: 5_000,
      },
    });
    await requireAlreadyOpen(browser, profile.modelDisplayName);
    return success({
      value: { selectionVersion: GPT_MODEL_SELECTION_VERSION, state: "model-selector-opened" },
      candidateCount: 1,
      observedSemantics: ["OPENABLE", "one exact model entry click", "ALREADY_OPEN"],
      committedMutation: "confirmed",
    });
  },

  async select_exact_gpt_model_v2(intent, context) {
    requireExactInputKeys(intent, ["profile"]);
    const profile = profileFromIntent(intent);
    const browser = requireBrowser(context);
    const observed = await requireAlreadyOpen(browser, profile.modelDisplayName);
    const candidate = observed.modelChoice
      ?? Object.freeze({ count: 0, ariaChecked: null });
    if (candidate.count !== 1 || (candidate.ariaChecked !== "true" && candidate.ariaChecked !== "false")) {
      throw executionFailure(
        "failed",
        `GPT_MODEL_SELECTION_V2_CANDIDATE_INVALID:count=${candidate.count}:checked=${candidate.ariaChecked ?? "missing"}`,
      );
    }
    if (context.mutationMode === "readback") {
      throw executionFailure("failed", "GPT_MODEL_SELECTION_V2_PROFILE_RESTORE_PENDING");
    }
    await browser.executeDomIntent({
      kind: "click",
      selector: GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
      expectedTextEquals: profile.modelDisplayName,
      expectedMatches: 1,
      postClickMatch: {
        selector: GPT_MODEL_SELECTION_V2_RESTORED_STATE_SELECTOR,
        expectedMatches: 1,
        timeoutMs: 5_000,
      },
    });
    const restored = await readModelSelectorTopology(browser, profile.modelDisplayName);
    if (!isOpenable(restored)) {
      throw executionFailure(
        "failed",
        `GPT_MODEL_SELECTION_V2_PROFILE_RESTORE_INVALID:${topologyCode(restored)}`,
      );
    }
    return success({
      value: {
        modelDisplayName: profile.modelDisplayName,
        previousChecked: candidate.ariaChecked,
        selectionVersion: GPT_MODEL_SELECTION_VERSION,
        state: "exact-model-selected-profile-restored",
      },
      candidateCount: 1,
      observedSemantics: [
        "one exact model radio in the active non-inert v2 panel",
        "one exact model radio click",
        "profile popup retained with collapsed entry and active non-inert simple panel",
      ],
      committedMutation: "confirmed",
    });
  },
} satisfies GptChildHandlerMap;
