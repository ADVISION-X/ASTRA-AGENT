import { createHash } from "node:crypto";

import type {
  BrowserAtomicStepIdentity,
  BrowserAtomicStepRecovery,
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
  assistantTurnId: string,
  semanticText: string,
  rawDomHtml = `<article data-testid="${assistantTurnId}" data-turn="assistant">${semanticText}</article>`,
) => Object.freeze({
  schemaVersion: "grasseye.browser.exact-assistant-turn.v1" as const,
  exactCallIdentityHash: `sha256:${"5".repeat(64)}` as `sha256:${string}`,
  targetRefHash: `sha256:${"2".repeat(64)}` as `sha256:${string}`,
  documentRefHash: `sha256:${"3".repeat(64)}` as `sha256:${string}`,
  assistantTurnId,
  rawDomHtml,
  rawDomHash: hashText(rawDomHtml),
  semanticText,
  semanticTextHash: hashText(semanticText),
  observedAt: "2026-09-02T00:00:00.000Z",
});

export const EXPECTED_GPT_CHILD_IDS = Object.freeze([
  "acquire_gpt_continuation_lane", "advance_gpt_continuation_lane",
  "attach_approved_gpt_files_once", "checkpoint_gpt_generated_image",
  "complete_exact_gpt_continuation_reservation_once",
  "checkpoint_gpt_text_response", "close_gpt_execution_profile",
  "ensure_exact_gpt_reasoning_tier",
  "focus_exact_gpt_conversation", "fork_exact_gpt_conversation_at_checkpoint", "open_gpt_attachment_control",
  "open_gpt_checkpoint_actions_menu",
  "open_gpt_execution_profile", "open_gpt_model_selector_v2",
  "persist_gpt_continuation", "prepare_clean_gpt_chat", "reserve_exact_gpt_continuation_once",
  "reconcile_gpt_attachment_set", "reconcile_gpt_draft", "reconcile_gpt_turn_submission",
  "release_gpt_continuation_lane", "select_exact_gpt_model_v2", "submit_exact_gpt_turn_once",
  "verify_gpt_conversation_identity", "wait_for_stable_gpt_image",
  "wait_for_stable_gpt_text", "write_exact_gpt_prompt",
].sort());

type DomResponder = (intent: BrowserDomIntent, callNumber: number) => unknown | Promise<unknown>;
type FakeBrowserOptions = Readonly<{
  initialPending?: number;
  initialUrl?: string;
  authenticatedMedia?: Awaited<ReturnType<BrowserTargetLease["downloadAuthenticatedMedia"]>>;
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
  recovery: BrowserAtomicStepRecovery | null;
};

const markConfirmedMutation = (
  state: FakeBrowserState,
  mutationOutcome: "no" | "confirmed" = "confirmed",
): void => {
  if (!state.atomicIdentity) return;
  state.recovery = Object.freeze({
    state: "confirmed",
    mutationOutcome,
    terminalAt: "2026-09-02T00:00:01.000Z",
    failureCode: null,
    nativeFailureCode: null,
    authorityRef: `browser-mutation:${state.atomicIdentity.callId}`,
    authorityHash: `sha256:${"9".repeat(64)}`,
    targetRef: "target:1",
    documentRef: state.documentRef,
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
    terminalAt: "2026-09-02T00:00:01.000Z",
    failureCode,
    nativeFailureCode,
    authorityRef: `browser-mutation:${state.atomicIdentity.callId}`,
    authorityHash: `sha256:${"9".repeat(64)}`,
    targetRef: "target:1",
    documentRef: state.documentRef,
  });
};

const markDispatchedMutation = (state: FakeBrowserState): void => {
  if (!state.atomicIdentity) return;
  state.recovery = Object.freeze({
    state: "dispatched",
    mutationOutcome: "dispatched",
    terminalAt: null,
    failureCode: null,
    nativeFailureCode: null,
    authorityRef: `browser-mutation:${state.atomicIdentity.callId}`,
    authorityHash: `sha256:${"9".repeat(64)}`,
    targetRef: "target:1",
    documentRef: state.documentRef,
  });
};

