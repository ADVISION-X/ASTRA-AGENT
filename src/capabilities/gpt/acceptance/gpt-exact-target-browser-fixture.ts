import { createHash } from "node:crypto";

import type {
  BrowserAtomicStepIdentity,
  BrowserAtomicStepOutcome,
  BrowserDomIntent,
  BrowserDomObservationQuery,
  BrowserTargetLease,
} from "../../../lib/browser/browser-authority-api.js";
import { browserExecutionFailure } from "../../../lib/browser/browser-authority-api.js";

export const coherentObservationPacket = (
  intent: Readonly<{ queries: readonly BrowserDomObservationQuery[] }>,
  facts: Readonly<Record<string, Readonly<{
    scopeRawCount?: number;
    scopeEligibleCount?: number;
    rawCount: number;
    eligibleCount: number;
    matches?: readonly Readonly<Record<string, unknown>>[];
    scopeRejections?: readonly Readonly<{ index: number; reasons: readonly string[] }>[];
    rejections?: readonly Readonly<{ index: number; reasons: readonly string[] }>[];
    nativeCauseCode?: "NO_LAYOUT_BOX" | null;
    nativeCauseCount?: number;
  }>>>,
  currentUrl = "https://chatgpt.com/",
) => Object.freeze({
  schemaVersion: "grasseye.browser.dom-observation.v2" as const,
  exactCallIdentityHash: `sha256:${"1".repeat(64)}` as `sha256:${string}`,
  targetRefHash: `sha256:${"2".repeat(64)}` as `sha256:${string}`,
  documentRefHash: `sha256:${"3".repeat(64)}` as `sha256:${string}`,
  currentUrl,
  observationRevisionHash: `sha256:${"4".repeat(64)}` as `sha256:${string}`,
  observedAt: "2026-09-02T00:00:00.000Z",
  queries: intent.queries.map((query) => {
    const fact = facts[query.queryId] ?? { rawCount: 0, eligibleCount: 0 };
    return Object.freeze({
      queryId: query.queryId,
      scopeRawCount: fact.scopeRawCount ?? (query.scope ? 1 : 0),
      scopeEligibleCount: fact.scopeEligibleCount ?? (query.scope ? 1 : 0),
      rawCount: fact.rawCount,
      eligibleCount: fact.eligibleCount,
      matches: Object.freeze([...(fact.matches ?? [])]),
      scopeRejections: Object.freeze([...(fact.scopeRejections ?? [])]),
      rejections: Object.freeze([...(fact.rejections ?? [])]),
      nativeCauseCode: fact.nativeCauseCode ?? null,
      nativeCauseCount: fact.nativeCauseCount ?? 0,
      nativeStage: "runtime-call-function-on" as const,
    });
  }),
});

const hashText = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const exactAssistantTurnReply = (
  intent: Extract<BrowserDomIntent, { kind: "readExactAssistantTurn" }>,
  semanticText: string,
  rawDomHtml = `<section data-testid="conversation-turn-4"><div data-message-author-role="assistant">${semanticText}</div></section>`,
) => Object.freeze({
  schemaVersion: "grasseye.browser.exact-assistant-turn.v3" as const,
  exactCallIdentityHash: `sha256:${"5".repeat(64)}` as `sha256:${string}`,
  targetRefHash: `sha256:${"2".repeat(64)}` as `sha256:${string}`,
  documentRefHash: `sha256:${"3".repeat(64)}` as `sha256:${string}`,
  observationRevisionHash: `sha256:${"6".repeat(64)}` as `sha256:${string}`,
  assistantTurnId: "conversation-turn-4",
  currentUrl: intent.canonicalConversationUrl,
  precedingUserTurnId: intent.userTurnId,
  generatingRaw: 0,
  rawDomHtml,
  rawDomHash: hashText(rawDomHtml),
  semanticText,
  semanticTextHash: hashText(semanticText),
  observedAt: "2026-09-02T00:00:00.000Z",
});

