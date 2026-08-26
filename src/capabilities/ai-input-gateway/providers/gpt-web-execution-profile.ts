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
const ADVANCED_CLOSED_SELECTOR = "[role='menuitem'][aria-label='显示高级选项']";
const ADVANCED_OPEN_SELECTOR = "[role='menuitem'][aria-label='显示精简选项']";
const PROFILE_SUBMENU_SELECTOR = "[role='menuitem'][aria-haspopup='menu']";
const PROFILE_CHOICE_SELECTOR = "[role='menuitemradio']";
const PROFILE_SURFACE_SELECTOR = [
  PROFILE_TRIGGER_SELECTOR,
  ADVANCED_CLOSED_SELECTOR,
  ADVANCED_OPEN_SELECTOR,
  PROFILE_SUBMENU_SELECTOR,
  PROFILE_CHOICE_SELECTOR,
].join(",");
const MODEL_LABEL = "模型";
const REASONING_LABEL = "推理强度";
const PROFILE_OBSERVATION_DELAYS_MS = [0, 250, 500, 1_000, 1_000] as const;

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

type ProfileSurfaceNode = Readonly<{
  tagName: string;
  role: string;
  ariaLabel: string;
  ariaExpanded: string;
  ariaChecked: string;
  text: string;
}>;

type ProfileSurface = Readonly<{
  nodes: readonly ProfileSurfaceNode[];
  triggerExpanded: "true" | "false" | null;
}>;

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return value as Record<string, unknown>;
};

const text = (value: string): string => value.replace(/\s+/gu, "").trim();

const stringField = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return value;
};

const readProfileSurface = async (browser: BrowserTargetLease): Promise<ProfileSurface> => {
  const result = record(await browser.executeDomIntent({
    kind: "find",
    selector: PROFILE_SURFACE_SELECTOR,
    maxMatches: 20,
    fields: ["tagName", "role", "ariaLabel", "ariaExpanded", "ariaChecked", "text"],
  }));
  if (!Number.isInteger(result.count) || !Array.isArray(result.matches)
    || result.matches.length !== result.count) throw new Error("BROWSER_TARGET_INVALID");
  const nodes = result.matches.map((value): ProfileSurfaceNode => {
    const node = record(value);
    return {
      tagName: stringField(node.tagName),
      role: stringField(node.role),
      ariaLabel: stringField(node.ariaLabel),
      ariaExpanded: stringField(node.ariaExpanded),
      ariaChecked: stringField(node.ariaChecked),
      text: stringField(node.text),
    };
  });
  const triggers = nodes.filter((node) => node.tagName.toUpperCase() === "BUTTON");
  if (triggers.length > 1) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_TRIGGER_AMBIGUOUS");
  }
  const expanded = triggers[0]?.ariaExpanded ?? null;
  if (expanded !== null && expanded !== "true" && expanded !== "false") {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_TRIGGER_AMBIGUOUS");
  }
  return { nodes, triggerExpanded: expanded };
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
  for (const delayMs of PROFILE_OBSERVATION_DELAYS_MS) {
    if (input.context.abortSignal?.aborted) throw new Error(`recovery_pending: ${failureCode}`);
    if (delayMs > 0) await input.browser.wait({ durationMs: delayMs });
    const evidence = await observe();
    if (evidence !== null) return evidence;
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

const nodesWithLabel = (surface: ProfileSurface, label: string): readonly ProfileSurfaceNode[] =>
  surface.nodes.filter((node) => node.role === "menuitem" && text(node.text).startsWith(text(label)));

const advancedState = (surface: ProfileSurface): "closed" | "open" | null => {
  const closed = surface.nodes.filter((node) => node.ariaLabel === "显示高级选项");
  const open = surface.nodes.filter((node) => node.ariaLabel === "显示精简选项");
  if (closed.length + open.length > 1) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_ADVANCED_AMBIGUOUS");
  }
  return closed.length === 1 ? "closed" : open.length === 1 ? "open" : null;
};

