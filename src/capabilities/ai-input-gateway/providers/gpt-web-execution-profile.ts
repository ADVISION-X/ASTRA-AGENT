import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type {
  AiProviderAdapterContext,
  ProviderExecutionProfileProof,
} from "../contracts/ai-provider-adapter.contract.js";
import { assertProviderExecutionProfileIntegrity } from "../provider-execution-profile.js";
import type { AiFeedInput, GptWebReasoningTier } from "../schema.js";
import { buildGptWebExecutionProfileProof } from "./gpt-web-execution-profile-proof.js";
import { assertStableWebChatDocument, recordWebChatPageAction } from "./web-chat-page-action-contract.js";

const PROFILE_TRIGGER_SELECTOR = "main button[aria-haspopup='menu']:not([aria-label])";
const PROFILE_ROOT_MENU_SELECTOR = "[role='menu']:has([role='menuitem'][aria-label='显示高级选项']),[role='menu']:has([role='menuitem'][aria-label='显示精简选项'])";
const PROFILE_ADVANCED_MENU_SELECTOR = "[role='menu']:has([role='menuitem'][aria-haspopup='menu'])";
const PROFILE_CHOICE_MENU_SELECTOR = "[role='menu']:has([role='menuitemradio'])";
const ADVANCED_CLOSED_SELECTOR = "[role='menuitem'][aria-label='显示高级选项']";
const ADVANCED_OPEN_SELECTOR = "[role='menuitem'][aria-label='显示精简选项']";
const PROFILE_SUBMENU_SELECTOR = "[role='menuitem'][aria-haspopup='menu']";
const PROFILE_CHOICE_SELECTOR = "[role='menuitemradio']";
const CHECKED_PROFILE_CHOICE_SELECTOR = "[role='menuitemradio'][aria-checked='true']";
const MODEL_LABEL = "模型";
const REASONING_LABEL = "推理强度";
const PROFILE_OBSERVATION_YIELD_MS = 100;
const PROFILE_ACTION_OBSERVATION_TIMEOUT_MS = 20_000;

const reasoningUiLabels: Partial<Record<GptWebReasoningTier, string>> = {
  medium: "中",
  high: "高",
  extra_high: "极高",
  pro_standard: "Pro",
};

type ExecutionProfileInput = Readonly<{
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
}>;

type SelectionObservation = Readonly<{
  candidateCount: number;
  selected: boolean;
}>;

type AdvancedProfileState = Readonly<{
  closed: boolean;
}>;

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return value as Record<string, unknown>;
};

const findCount = async (
  browser: BrowserTargetLease,
  selector: string,
  text?: Readonly<{ contains?: string; equals?: string }>,
  scope?: Readonly<{ selector: string }>,
): Promise<number> => {
  const result = record(await browser.executeDomIntent({
    kind: "find",
    selector,
    ...(text?.contains === undefined ? {} : { textContains: text.contains }),
    ...(text?.equals === undefined ? {} : { textEquals: text.equals }),
    maxMatches: 20,
    ...(scope ? { scope } : {}),
  }));
  if (typeof result.count !== "number") throw new Error("BROWSER_TARGET_INVALID");
  return result.count;
};

const readAttribute = async (
  browser: BrowserTargetLease,
  selector: string,
  name: string,
  scope?: Readonly<{ selector: string }>,
): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readAttribute",
    selector,
    name,
    maxChars: 128,
    expectedMatches: 1,
    ...(scope ? { scope } : {}),
  });
  if (typeof value !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return value;
};

const readDocumentUrl = async (browser: BrowserTargetLease): Promise<string> => {
  const state = record(await browser.executeDomIntent({ kind: "document" }));
  if (typeof state.url !== "string") throw new Error("BROWSER_TARGET_INVALID");
  const url = new URL(state.url);
  if (url.protocol !== "https:" || url.host !== "chatgpt.com") {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_PROVIDER_PAGE_INVALID");
  }
  return `${url.origin}${url.pathname}`;
};

