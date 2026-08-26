import { createHash } from "node:crypto";

import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type {
  AiProviderAdapterContext,
  ProviderExecutionProfileProof,
} from "../contracts/ai-provider-adapter.contract.js";
import { assertProviderExecutionProfileIntegrity } from "../provider-execution-profile.js";
import type { AiFeedInput, GptWebReasoningTier } from "../schema.js";
import { assertStableWebChatDocument, recordWebChatPageAction } from "./web-chat-page-action-contract.js";

const PROFILE_TRIGGER_SELECTOR = "form button[aria-haspopup='menu'][data-tone='neutral']";
const ADVANCED_CLOSED_SELECTOR = "[role='menuitem'][aria-label='显示高级选项']";
const ADVANCED_OPEN_SELECTOR = "[role='menuitem'][aria-label='显示精简选项']";
const PROFILE_SUBMENU_SELECTOR = "[role='menuitem'][data-has-submenu]";
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
): Promise<number> => {
  const result = record(await browser.executeDomIntent({
    kind: "find",
    selector,
    ...(text?.contains === undefined ? {} : { textContains: text.contains }),
    ...(text?.equals === undefined ? {} : { textEquals: text.equals }),
    maxMatches: 20,
  }));
  if (typeof result.count !== "number") throw new Error("BROWSER_TARGET_INVALID");
  return result.count;
};

const readAttribute = async (
  browser: BrowserTargetLease,
  selector: string,
  name: string,
): Promise<string> => {
  const value = await browser.executeDomIntent({
    kind: "readAttribute",
    selector,
    name,
    maxChars: 128,
    expectedMatches: 1,
  });
  if (typeof value !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return value;
};

const clickOne = async (
  browser: BrowserTargetLease,
  selector: string,
  text?: Readonly<{ contains?: string; equals?: string }>,
): Promise<Record<string, unknown>> => record(await browser.executeDomIntent({
    kind: "click",
    selector,
    ...(text?.contains === undefined ? {} : { expectedText: text.contains }),
    ...(text?.equals === undefined ? {} : { expectedTextEquals: text.equals }),
    expectedMatches: 1,
  }));

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
  const deadline = Date.now() + Math.min(
    input.request.timeoutMs,
    PROFILE_ACTION_OBSERVATION_TIMEOUT_MS,
  );
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

const clickAndProve = async <T>(input: {
  execution: ExecutionProfileInput;
  selector: string;
  expectedText?: Readonly<{ contains?: string; equals?: string }>;
  semantics: readonly string[];
  observePostcondition: () => Promise<T | null>;
  failureCode: string;
}): Promise<T> => {
  const beforeUrl = await readDocumentUrl(input.execution.browser);
  const startedAt = new Date().toISOString();
  await clickOne(input.execution.browser, input.selector, input.expectedText);
  const evidence = await waitForProfileEvidence(
    input.execution,
    input.observePostcondition,
    input.failureCode,
  );
  const afterUrl = await readDocumentUrl(input.execution.browser);
  if (afterUrl !== beforeUrl) throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
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

const clickExactChoiceAndProve = async (input: {
  execution: ExecutionProfileInput;
  expectedValue: string;
  semantics: readonly string[];
}): Promise<void> => {
  const beforeUrl = await readDocumentUrl(input.execution.browser);
  const startedAt = new Date().toISOString();
  const result = record(await input.execution.browser.executeDomIntent({
    kind: "click",
    selector: PROFILE_CHOICE_SELECTOR,
    expectedTextEquals: input.expectedValue,
    expectedMatches: 1,
    postClickAttribute: { name: "aria-checked", equals: "true" },
  }));
  if (result.candidateCount !== 1
    || result.mutationCount !== 1
    || result.identityRevalidated !== true
    || result.postconditionVerified !== true) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
  }
  const afterUrl = await readDocumentUrl(input.execution.browser);
  if (afterUrl !== beforeUrl) throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
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
};

const advancedProfileTopologyReady = async (browser: BrowserTargetLease): Promise<boolean> =>
  await findCount(browser, ADVANCED_OPEN_SELECTOR) === 1
  && await findCount(browser, PROFILE_SUBMENU_SELECTOR) === 2
  && await findCount(browser, PROFILE_SUBMENU_SELECTOR, { contains: MODEL_LABEL }) === 1
  && await findCount(browser, PROFILE_SUBMENU_SELECTOR, { contains: REASONING_LABEL }) === 1;

const readAdvancedProfileState = async (
  browser: BrowserTargetLease,
): Promise<AdvancedProfileState | null> => {
  const closedCount = await findCount(browser, ADVANCED_CLOSED_SELECTOR);
  const openCount = await findCount(browser, ADVANCED_OPEN_SELECTOR);
  if (closedCount + openCount > 1) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_ADVANCED_AMBIGUOUS");
  }
  return closedCount + openCount === 0 ? null : { closed: closedCount === 1 };
};