export const EXPECTED_GPT_CHILD_IDS = Object.freeze([
  "acknowledge_known_gpt_rate_limit", "attach_approved_gpt_files_once", "checkpoint_gpt_generated_image",
  "checkpoint_gpt_text_response", "close_gpt_execution_profile",
  "ensure_gpt_reasoning_requirement",
  "open_gpt_attachment_control",
  "open_gpt_execution_profile", "open_gpt_model_selector_v2",
  "prepare_clean_gpt_chat", "reconcile_gpt_attachment_set",
  "rename_settled_gpt_conversation",
  "select_exact_gpt_model_v2", "submit_exact_gpt_turn_once", "write_exact_gpt_prompt",
].sort());

type DomResponder = (intent: BrowserDomIntent, callNumber: number) => unknown | Promise<unknown>;
type FakeBrowserOptions = Readonly<{
  initialPending?: number;
  initialRecovery?: BrowserAtomicStepOutcome;
  exposeInitialRecoveryOutsideAtomic?: boolean;
  initialUrl?: string;
  navigationEpochAdvanceOnMutation?: number;
  navigationEpochAdvanceOnWait?: number;
  authenticatedMedia?: Awaited<ReturnType<BrowserTargetLease["readAuthenticatedMedia"]>>;
  onAttachFile?: (input: Parameters<BrowserTargetLease["attachFile"]>[0]) => void;
  onWait?: (durationMs: number) => void;
}>;
type FakeBrowserState = {
  pending: number;
  documentRef: string;
  navigationEpoch: number;
  url: string;
  domCalls: number;
  physicalMutations: number;
  authenticatedMediaDownloads: number;
  waitDurations: number[];
  atomicIdentity: BrowserAtomicStepIdentity | null;
  recovery: BrowserAtomicStepOutcome | null;
};

const markConfirmedMutation = (
  state: FakeBrowserState,
  mutationOutcome: "no" | "confirmed" = "confirmed",
): void => {
  if (!state.atomicIdentity) return;
  state.recovery = Object.freeze({
    state: "confirmed",
    mutationOutcome,
    providerEffectIdentityHash: state.atomicIdentity.replayPolicy === "provider-effect-once"
      ? `sha256:${"8".repeat(64)}` : null,
    terminalAt: "2026-09-02T00:00:01.000Z",
    failureCode: null,
    nativeFailureCode: null,
    authorityRef: `browser-mutation:${state.atomicIdentity.callId}`,
    authorityHash: `sha256:${"9".repeat(64)}`,
    targetRef: "target:1",
    documentRef: state.documentRef,
    physicalInputCount: 0,
    downloadGuidHash: null,
    downloadCompleted: false,
    identityRevalidated: false,
  });
};

const markRejectedMutation = (
  state: FakeBrowserState,
  mutationOutcome: "no" | "dispatched" | "confirmed",
  failureCode: string,
  nativeFailureCode: string | null,
): void => {
  if (!state.atomicIdentity) return;
  state.recovery = Object.freeze({
    state: "rejected",
    mutationOutcome,
    providerEffectIdentityHash: state.atomicIdentity.replayPolicy === "provider-effect-once"
      ? `sha256:${"8".repeat(64)}` : null,
    terminalAt: "2026-09-02T00:00:01.000Z",
    failureCode,
    nativeFailureCode,
    authorityRef: `browser-mutation:${state.atomicIdentity.callId}`,
    authorityHash: `sha256:${"9".repeat(64)}`,
    targetRef: "target:1",
    documentRef: state.documentRef,
    physicalInputCount: 0,
    downloadGuidHash: null,
    downloadCompleted: false,
    identityRevalidated: false,
  });
};

const markDispatchedMutation = (state: FakeBrowserState): void => {
  if (!state.atomicIdentity) return;
  state.recovery = Object.freeze({
    state: "dispatched",
    mutationOutcome: "dispatched",
    providerEffectIdentityHash: state.atomicIdentity.replayPolicy === "provider-effect-once"
      ? `sha256:${"8".repeat(64)}` : null,
    terminalAt: null,
    failureCode: null,
    nativeFailureCode: null,
    authorityRef: `browser-mutation:${state.atomicIdentity.callId}`,
    authorityHash: `sha256:${"9".repeat(64)}`,
    targetRef: "target:1",
    documentRef: state.documentRef,
    physicalInputCount: 0,
    downloadGuidHash: null,
    downloadCompleted: false,
    identityRevalidated: false,
  });
};