const waitForProfileEvidence = async <T>(
  input: ExecutionProfileInput,
  observe: () => Promise<T | null>,
  failureCode: string,
): Promise<T> => {
  const deadline = Date.now() + PROFILE_ACTION_OBSERVATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (input.context.abortSignal?.aborted) throw new Error(`recovery_pending: ${failureCode}`);
    try {
      const evidence = await observe();
      if (evidence !== null) return evidence;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "BROWSER_TARGET_INVALID") throw error;
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs > 0) {
      await input.browser.wait({ durationMs: Math.min(PROFILE_OBSERVATION_YIELD_MS, remainingMs) });
    }
  }
  throw new Error(`recovery_pending: ${failureCode}`);
};

const assertMutationReply = (value: unknown): void => {
  const result = record(value);
  if (result.candidateCount !== 1
    || result.mutationCount !== 1
    || result.identityRevalidated !== true) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_MUTATION_INVALID");
  }
};

const isOutcomeUnknown = (error: unknown): boolean =>
  error instanceof Error && error.message === "BROWSER_OUTCOME_UNKNOWN";

const runAtomicProfileMutation = async <T>(input: {
  execution: ExecutionProfileInput;
  selector: string;
  scope?: Readonly<{ selector: string }>;
  expectedText?: Readonly<{ contains?: string; equals?: string }>;
  semantics: readonly string[];
  observePostcondition: () => Promise<T | null>;
  failureCode: string;
}): Promise<T> => {
  const beforeUrl = await readDocumentUrl(input.execution.browser);
  const startedAt = new Date().toISOString();
  try {
    assertMutationReply(await input.execution.browser.executeDomIntent({
      kind: "click",
      selector: input.selector,
      ...(input.scope ? { scope: input.scope } : {}),
      ...(input.expectedText?.contains === undefined
        ? {} : { expectedText: input.expectedText.contains }),
      ...(input.expectedText?.equals === undefined
        ? {} : { expectedTextEquals: input.expectedText.equals }),
      expectedMatches: 1,
    }));
  } catch (error) {
    if (!isOutcomeUnknown(error)) throw error;
  }

  // The physical mutation may already have committed even when transport
  // returned UNKNOWN. Only this mutation's read-only postcondition may resolve
  // it; the action is never replayed.
  const evidence = await waitForProfileEvidence(
    input.execution,
    input.observePostcondition,
    input.failureCode,
  );
  const afterUrl = await readDocumentUrl(input.execution.browser);
  if (afterUrl !== beforeUrl) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
  }
  await recordWebChatPageAction({
    browser: input.execution.browser,
    context: input.execution.context,
    actionId: "apply_execution_profile",
    startedAt,
    beforeUrl,
    afterUrl,
    result: "committed",
    candidateCount: 1,
    semantics: input.semantics,
  });
  return evidence;
};

const advancedProfileTopologyReady = async (browser: BrowserTargetLease): Promise<boolean> =>
  await findCount(browser, ADVANCED_OPEN_SELECTOR, undefined, { selector: PROFILE_ADVANCED_MENU_SELECTOR }) === 1
  && await findCount(browser, PROFILE_SUBMENU_SELECTOR, undefined, { selector: PROFILE_ADVANCED_MENU_SELECTOR }) === 2
  && await findCount(browser, PROFILE_SUBMENU_SELECTOR, { contains: MODEL_LABEL }, { selector: PROFILE_ADVANCED_MENU_SELECTOR }) === 1
  && await findCount(browser, PROFILE_SUBMENU_SELECTOR, { contains: REASONING_LABEL }, { selector: PROFILE_ADVANCED_MENU_SELECTOR }) === 1;

const readAdvancedProfileState = async (
  browser: BrowserTargetLease,
): Promise<AdvancedProfileState | null> => {
  const closedCount = await findCount(browser, ADVANCED_CLOSED_SELECTOR, undefined, { selector: PROFILE_ROOT_MENU_SELECTOR });
  const openCount = await findCount(browser, ADVANCED_OPEN_SELECTOR, undefined, { selector: PROFILE_ROOT_MENU_SELECTOR });
  if (closedCount + openCount > 1) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_ADVANCED_AMBIGUOUS");
  }
  return closedCount + openCount === 0 ? null : { closed: closedCount === 1 };
};