const openAdvancedProfileMenu = async (input: ExecutionProfileInput): Promise<void> => {
  const browser = input.browser;
  if (await findCount(browser, PROFILE_TRIGGER_SELECTOR) !== 1) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_TRIGGER_AMBIGUOUS");
  }
  const expanded = await readAttribute(browser, PROFILE_TRIGGER_SELECTOR, "aria-expanded");
  let advancedState: AdvancedProfileState;
  if (expanded !== "true") {
    advancedState = await clickAndProve({
      execution: input,
      selector: PROFILE_TRIGGER_SELECTOR,
      semantics: ["profile-trigger", "expanded=true"],
      failureCode: "GPT_WEB_EXECUTION_PROFILE_TRIGGER_NOT_OPEN",
      observePostcondition: async () => {
        if (await readAttribute(browser, PROFILE_TRIGGER_SELECTOR, "aria-expanded") !== "true") {
          return null;
        }
        return readAdvancedProfileState(browser);
      },
    });
  } else {
    advancedState = await waitForProfileEvidence(
      input,
      () => readAdvancedProfileState(browser),
      "GPT_WEB_EXECUTION_PROFILE_ADVANCED_NOT_READY",
    );
  }
  if (advancedState.closed) {
    await clickAndProve({
      execution: input,
      selector: ADVANCED_CLOSED_SELECTOR,
      semantics: ["advanced-profile", "open"],
      failureCode: "GPT_WEB_EXECUTION_PROFILE_ADVANCED_READBACK_MISMATCH",
      observePostcondition: async () => await advancedProfileTopologyReady(browser) ? true : null,
    });
  }
  await waitForProfileEvidence(
    input,
    async () => await advancedProfileTopologyReady(browser) ? true : null,
    "GPT_WEB_EXECUTION_PROFILE_ADVANCED_READBACK_MISMATCH",
  );
};

