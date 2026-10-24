import { createHash } from "node:crypto";
import type { BrowserAtomicStepIdentity, BrowserAtomicStepOutcome, BrowserDomIntent, BrowserDomObservationQuery, BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import { browserExecutionFailure, browserExactCallIdentityHash } from "../../../lib/browser/browser-authority-api.js";

const digest = (text: string): `sha256:${string}` => `sha256:${createHash("sha256").update(text).digest("hex")}`;
const fixtureHash = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;
type Fact = Readonly<{ scopeRawCount?: number; scopeEligibleCount?: number; rawCount: number; eligibleCount: number;
  matches?: readonly Readonly<Record<string, unknown>>[]; scopeRejections?: readonly Readonly<{ index: number; reasons: readonly string[] }>[];
  rejections?: readonly Readonly<{ index: number; reasons: readonly string[] }>[]; nativeCauseCode?: "NO_LAYOUT_BOX" | null; nativeCauseCount?: number }>;
export const coherentObservationPacket = (intent: Readonly<{ queries: readonly BrowserDomObservationQuery[] }>, facts: Readonly<Record<string, Fact>>, currentUrl = "https://chatgpt.com/") => ({
  schemaVersion: "grasseye.browser.dom-observation.v2" as const, exactCallIdentityHash: fixtureHash("1"), targetRefHash: fixtureHash("2"), documentRefHash: fixtureHash("3"),
  currentUrl, observationRevisionHash: fixtureHash("4"), observedAt: "2026-09-02T00:00:00.000Z",
  queries: intent.queries.map(query => {
    const row = facts[query.queryId] ?? { rawCount: 0, eligibleCount: 0 };
    return { queryId: query.queryId, scopeRawCount: row.scopeRawCount ?? (query.scope ? 1 : 0), scopeEligibleCount: row.scopeEligibleCount ?? (query.scope ? 1 : 0),
      rawCount: row.rawCount, eligibleCount: row.eligibleCount, matches: [...(row.matches ?? [])], scopeRejections: [...(row.scopeRejections ?? [])], rejections: [...(row.rejections ?? [])],
      nativeCauseCode: row.nativeCauseCode ?? null, nativeCauseCount: row.nativeCauseCount ?? 0, nativeStage: "runtime-call-function-on" as const };
  }),
});
export const exactAssistantTurnReply = (intent: Extract<BrowserDomIntent, { kind: "readExactAssistantTurn" }>, semanticText: string,
  rawDomHtml = `<div data-markdown-text-style="assistant-message">${semanticText}</div>`) => ({
  schemaVersion: "grasseye.browser.exact-assistant-turn.v4" as const, exactCallIdentityHash: fixtureHash("5"), targetRefHash: fixtureHash("2"), documentRefHash: fixtureHash("3"),
  observationRevisionHash: fixtureHash("6"), assistantTurnId: "00000000-0000-4000-8000-000000000004", currentUrl: intent.canonicalConversationUrl,
  precedingUserTurnId: "00000000-0000-4000-8000-000000000003", generatingRaw: 0, rawDomHtml, rawDomHash: digest(rawDomHtml),
  semanticText, semanticTextHash: digest(semanticText), observedAt: "2026-09-02T00:00:00.000Z",
});
export const EXPECTED_GPT_CHILD_IDS = Object.freeze(["acknowledge_known_gpt_rate_limit", "attach_approved_gpt_files_once", "checkpoint_gpt_generated_image",
  "checkpoint_gpt_text_response", "close_gpt_execution_profile", "open_gpt_attachment_control", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "get_submitted_gpt_conversation_url", "prepare_clean_gpt_chat", "reconcile_gpt_attachment_set", "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3", "submit_exact_gpt_turn_once", "write_exact_gpt_prompt"].sort());
type Options = Readonly<{ initialPending?: number; initialRecovery?: BrowserAtomicStepOutcome; initialRecoveryIdentity?: BrowserAtomicStepIdentity; exposeInitialRecoveryOutsideAtomic?: boolean;
  initialUrl?: string; navigationEpochAdvanceOnMutation?: number; navigationEpochAdvanceOnWait?: number;
  authenticatedMedia?: Awaited<ReturnType<BrowserTargetLease["readAuthenticatedMedia"]>>;
  onAttachFile?: (input: Parameters<BrowserTargetLease["attachFile"]>[0]) => void; onWait?: (durationMs: number) => void; enforceClickedAttributeReadback?: boolean }>;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const same = (left: BrowserAtomicStepIdentity, right: BrowserAtomicStepIdentity): boolean =>
  ["resultRevision", "productStepId", "callId", "childCapabilityId", "inputHash", "actionOrdinal", "replayPolicy"]
    .every(key => left[key as keyof BrowserAtomicStepIdentity] === right[key as keyof BrowserAtomicStepIdentity]);

const withConfirmedSubmitProof = (active: BrowserAtomicStepIdentity, next: BrowserAtomicStepOutcome,
  observation: unknown): BrowserAtomicStepOutcome => {
  if (active.childCapabilityId !== "submit_exact_gpt_turn_once" || next.state !== "confirmed") return next;
  const packet = record(observation), query = record((packet.queries as unknown[] | undefined)?.[0]);
  const message = record((query.matches as unknown[] | undefined)?.[0]);
  return { ...next, terminalPayload: { schemaVersion: "grasseye.browser.confirmed-submit-proof.v2",
    promptHash: message.exactGptUserPromptHash, userTurnId: message.turnKey,
    exactCallIdentityHash: browserExactCallIdentityHash({ jobId: "job:gpt-exact-target", attemptId: "attempt:gpt-exact-target",
      writerFenceHash: fixtureHash("d"), ...active }), observationRevisionHash: packet.observationRevisionHash,
    targetRefHash: packet.targetRefHash, documentRefHash: packet.documentRefHash,
    rawCount: query.rawCount, eligibleCount: query.eligibleCount } };
};

const throwFixtureTerminalFailure = (active: BrowserAtomicStepIdentity, next: BrowserAtomicStepOutcome): void => {
    if (next.failureCode) throw browserExecutionFailure(new Error(next.failureCode, {
      ...(next.nativeFailureCode ? { cause: Object.assign(new Error(next.nativeFailureCode), { code: next.nativeFailureCode }) } : {}) }), next.mutationOutcome, {
      effectScope: active.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local", childCapabilityId: active.childCapabilityId,
      browserOutcome: next.state === "dispatched" ? "DISPATCHED" : "REJECTED", providerEffectIdentityHash: next.providerEffectIdentityHash });
};

export const fakeBrowser = (respond: (intent: BrowserDomIntent, callNumber: number) => unknown | Promise<unknown>, options: Options = {}) => {
  let active: BrowserAtomicStepIdentity | null = null, origin: BrowserAtomicStepIdentity | null = options.initialRecoveryIdentity ?? null;
  let outcome = options.initialRecovery ?? null, epoch = 1, url = options.initialUrl ?? "https://chatgpt.com/", inputs = 0, reads = 0, downloads = 0;
  if (!!options.initialRecovery !== !!options.initialRecoveryIdentity) throw new Error("FIXTURE_ORIGINAL_ATOMIC_IDENTITY_REQUIRED");
  const waits: number[] = [];
  const settle = (value: unknown): void => {
    if (!active) throw new Error("FIXTURE_MUTATION_OUTSIDE_ATOMIC_CALL");
    const row = record(value), declared = row.mutationCount ?? 1;
    if (![0, 1, 2, 3, 4].includes(declared as number)) throw new Error("FIXTURE_PHYSICAL_INPUT_COUNT_INVALID");
    const count = declared as 0 | 1 | 2 | 3 | 4;
    inputs += count;
    const missing = row.receiptMissing === true, rejected = row.postconditionVerified === false || row.terminalRejectedDispatched === true;
    const state = missing ? "dispatched" : rejected ? "rejected" : "confirmed";
    const mutationOutcome = missing || row.terminalRejectedDispatched === true ? "dispatched" : count === 0 ? "no" : "confirmed";
    const failureCode = missing ? "BROWSER_COMMAND_RECEIPT_MISSING" : rejected ? typeof row.failureCode === "string" ? row.failureCode : "BROWSER_POSTCONDITION_FAILED" : null;
    const nativeFailureCode = typeof row.nativeCauseCode === "string" ? row.nativeCauseCode : null;
    const next = withConfirmedSubmitProof(active, { state, mutationOutcome, providerEffectIdentityHash: active.replayPolicy === "provider-effect-once" ? fixtureHash("8") : null,
      terminalAt: missing ? null : "2026-09-02T00:00:01.000Z", failureCode, nativeFailureCode, authorityRef: `browser-mutation:${active.callId}`,
      authorityHash: fixtureHash("9"), targetRef: "target:1", documentRef: `document:${epoch}`, physicalInputCount: count,
      downloadGuidHash: null, downloadCompleted: false, identityRevalidated: false }, row.postconditionObservation);
    origin = active; outcome = next;
    throwFixtureTerminalFailure(active, next);
  };
  const advance = (count: number): void => { epoch += Math.max(0, count); };
  const browser: BrowserTargetLease = {
    leaseRef: "lease:1", authorityRef: "authority:1", authorityEpoch: 1, executionBindingHash: fixtureHash("a"), ownerId: "gpt-acceptance",
    agentJobRefHash: digest("job:gpt-exact-target"), agentExecutionRefHash: digest("attempt:gpt-exact-target"), writerLeaseEpoch: 1, writerFenceHash: fixtureHash("d"),
    target: { targetRef: "target:1", authorityEpoch: 1, executionBindingHash: fixtureHash("a") },
    get document() { return { documentRef: `document:${epoch}`, targetRef: "target:1", navigationEpoch: epoch }; },
    async runAtomicStep(identity, action) {
      if (active) throw new Error("FIXTURE_OVERLAPPING_ATOMIC_CALL");
      active = identity; try { return await action(); } finally { active = null; }
    },
    readAtomicStepOutcome(identity) {
      if (!active && !options.exposeInitialRecoveryOutsideAtomic || active && !same(identity, active)) return null;
      return origin && same(identity, origin) ? outcome : null;
    },
    async readSubmittedConversationUrl() { throw new Error("FIXTURE_SUBMITTED_LOCATOR_REQUIRED"); },
    async executeDomIntent(intent) {
      reads += 1;
      if (intent.kind === "document") return { url, title: "ChatGPT" };
      if (intent.kind === "selectExactGptConversation") {
        if (url !== intent.canonicalConversationUrl) { inputs += 1; url = intent.canonicalConversationUrl; advance(1); }
        return { targetRef: "target:1", documentRef: `document:${epoch}`, navigationEpoch: epoch };
      }
      const value = await respond(intent, reads);
      if (["click", "hover", "doubleClick", "keypress", "fill", "acknowledgeKnownGptRateLimit"].includes(intent.kind)) {
        if (options.enforceClickedAttributeReadback && intent.kind === "click" && intent.postClickObservation?.clickedCandidateAttribute) {
          const required = intent.postClickObservation.clickedCandidateAttribute, actual = record(record(value).clickedCandidateAttributeReadback);
          if (actual.name !== required.name || actual.value !== required.equals || actual.verified !== true)
            settle({ mutationCount: record(value).mutationCount ?? 1, terminalRejectedDispatched: true,
              failureCode: "BROWSER_AUTH_TRANSCRIPT_INVALID" });
        }
        settle(value); advance(options.navigationEpochAdvanceOnMutation ?? 0);
      }
      return value;
    },
    async attachFile(input) { options.onAttachFile?.(input); settle({ mutationCount: 1, postconditionVerified: true }); },
    async readAuthenticatedMedia() { downloads += 1; if (!options.authenticatedMedia) throw new Error("FIXTURE_AUTHENTICATED_MEDIA_REQUIRED"); return options.authenticatedMedia; },
    async awaitTransientDomConfirmation(input) {
      const duration = input.stage === 1 ? 1500 : 3000; waits.push(duration); options.onWait?.(duration);
      if (input.signal?.aborted) throw new Error("BROWSER_COMMAND_ABORTED"); advance(options.navigationEpochAdvanceOnWait ?? 0);
    },
    async wait(input) { waits.push(input.durationMs); options.onWait?.(input.durationMs); advance(options.navigationEpochAdvanceOnWait ?? 0); },
    async observeCapability() { return {}; },
    async captureScreenshot() { return { artifactRef: "screenshot:1", contentHash: fixtureHash("e") }; },
    async park() {}, pendingMutationCount: () => options.initialPending ?? 0,
  };
  return { browser, normalReacquire: () => advance(1), physicalMutations: () => inputs, authenticatedMediaDownloads: () => downloads,
    documentCalls: () => reads, waitDurations: () => [...waits] };
};