const throwFakeMutationFailure = (
  state: FakeBrowserState,
  mutationOutcome: "no" | "dispatched" | "confirmed",
  browserOutcome: "DISPATCHED" | "REJECTED",
  failureCode: string,
  nativeCauseCode: string | null,
): never => {
  const cause = nativeCauseCode
    ? Object.assign(new Error(nativeCauseCode), { code: nativeCauseCode }) : undefined;
  throw browserExecutionFailure(new Error(failureCode, { ...(cause ? { cause } : {}) }), mutationOutcome, {
    effectScope: state.atomicIdentity?.replayPolicy === "provider-effect-once"
      ? "provider_effect" : "target_local",
    childCapabilityId: state.atomicIdentity?.childCapabilityId ?? "unknown",
    browserOutcome,
    providerEffectIdentityHash: state.atomicIdentity?.replayPolicy === "provider-effect-once"
      ? `sha256:${"8".repeat(64)}` : null,
  });
};

const fakeResultRecord = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : null;

const fakeMutationCount = (result: Readonly<Record<string, unknown>> | null): number => {
  const declared = result?.mutationCount;
  return Number.isSafeInteger(declared) ? Number(declared) : 1;
};

const fakeFailureDetails = (
  result: Readonly<Record<string, unknown>>,
  fallback: string,
): Readonly<{ failureCode: string; nativeCauseCode: string | null }> => ({
  failureCode: typeof result.failureCode === "string" ? result.failureCode : fallback,
  nativeCauseCode: typeof result.nativeCauseCode === "string" ? result.nativeCauseCode : null,
});

const rejectFakeMutation = (
  state: FakeBrowserState,
  result: Readonly<Record<string, unknown>>,
  mutationOutcome: "no" | "dispatched" | "confirmed",
  fallback: string,
): never => {
  const { failureCode, nativeCauseCode } = fakeFailureDetails(result, fallback);
  markRejectedMutation(state, mutationOutcome, failureCode, nativeCauseCode);
  return throwFakeMutationFailure(state, mutationOutcome, "REJECTED", failureCode, nativeCauseCode);
};

const settleFakeMutation = (state: FakeBrowserState, value: unknown): void => {
  const result = fakeResultRecord(value);
  const mutationCount = fakeMutationCount(result);
  state.physicalMutations += mutationCount;
  const mutationOutcome = mutationCount === 0 ? "no" as const : "confirmed" as const;
  if (result?.terminalRejectedDispatched === true) {
    rejectFakeMutation(state, result, "dispatched", "BROWSER_CAPABILITY_REJECTED");
  }
  if (result?.receiptMissing === true) {
    markDispatchedMutation(state);
    throwFakeMutationFailure(state, "dispatched", "DISPATCHED", "BROWSER_COMMAND_RECEIPT_MISSING", null);
  }
  if (result?.postconditionVerified === false) {
    rejectFakeMutation(state, result, mutationOutcome, "BROWSER_POSTCONDITION_FAILED");
  }
  markConfirmedMutation(state, mutationOutcome);
};

const executeFakeDomIntent = async (
  responder: DomResponder,
  state: FakeBrowserState,
  intent: BrowserDomIntent,
  options: FakeBrowserOptions,
): Promise<unknown> => {
  state.domCalls += 1;
  const mutates = ["click", "hover", "doubleClick", "keypress", "fill",
    "renameExactGptConversation", "acknowledgeKnownGptRateLimit"].includes(intent.kind);
  const value = intent.kind === "document"
    ? { url: state.url, title: "ChatGPT" }
    : await responder(intent, state.domCalls);
  if (mutates) {
    settleFakeMutation(state, value);
    const advance = options.navigationEpochAdvanceOnMutation ?? 0;
    if (advance > 0) {
      state.navigationEpoch += advance;
      state.documentRef = `document:${state.navigationEpoch}`;
    }
  }
  if (intent.kind !== "document" || !value || typeof value !== "object" || Array.isArray(value)) return value;
  const nextUrl = Reflect.get(value, "url");
  if (typeof nextUrl === "string" && nextUrl !== state.url) {
    state.url = nextUrl;
    state.navigationEpoch += 1;
    state.documentRef = `document:${state.navigationEpoch}`;
  }
  return value;
};