const readOpenSubmenuSelection = async (
  browser: BrowserTargetLease,
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation | null> => {
  const candidateCount = await findCount(browser, PROFILE_CHOICE_SELECTOR);
  if (candidateCount < 1) return null;
  const expectedCount = await findCount(browser, PROFILE_CHOICE_SELECTOR, { equals: expectedValue });
  const selectedCount = await findCount(browser, CHECKED_PROFILE_CHOICE_SELECTOR);
  const expectedSelectedCount = await findCount(
    browser,
    CHECKED_PROFILE_CHOICE_SELECTOR,
    { equals: expectedValue },
  );
  if (expectedCount !== 1 || selectedCount !== 1 || expectedSelectedCount > 1) {
    throw new Error(`review_required: GPT_WEB_EXECUTION_PROFILE_${parentLabel}_AMBIGUOUS`);
  }
  return { candidateCount, selected: expectedSelectedCount === 1 };
};

const observeSubmenuSelection = async (
  input: ExecutionProfileInput,
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation> => {
  await openAdvancedProfileMenu(input);
  return clickAndProve({
    execution: input,
    selector: PROFILE_SUBMENU_SELECTOR,
    expectedText: { contains: parentLabel },
    semantics: ["profile-submenu", parentLabel],
    failureCode: `GPT_WEB_EXECUTION_PROFILE_${parentLabel}_NOT_READY`,
    observePostcondition: () => readOpenSubmenuSelection(input.browser, parentLabel, expectedValue),
  });
};

const selectExactProfileValue = async (
  input: ExecutionProfileInput,
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation> => {
  const before = await observeSubmenuSelection(input, parentLabel, expectedValue);
  if (before.selected) return before;
  await clickExactChoiceAndProve({
    execution: input,
    expectedValue,
    semantics: ["profile-choice", parentLabel, expectedValue, "aria-checked=true"],
  });
  const after = await observeSubmenuSelection(input, parentLabel, expectedValue);
  if (!after.selected) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
  }
  return after;
};

const buildProof = (input: {
  profile: NonNullable<AiFeedInput["providerExecutionProfile"]>;
  reasoningUiLabel: string;
  noOp: boolean;
  modelCandidateCount: number;
  reasoningCandidateCount: number;
}): ProviderExecutionProfileProof => {
  const observedAt = new Date().toISOString();
  const payload = {
    profileHash: input.profile.profileHash,
    modelDisplayName: input.profile.modelDisplayName,
    reasoningTier: input.profile.reasoningTier,
    reasoningUiLabel: input.reasoningUiLabel,
    modelCandidateCount: input.modelCandidateCount,
    reasoningCandidateCount: input.reasoningCandidateCount,
    noOp: input.noOp,
    observedAt,
  };
  const evidenceHash = `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}` as const;
  return {
    proofStatus: "verified",
    profileRef: input.profile.profileRef,
    profileHash: input.profile.profileHash,
    provider: input.profile.provider,
    transport: input.profile.transport,
    modelDisplayName: input.profile.modelDisplayName,
    modelFamily: input.profile.modelFamily,
    reasoningTier: input.profile.reasoningTier,
    reasoningUiLabel: input.reasoningUiLabel,
    observedAt,
    sourceKind: "provider_ui_observation",
    noOp: input.noOp,
    evidenceRef: `provider-dom-action:gpt-web-execution-profile:${evidenceHash.slice(7)}`,
    evidenceHash,
  };
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
  const modelBefore = await observeSubmenuSelection(
    input, MODEL_LABEL, modelDisplayName,
  );
  const reasoningBefore = await observeSubmenuSelection(
    input, REASONING_LABEL, reasoningUiLabel,
  );
  const noOp = modelBefore.selected && reasoningBefore.selected;
  if (!modelBefore.selected) {
    await selectExactProfileValue(input, MODEL_LABEL, modelDisplayName);
  }
  if (!reasoningBefore.selected) {
    await selectExactProfileValue(input, REASONING_LABEL, reasoningUiLabel);
  }
  const model = await observeSubmenuSelection(
    input, MODEL_LABEL, modelDisplayName,
  );
  const reasoning = await observeSubmenuSelection(
    input, REASONING_LABEL, reasoningUiLabel,
  );
  if (!model.selected || !reasoning.selected) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
  }
  return { noOp, model, reasoning };
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
  const proof = buildProof({
    profile: input.profile,
    reasoningUiLabel: input.reasoningUiLabel,
    noOp: input.selection.noOp,
    modelCandidateCount: input.selection.model.candidateCount,
    reasoningCandidateCount: input.selection.reasoning.candidateCount,
  });
  await input.execution.context.webChatExecution
    ?.onProviderExecutionProfileVerified(proof);
  await recordWebChatPageAction({
    browser: input.execution.browser, context: input.execution.context,
    actionId: "verify_execution_profile", startedAt: input.startedAt,
    beforeUrl: input.beforeUrl, afterUrl: input.afterUrl,
    result: input.selection.noOp ? "no_op" : "committed",
    candidateCount, semantics,
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
    input, profile.modelDisplayName, reasoningUiLabel,
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
    execution: input, profile, reasoningUiLabel, selection,
    startedAt, beforeUrl, afterUrl,
  });
};