const readUniqueProfileTrigger = async (
  browser: BrowserTargetLease,
): Promise<boolean | null> => {
  const triggerCount = await findCount(browser, PROFILE_TRIGGER_SELECTOR);
  if (triggerCount > 1) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_TRIGGER_AMBIGUOUS");
  }
  return triggerCount === 1 ? true : null;
};

const openAdvancedProfileMenu = async (input: ExecutionProfileInput): Promise<void> => {
  await waitForProfileEvidence(
    input,
    () => readUniqueProfileTrigger(input.browser),
    "GPT_WEB_EXECUTION_PROFILE_TRIGGER_NOT_READY",
  );
  const expanded = await readAttribute(input.browser, PROFILE_TRIGGER_SELECTOR, "aria-expanded");
  let advancedState: AdvancedProfileState;
  if (expanded === "false") {
    advancedState = await runAtomicProfileMutation({
      execution: input,
      selector: PROFILE_TRIGGER_SELECTOR,
      semantics: ["profile-trigger", "expanded=true"],
      failureCode: "GPT_WEB_EXECUTION_PROFILE_TRIGGER_NOT_OPEN",
      observePostcondition: async () => {
        if (await readAttribute(input.browser, PROFILE_TRIGGER_SELECTOR, "aria-expanded") !== "true") {
          return null;
        }
        return readAdvancedProfileState(input.browser);
      },
    });
  } else if (expanded === "true") {
    advancedState = await waitForProfileEvidence(
      input,
      () => readAdvancedProfileState(input.browser),
      "GPT_WEB_EXECUTION_PROFILE_ADVANCED_NOT_READY",
    );
  } else {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_TRIGGER_AMBIGUOUS");
  }

  if (advancedState.closed) {
    await runAtomicProfileMutation({
      execution: input,
      selector: ADVANCED_CLOSED_SELECTOR,
      scope: { selector: PROFILE_ROOT_MENU_SELECTOR },
      semantics: ["advanced-profile", "open"],
      failureCode: "GPT_WEB_EXECUTION_PROFILE_ADVANCED_READBACK_MISMATCH",
      observePostcondition: async () => await advancedProfileTopologyReady(input.browser) ? true : null,
    });
  }
  await waitForProfileEvidence(
    input,
    async () => await advancedProfileTopologyReady(input.browser) ? true : null,
    "GPT_WEB_EXECUTION_PROFILE_ADVANCED_READBACK_MISMATCH",
  );
};