const executeFakeDomIntent = async (
  responder: DomResponder,
  state: FakeBrowserState,
  intent: BrowserDomIntent,
): Promise<unknown> => {
  state.domCalls += 1;
  const mutates = ["click", "hover", "doubleClick", "keypress", "fill"].includes(intent.kind);
  const value = await responder(intent, state.domCalls);
  if (mutates) {
    const result = value && typeof value === "object" && !Array.isArray(value) ? value : null;
    const declaredMutationCount = result ? Reflect.get(result, "mutationCount") : undefined;
    const mutationCount = Number.isSafeInteger(declaredMutationCount) ? Number(declaredMutationCount) : 1;
    state.physicalMutations += mutationCount;
    const mutationOutcome = mutationCount === 0 ? "no" as const : "confirmed" as const;
    if (result && Reflect.get(result, "terminalRejectedDispatched") === true) {
      const failureCode = typeof Reflect.get(result, "failureCode") === "string"
        ? String(Reflect.get(result, "failureCode")) : "BROWSER_CAPABILITY_REJECTED";
      const nativeCauseCode = typeof Reflect.get(result, "nativeCauseCode") === "string"
        ? String(Reflect.get(result, "nativeCauseCode")) : null;
      markRejectedMutation(state, "dispatched", failureCode, nativeCauseCode);
      const cause = nativeCauseCode
        ? Object.assign(new Error(nativeCauseCode), { code: nativeCauseCode }) : undefined;
      throw browserExecutionFailure(new Error(failureCode, { ...(cause ? { cause } : {}) }), "dispatched", {
        effectScope: state.atomicIdentity?.replayPolicy === "provider-effect-once"
          ? "provider_effect" : "target_local",
        childCapabilityId: state.atomicIdentity?.childCapabilityId ?? "unknown",
        browserOutcome: "REJECTED",
      });
    }
    if (result && Reflect.get(result, "receiptMissing") === true) {
      markDispatchedMutation(state);
      throw browserExecutionFailure(new Error("BROWSER_COMMAND_RECEIPT_MISSING"), "dispatched", {
        effectScope: state.atomicIdentity?.replayPolicy === "provider-effect-once"
          ? "provider_effect" : "target_local",
        childCapabilityId: state.atomicIdentity?.childCapabilityId ?? "unknown",
        browserOutcome: "DISPATCHED",
      });
    }
    if (result && Reflect.get(result, "postconditionVerified") === false) {
      const failureCode = typeof Reflect.get(result, "failureCode") === "string"
        ? String(Reflect.get(result, "failureCode")) : "BROWSER_POSTCONDITION_FAILED";
      const nativeCauseCode = typeof Reflect.get(result, "nativeCauseCode") === "string"
        ? String(Reflect.get(result, "nativeCauseCode")) : null;
      markRejectedMutation(state, mutationOutcome, failureCode, nativeCauseCode);
      const cause = nativeCauseCode
        ? Object.assign(new Error(nativeCauseCode), { code: nativeCauseCode }) : undefined;
      throw browserExecutionFailure(new Error(failureCode, { ...(cause ? { cause } : {}) }), mutationOutcome, {
        effectScope: state.atomicIdentity?.replayPolicy === "provider-effect-once"
          ? "provider_effect" : "target_local",
        childCapabilityId: state.atomicIdentity?.childCapabilityId ?? "unknown",
        browserOutcome: "REJECTED",
      });
    }
    markConfirmedMutation(state, mutationOutcome);
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
  readAtomicStepRecovery: () => state.recovery,
  requiresMutationRecovery: () => state.pending > 0,
  async navigate(navigation: Readonly<{ url: string }>) {
    state.physicalMutations += 1;
    state.url = navigation.url;
    state.navigationEpoch += 1;
    state.documentRef = `document:${state.navigationEpoch}`;
    markConfirmedMutation(state);
    return { documentRef: state.documentRef, targetRef: "target:1", navigationEpoch: state.navigationEpoch };
  },
  executeDomIntent: (intent: BrowserDomIntent) => executeFakeDomIntent(responder, state, intent),
  async observeCapability() { return {}; },
  async captureScreenshot() { return { artifactRef: "screenshot:1", contentHash: `sha256:${"e".repeat(64)}` }; },
  async attachFile(input) {
    options.onAttachFile?.(input);
    state.physicalMutations += 1;
    markConfirmedMutation(state);
  },
  async downloadAuthenticatedMedia() {
    state.authenticatedMediaDownloads += 1;
    if (!options.authenticatedMedia) throw new Error("FIXTURE_AUTHENTICATED_MEDIA_MISSING");
    return options.authenticatedMedia;
  },
  async wait(input) {
    state.waitDurations.push(input.durationMs);
    options.onWait?.(input.durationMs);
  },
  async park() { state.physicalMutations += 1; },
  async close() { state.physicalMutations += 1; },
  async resolvePendingMutation() {
    if (state.pending !== 1) throw new Error("BROWSER_MUTATION_UNSETTLED");
    state.pending = 0;
    return 1;
  },
  pendingMutationCount: () => state.pending,
  assertNoPendingMutations() {
    if (state.pending !== 0) throw new Error("BROWSER_MUTATION_UNSETTLED");
  },
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
    recovery: null,
  };
  return {
    browser: createFakeBrowserLease(responder, state, input),
    physicalMutations: () => state.physicalMutations,
    authenticatedMediaDownloads: () => state.authenticatedMediaDownloads,
    documentCalls: () => state.domCalls,
    waitDurations: () => [...state.waitDurations],
  };
};