const advancedSurfaceReady = (surface: ProfileSurface): ProfileSurface | null => {
  if (advancedState(surface) !== "open") return null;
  const model = nodesWithLabel(surface, MODEL_LABEL);
  const reasoning = nodesWithLabel(surface, REASONING_LABEL);
  if (model.length > 1 || reasoning.length > 1) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_ADVANCED_AMBIGUOUS");
  }
  return model.length === 1 && reasoning.length === 1 ? surface : null;
};

const openAdvancedProfileMenu = async (input: ExecutionProfileInput): Promise<ProfileSurface> => {
  let surface = await waitForProfileEvidence(
    input,
    async () => {
      const current = await readProfileSurface(input.browser);
      return current.triggerExpanded === null ? null : current;
    },
    "GPT_WEB_EXECUTION_PROFILE_TRIGGER_NOT_READY",
  );
  if (surface.triggerExpanded === "false") {
    surface = await runAtomicProfileMutation({
      execution: input,
      selector: PROFILE_TRIGGER_SELECTOR,
      semantics: ["profile-trigger", "expanded=true"],
      failureCode: "GPT_WEB_EXECUTION_PROFILE_TRIGGER_NOT_OPEN",
      observePostcondition: async () => {
        const current = await readProfileSurface(input.browser);
        return current.triggerExpanded === "true" && advancedState(current) !== null
          ? current : null;
      },
    });
  }

  const state = advancedState(surface);
  if (state === null) {
    surface = await waitForProfileEvidence(
      input,
      async () => {
        const current = await readProfileSurface(input.browser);
        return advancedState(current) === null ? null : current;
      },
      "GPT_WEB_EXECUTION_PROFILE_ADVANCED_NOT_READY",
    );
  }
  if (advancedState(surface) === "closed") {
    surface = await runAtomicProfileMutation({
      execution: input,
      selector: ADVANCED_CLOSED_SELECTOR,
      semantics: ["advanced-profile", "open"],
      failureCode: "GPT_WEB_EXECUTION_PROFILE_ADVANCED_READBACK_MISMATCH",
      observePostcondition: async () => advancedSurfaceReady(
        await readProfileSurface(input.browser),
      ),
    });
  }
  return waitForProfileEvidence(
    input,
    async () => advancedSurfaceReady(surface)
      ?? advancedSurfaceReady(await readProfileSurface(input.browser)),
    "GPT_WEB_EXECUTION_PROFILE_ADVANCED_READBACK_MISMATCH",
  );
};

const readOpenSubmenuSelection = (
  surface: ProfileSurface,
  parentCode: "MODEL" | "REASONING",
  expectedValue: string,
): SelectionObservation | null => {
  const choices = surface.nodes.filter((node) => node.role === "menuitemradio");
  if (choices.length < 1) return null;
  const expected = choices.filter((node) => text(node.text) === text(expectedValue));
  const selected = choices.filter((node) => node.ariaChecked === "true");
  if (expected.length === 0) {
    throw new Error(`review_required: GPT_WEB_EXECUTION_PROFILE_${parentCode}_UNAVAILABLE`);
  }
  if (expected.length > 1 || selected.length > 1) {
    throw new Error(`review_required: GPT_WEB_EXECUTION_PROFILE_${parentCode}_AMBIGUOUS`);
  }
  if (selected.length === 0) return null;
  return { candidateCount: choices.length, selected: selected[0] === expected[0] };
};

const readProfileSummary = (
  surface: ProfileSurface,
  parentCode: "MODEL" | "REASONING",
  parentLabel: string,
  expectedValue: string,
): SelectionObservation | null => {
  const parents = nodesWithLabel(surface, parentLabel);
  if (parents.length === 0) return null;
  if (parents.length > 1) {
    throw new Error(`review_required: GPT_WEB_EXECUTION_PROFILE_${parentCode}_AMBIGUOUS`);
  }
  return {
    candidateCount: 1,
    selected: text(parents[0]!.text) === text(`${parentLabel}${expectedValue}`),
  };
};

