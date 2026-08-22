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

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return value as Record<string, unknown>;
};

const findCount = async (
  browser: BrowserTargetLease,
  selector: string,
  textContains?: string,
): Promise<number> => {
  const result = record(await browser.executeDomIntent({
    kind: "find",
    selector,
    ...(textContains === undefined ? {} : { textContains }),
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
  expectedText?: string,
): Promise<void> => {
  await browser.executeDomIntent({
    kind: "click",
    selector,
    ...(expectedText === undefined ? {} : { expectedText }),
    expectedMatches: 1,
  });
  await browser.wait({ durationMs: 150 });
};

const openAdvancedProfileMenu = async (browser: BrowserTargetLease): Promise<void> => {
  if (await findCount(browser, PROFILE_TRIGGER_SELECTOR) !== 1) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_TRIGGER_AMBIGUOUS");
  }
  const expanded = await readAttribute(browser, PROFILE_TRIGGER_SELECTOR, "aria-expanded");
  if (expanded !== "true") await clickOne(browser, PROFILE_TRIGGER_SELECTOR);

  const closedCount = await findCount(browser, ADVANCED_CLOSED_SELECTOR);
  const openCount = await findCount(browser, ADVANCED_OPEN_SELECTOR);
  if (closedCount + openCount !== 1) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_ADVANCED_AMBIGUOUS");
  }
  if (closedCount === 1) await clickOne(browser, ADVANCED_CLOSED_SELECTOR);
  if (await findCount(browser, ADVANCED_OPEN_SELECTOR) !== 1
    || await findCount(browser, PROFILE_SUBMENU_SELECTOR) !== 2
    || await findCount(browser, PROFILE_SUBMENU_SELECTOR, MODEL_LABEL) !== 1
    || await findCount(browser, PROFILE_SUBMENU_SELECTOR, REASONING_LABEL) !== 1) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_ADVANCED_READBACK_MISMATCH");
  }
};

const observeSubmenuSelection = async (
  browser: BrowserTargetLease,
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation> => {
  await openAdvancedProfileMenu(browser);
  await clickOne(browser, PROFILE_SUBMENU_SELECTOR, parentLabel);
  const candidateCount = await findCount(browser, PROFILE_CHOICE_SELECTOR);
  const expectedCount = await findCount(browser, PROFILE_CHOICE_SELECTOR, expectedValue);
  const selectedCount = await findCount(browser, CHECKED_PROFILE_CHOICE_SELECTOR);
  const expectedSelectedCount = await findCount(
    browser,
    CHECKED_PROFILE_CHOICE_SELECTOR,
    expectedValue,
  );
  if (candidateCount < 1 || expectedCount !== 1 || selectedCount !== 1
    || expectedSelectedCount > 1) {
    throw new Error(`review_required: GPT_WEB_EXECUTION_PROFILE_${parentLabel}_AMBIGUOUS`);
  }
  return { candidateCount, selected: expectedSelectedCount === 1 };
};

const selectExactProfileValue = async (
  browser: BrowserTargetLease,
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation> => {
  const before = await observeSubmenuSelection(browser, parentLabel, expectedValue);
  if (before.selected) return before;
  await clickOne(browser, PROFILE_CHOICE_SELECTOR, expectedValue);
  const after = await observeSubmenuSelection(browser, parentLabel, expectedValue);
  if (!after.selected) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
  }
  return after;
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
  browser: BrowserTargetLease,
  modelDisplayName: string,
  reasoningUiLabel: string,
): Promise<AppliedProfile> => {
  const modelBefore = await observeSubmenuSelection(
    browser, MODEL_LABEL, modelDisplayName,
  );
  const reasoningBefore = await observeSubmenuSelection(
    browser, REASONING_LABEL, reasoningUiLabel,
  );
  const noOp = modelBefore.selected && reasoningBefore.selected;
  if (!modelBefore.selected) {
    await selectExactProfileValue(browser, MODEL_LABEL, modelDisplayName);
  }
  if (!reasoningBefore.selected) {
    await selectExactProfileValue(browser, REASONING_LABEL, reasoningUiLabel);
  }
  const model = await observeSubmenuSelection(
    browser, MODEL_LABEL, modelDisplayName,
  );
  const reasoning = await observeSubmenuSelection(
    browser, REASONING_LABEL, reasoningUiLabel,
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
  if (!input.selection.noOp) await recordWebChatPageAction({
    browser: input.execution.browser, context: input.execution.context,
    actionId: "apply_execution_profile", startedAt: input.startedAt,
    beforeUrl: input.beforeUrl, afterUrl: input.afterUrl, result: "committed",
    candidateCount, semantics,
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
    input.browser, profile.modelDisplayName, reasoningUiLabel,
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