const createFakeBrowserLease = (
  responder: DomResponder,
  state: FakeBrowserState,
  options: FakeBrowserOptions,
): BrowserTargetLease => ({
  leaseRef: "lease:1",
  authorityRef: "authority:1",
  authorityEpoch: 1,
  executionBindingHash: `sha256:${"a".repeat(64)}`,
  ownerId: "gpt-acceptance",
  agentJobRefHash: `sha256:${"b".repeat(64)}`,
  agentExecutionRefHash: `sha256:${"c".repeat(64)}`,
  writerLeaseEpoch: 1,
  writerFenceHash: `sha256:${"d".repeat(64)}`,
  target: { targetRef: "target:1", authorityEpoch: 1, executionBindingHash: `sha256:${"a".repeat(64)}` },
  get document() {
    return { documentRef: state.documentRef, targetRef: "target:1", navigationEpoch: state.navigationEpoch };
  },
  async runAtomicStep(identity, action) {
    state.atomicIdentity = identity;
    try { return await action(); } finally { state.atomicIdentity = null; }
  },
  readAtomicStepOutcome: (identity) =>
    (options.exposeInitialRecoveryOutsideAtomic && state.atomicIdentity === null)
      || JSON.stringify(identity) === JSON.stringify(state.atomicIdentity)
      ? state.recovery : null,
  executeDomIntent: async (intent: BrowserDomIntent) => {
    if (intent.kind !== "selectExactGptConversation") {
      return executeFakeDomIntent(responder, state, intent, options);
    }
    if (state.url !== intent.canonicalConversationUrl) {
      state.physicalMutations += 1;
      state.url = intent.canonicalConversationUrl;
      state.navigationEpoch += 1;
      state.documentRef = `document:${state.navigationEpoch}`;
    }
    return { documentRef: state.documentRef, targetRef: "target:1", navigationEpoch: state.navigationEpoch };
  },
  async observeCapability() { return {}; },
  async captureScreenshot() { return { artifactRef: "screenshot:1", contentHash: `sha256:${"e".repeat(64)}` }; },
  async attachFile(input) {
    options.onAttachFile?.(input);
    state.physicalMutations += 1;
    markConfirmedMutation(state);
  },
  async readAuthenticatedMedia(_input) {
    state.authenticatedMediaDownloads += 1;
    if (!options.authenticatedMedia) throw new Error("FIXTURE_AUTHENTICATED_MEDIA_MISSING");
    return options.authenticatedMedia;
  },
  async wait(input) {
    state.waitDurations.push(input.durationMs);
    options.onWait?.(input.durationMs);
    const advance = options.navigationEpochAdvanceOnWait ?? 0;
    if (advance > 0) {
      state.navigationEpoch += advance;
      state.documentRef = `document:${state.navigationEpoch}`;
    }
  },
  async park() { state.physicalMutations += 1; },
  async resolvePendingMutation() {
    if (state.pending !== 1) throw new Error("BROWSER_MUTATION_UNSETTLED");
    state.pending = 0;
    return 1;
  },
  pendingMutationCount: () => state.pending,
});

export const fakeBrowser = (responder: DomResponder, input: FakeBrowserOptions = {}) => {
  const state: FakeBrowserState = {
    pending: input.initialPending ?? 0,
    documentRef: "document:1",
    navigationEpoch: 1,
    url: input.initialUrl ?? "https://chatgpt.com/",
    domCalls: 0,
    physicalMutations: 0,
    authenticatedMediaDownloads: 0,
    waitDurations: [],
    atomicIdentity: null,
    recovery: input.initialRecovery ?? null,
  };
  return {
    browser: createFakeBrowserLease(responder, state, input),
    normalReacquire: () => {
      state.navigationEpoch += 1;
      state.documentRef = `document:${state.navigationEpoch}`;
    },
    physicalMutations: () => state.physicalMutations,
    authenticatedMediaDownloads: () => state.authenticatedMediaDownloads,
    documentCalls: () => state.domCalls,
    waitDurations: () => [...state.waitDurations],
  };
};