const exactProfileSummaries = (
  surface: ProfileSurface,
  modelDisplayName: string,
  reasoningUiLabel: string,
): Readonly<{ model: SelectionObservation; reasoning: SelectionObservation }> => {
  const model = readProfileSummary(surface, "MODEL", MODEL_LABEL, modelDisplayName);
  const reasoning = readProfileSummary(surface, "REASONING", REASONING_LABEL, reasoningUiLabel);
  if (!model || !reasoning) {
    throw new Error("recovery_pending: GPT_WEB_EXECUTION_PROFILE_SUMMARY_NOT_READY");
  }
  return { model, reasoning };
};

const openExactProfileSubmenu = async (
  input: ExecutionProfileInput,
  parentCode: "MODEL" | "REASONING",
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation> => runAtomicProfileMutation({
  execution: input,
  selector: PROFILE_SUBMENU_SELECTOR,
  expectedText: { contains: parentLabel },
  semantics: ["profile-submenu", parentCode],
  failureCode: `GPT_WEB_EXECUTION_PROFILE_${parentCode}_NOT_READY`,
  observePostcondition: async () => readOpenSubmenuSelection(
    await readProfileSurface(input.browser),
    parentCode,
    expectedValue,
  ),
});

const selectExactProfileValue = async (
  input: ExecutionProfileInput,
  parentCode: "MODEL" | "REASONING",
  parentLabel: string,
  expectedValue: string,
): Promise<SelectionObservation> => {
  const menuState = await openExactProfileSubmenu(
    input,
    parentCode,
    parentLabel,
    expectedValue,
  );
  if (menuState.selected) return { candidateCount: 1, selected: true };
  await runAtomicProfileMutation({
    execution: input,
    selector: PROFILE_CHOICE_SELECTOR,
    expectedText: { equals: expectedValue },
    semantics: ["profile-choice", parentCode, expectedValue, "menu-closed=true"],
    failureCode: `GPT_WEB_EXECUTION_PROFILE_${parentCode}_SELECTION_NOT_COMMITTED`,
    observePostcondition: async () => {
      const surface = await readProfileSurface(input.browser);
      return surface.triggerExpanded === "false" ? true : null;
    },
  });
  return { candidateCount: 1, selected: true };
};

const closeProfileMenu = async (input: ExecutionProfileInput): Promise<void> => {
  const surface = await readProfileSurface(input.browser);
  if (surface.triggerExpanded === "false") return;
  if (surface.triggerExpanded !== "true") {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_TRIGGER_AMBIGUOUS");
  }
  await runAtomicProfileMutation({
    execution: input,
    selector: PROFILE_TRIGGER_SELECTOR,
    semantics: ["profile-trigger", "expanded=false"],
    failureCode: "GPT_WEB_EXECUTION_PROFILE_TRIGGER_NOT_CLOSED",
    observePostcondition: async () => (await readProfileSurface(input.browser))
      .triggerExpanded === "false" ? true : null,
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
  let surface = await openAdvancedProfileMenu(input);
  let summaries = exactProfileSummaries(surface, modelDisplayName, reasoningUiLabel);
  let changed = false;
  if (!summaries.model.selected) {
    await selectExactProfileValue(input, "MODEL", MODEL_LABEL, modelDisplayName);
    changed = true;
    surface = await openAdvancedProfileMenu(input);
    summaries = exactProfileSummaries(surface, modelDisplayName, reasoningUiLabel);
    if (!summaries.model.selected) {
      throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
    }
  }

  if (!summaries.reasoning.selected) {
    await selectExactProfileValue(input, "REASONING", REASONING_LABEL, reasoningUiLabel);
    changed = true;
  }

  // A choice closes the menu. That proves only that the physical click ended;
  // it does not prove the selected value. Reopen the same menu once and use
  // both exact parent summaries as the terminal profile readback.
  surface = await openAdvancedProfileMenu(input);
  summaries = exactProfileSummaries(surface, modelDisplayName, reasoningUiLabel);
  if (!summaries.model.selected || !summaries.reasoning.selected) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
  }
  await closeProfileMenu(input);
  return { noOp: !changed, ...summaries };
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