const readOpenSubmenuSelection = async (
  browser: BrowserTargetLease,
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation | null> => {
  const candidateCount = await findCount(browser, PROFILE_CHOICE_SELECTOR, undefined, { selector: PROFILE_CHOICE_MENU_SELECTOR });
  if (candidateCount < 1) return null;
  const expectedCount = await findCount(browser, PROFILE_CHOICE_SELECTOR, { equals: expectedValue }, { selector: PROFILE_CHOICE_MENU_SELECTOR });
  const selectedCount = await findCount(browser, CHECKED_PROFILE_CHOICE_SELECTOR, undefined, { selector: PROFILE_CHOICE_MENU_SELECTOR });
  const expectedSelectedCount = await findCount(
    browser,
    CHECKED_PROFILE_CHOICE_SELECTOR,
    { equals: expectedValue },
    { selector: PROFILE_CHOICE_MENU_SELECTOR },
  );
  if (expectedCount !== 1 || selectedCount !== 1 || expectedSelectedCount > 1) {
    throw new Error(`review_required: GPT_WEB_EXECUTION_PROFILE_${parentLabel}_AMBIGUOUS`);
  }
  return { candidateCount, selected: expectedSelectedCount === 1 };
};

const readProfileSummary = async (
  browser: BrowserTargetLease,
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation | null> => {
  const parentCount = await findCount(browser, PROFILE_SUBMENU_SELECTOR, { contains: parentLabel }, { selector: PROFILE_ADVANCED_MENU_SELECTOR });
  if (parentCount === 0) return null;
  const expectedCount = await findCount(
    browser,
    PROFILE_SUBMENU_SELECTOR,
    { equals: `${parentLabel}${expectedValue}` },
    { selector: PROFILE_ADVANCED_MENU_SELECTOR },
  );
  if (parentCount !== 1 || expectedCount > 1) {
    throw new Error(`review_required: GPT_WEB_EXECUTION_PROFILE_${parentLabel}_AMBIGUOUS`);
  }
  return { candidateCount: 1, selected: expectedCount === 1 };
};

const readCurrentProfileSummary = async (
  input: ExecutionProfileInput,
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation> => waitForProfileEvidence(
  input,
  () => readProfileSummary(input.browser, parentLabel, expectedValue),
  `GPT_WEB_EXECUTION_PROFILE_${parentLabel}_SUMMARY_NOT_READY`,
);

const readProfileMenuClosed = async (
  browser: BrowserTargetLease,
): Promise<boolean | null> => {
  const expanded = await readAttribute(browser, PROFILE_TRIGGER_SELECTOR, "aria-expanded");
  if (expanded === "false") return true;
  if (expanded === "true") return null;
  throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_TRIGGER_AMBIGUOUS");
};

const openExactProfileSubmenu = async (
  input: ExecutionProfileInput,
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation> => runAtomicProfileMutation({
  execution: input,
  selector: PROFILE_SUBMENU_SELECTOR,
  scope: { selector: PROFILE_ADVANCED_MENU_SELECTOR },
  expectedText: { contains: parentLabel },
  semantics: ["profile-submenu", parentLabel],
  failureCode: `GPT_WEB_EXECUTION_PROFILE_${parentLabel}_NOT_READY`,
  observePostcondition: () => readOpenSubmenuSelection(input.browser, parentLabel, expectedValue),
});

const selectExactProfileValue = async (
  input: ExecutionProfileInput,
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation> => {
  const menuState = await openExactProfileSubmenu(input, parentLabel, expectedValue);
  if (menuState.selected) return { candidateCount: 1, selected: true };
  await runAtomicProfileMutation({
    execution: input,
    selector: PROFILE_CHOICE_SELECTOR,
    scope: { selector: PROFILE_CHOICE_MENU_SELECTOR },
    expectedText: { equals: expectedValue },
    semantics: ["profile-choice", parentLabel, expectedValue, "menu-closed=true"],
    failureCode: `GPT_WEB_EXECUTION_PROFILE_${parentLabel}_SELECTION_NOT_COMMITTED`,
    observePostcondition: () => readProfileMenuClosed(input.browser),
  });
  return { candidateCount: 1, selected: true };
};

const closeProfileMenu = async (input: ExecutionProfileInput): Promise<void> => {
  const expanded = await readAttribute(input.browser, PROFILE_TRIGGER_SELECTOR, "aria-expanded");
  if (expanded === "false") return;
  if (expanded !== "true") {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_TRIGGER_AMBIGUOUS");
  }
  await runAtomicProfileMutation({
    execution: input,
    selector: PROFILE_TRIGGER_SELECTOR,
    semantics: ["profile-trigger", "expanded=false"],
    failureCode: "GPT_WEB_EXECUTION_PROFILE_TRIGGER_NOT_CLOSED",
    observePostcondition: async () => await readAttribute(
      input.browser,
      PROFILE_TRIGGER_SELECTOR,
      "aria-expanded",
    ) === "false" ? true : null,
  });
};

type AppliedProfile = Readonly<{
  noOp: boolean;
  model: SelectionObservation;
  reasoning: SelectionObservation;
}>;

const applyExactExecutionProfile = async (
  input: ExecutionProfileInput,
  modelDisplayName: string,
  reasoningUiLabel: string,
): Promise<AppliedProfile> => {
  await openAdvancedProfileMenu(input);
  let model = await readCurrentProfileSummary(input, MODEL_LABEL, modelDisplayName);
  let changed = false;
  if (!model.selected) {
    model = await selectExactProfileValue(input, MODEL_LABEL, modelDisplayName);
    changed = true;
    await openAdvancedProfileMenu(input);
    model = await readCurrentProfileSummary(input, MODEL_LABEL, modelDisplayName);
    if (!model.selected) {
      throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
    }
  }

  let reasoning = await readCurrentProfileSummary(input, REASONING_LABEL, reasoningUiLabel);
  if (!reasoning.selected) {
    reasoning = await selectExactProfileValue(input, REASONING_LABEL, reasoningUiLabel);
    changed = true;
  }

  // A choice closes the menu. That proves only that the physical click ended;
  // it does not prove the selected value. Reopen the same menu once and use
  // both exact parent summaries as the terminal profile readback.
  await openAdvancedProfileMenu(input);
  model = await readCurrentProfileSummary(input, MODEL_LABEL, modelDisplayName);
  reasoning = await readCurrentProfileSummary(input, REASONING_LABEL, reasoningUiLabel);
  if (!model.selected || !reasoning.selected) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
  }
  await closeProfileMenu(input);
  return { noOp: !changed, model, reasoning };
};

const persistExecutionProfileProof = async (input: {
  execution: ExecutionProfileInput;
  profile: NonNullable<AiFeedInput["providerExecutionProfile"]>;
  reasoningUiLabel: string;
  selection: AppliedProfile;
  startedAt: string;
  beforeUrl: string;
  afterUrl: string;
}): Promise<ProviderExecutionProfileProof> => {
  const candidateCount = input.selection.model.candidateCount
    + input.selection.reasoning.candidateCount;
  const semantics = [
    input.profile.modelDisplayName,
    input.reasoningUiLabel,
    input.profile.profileHash,
  ];
  const proof = buildGptWebExecutionProfileProof({
    profile: input.profile,
    reasoningUiLabel: input.reasoningUiLabel,
    noOp: input.selection.noOp,
    modelCandidateCount: input.selection.model.candidateCount,
    reasoningCandidateCount: input.selection.reasoning.candidateCount,
  });
  await input.execution.context.webChatExecution?.onProviderExecutionProfileVerified(proof);
  await recordWebChatPageAction({
    browser: input.execution.browser,
    context: input.execution.context,
    actionId: "verify_execution_profile",
    startedAt: input.startedAt,
    beforeUrl: input.beforeUrl,
    afterUrl: input.afterUrl,
    result: input.selection.noOp ? "no_op" : "committed",
    candidateCount,
    semantics,
  });
  return proof;
};

export const enforceGptWebExecutionProfile = async (
  input: ExecutionProfileInput,
): Promise<ProviderExecutionProfileProof | null> => {
  const profile = input.request.providerExecutionProfile;
  if (input.request.providerKind !== "gpt-web-chat" || !profile) return null;
  assertProviderExecutionProfileIntegrity(profile);
  const reasoningUiLabel = reasoningUiLabels[profile.reasoningTier];
  if (!reasoningUiLabel) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_REASONING_UNAVAILABLE");
  }

  const expectedDocumentRef = input.browser.document.documentRef;
  const beforeUrl = await readDocumentUrl(input.browser);
  const startedAt = new Date().toISOString();
  assertStableWebChatDocument({
    browser: input.browser,
    expectedDocumentRef,
    actionId: "observe_execution_profile",
  });

  const selection = await applyExactExecutionProfile(
    input,
    profile.modelDisplayName,
    reasoningUiLabel,
  );
  assertStableWebChatDocument({
    browser: input.browser,
    expectedDocumentRef,
    actionId: "verify_execution_profile",
  });
  const afterUrl = await readDocumentUrl(input.browser);
  if (afterUrl !== beforeUrl) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
  }
  return persistExecutionProfileProof({
    execution: input,
    profile,
    reasoningUiLabel,
    selection,
    startedAt,
    beforeUrl,
    afterUrl,
  });
};
