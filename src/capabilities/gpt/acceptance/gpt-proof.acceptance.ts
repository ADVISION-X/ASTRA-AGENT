import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { executionFailure } from "../../../lib/execution-failure.js";
import { browserExactCallIdentityHash, type BrowserAtomicStepOutcome } from "../../../lib/browser/browser-authority-api.js";
import { buildGptExecutionProfile } from "../index.js";
import { failedGptChildExecutionResult } from "../ability-group.js";
import { executeProductionGptAtomicCall, productionGptAtomicIdentity } from "../production-atomic-call.js";
import type { ProductionGptBrowserCall } from "../production-browser-lifecycle.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { conversationUrl, promptHash } from "./gpt-conversation-fixture.js";
import { verifyStoppedEmptyRecoveryContract } from "./gpt-stopped-empty.acceptance-support.js";
import { verifyGeneratedImageEvidenceBoundary } from "./gpt-generated-image-evidence.acceptance-support.js";
import { verifySubmitProofs } from "./gpt-proof-submit.acceptance-support.js";
import { verifyKnownRateLimitClosure } from "./gpt-rate-limit-closure.acceptance-support.js";
import { coherentObservationPacket, exactAssistantTurnReply, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";

const hash = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;
const profile = buildGptExecutionProfile({ profileRef: "acceptance:proof-profile", startModelDisplayName: "GPT-5.6 Sol",
  requestedReasoningValue: 5, executorIdentityRef: "acceptance:executor", acceptanceRef: "acceptance:gpt-proof", acceptanceVersion: "v1" });
const modelFacts = (open: boolean) => ({ "openable-entry": { rawCount: open ? 0 : 1, eligibleCount: open ? 0 : 1 },
  "specified-model": { rawCount: 2, eligibleCount: open ? 1 : 0 } });
verifyStoppedEmptyRecoveryContract();
const stable = async () => {
  const fixture = fakeBrowser(intent => {
    if (intent.kind !== "observe") throw new Error("DONE_MUST_NOT_ACT");
    return coherentObservationPacket(intent, modelFacts(true));
  });
  const result = await createGptAcceptanceHarness("gpt-proof-stable").execute("open_gpt_model_selector_v3", fixture.browser, { profile });
  assert.equal(result.status, "success"); assert.equal(result.proof.internalDecisionCode, "DONE");
  assert.deepEqual(result.proof.candidateCardinality, { raw: 2, eligible: 1 }); assert.equal(result.proof.observationRevisionHash, hash("4"));
  assert.equal(result.proof.committedMutation, "no"); assert.equal(result.proof.browserFact, null); assert.equal(fixture.physicalMutations(), 0);
  return result.proof.evidenceHash;
};
assert.equal(await stable(), await stable(), "same exact call and facts have one stable proof hash");
for (const count of [0, 1] as const) {
  let open = false;
  const fixture = fakeBrowser(intent => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(open));
    if (intent.kind !== "click") throw new Error("MODEL_ENTRY_MUST_CLICK_ONCE");
    open = true;
    return { mutationCount: count, postconditionVerified: true, zeroActionSatisfied: count === 0, postconditionRawCount: 2, postconditionEligibleCount: 1 };
  });
  const result = await createGptAcceptanceHarness(`gpt-proof-action-${count}`).execute("open_gpt_model_selector_v3", fixture.browser, { profile });
  assert.equal(result.status, "success", result.failureCode ?? "action proof");
  assert.equal(result.proof.internalDecisionCode, count === 0 ? "DONE" : "ACT");
  assert.equal(result.proof.committedMutation, count === 0 ? "no" : "confirmed");
  assert.equal(result.proof.browserFact?.browserOutcome, "CONFIRMED"); assert.equal(result.proof.browserFact?.mutationOutcome, count === 0 ? "no" : "confirmed");
  assert.equal(result.proof.browserFact?.childCapabilityId, "open_gpt_model_selector_v3"); assert.equal(result.proof.browserFact?.evidenceHash, hash("9"));
  assert.equal(fixture.physicalMutations(), count); assert.equal(JSON.stringify(result.proof).includes(profile.startModelDisplayName), false);
}
{
  const intent = createGptAcceptanceHarness("gpt-proof-mismatch").buildIntent("open_gpt_model_selector_v3", { profile });
  const result = await failedGptChildExecutionResult({ intent, context: { dataDir: "/tmp/gpt-dialog-mismatch" }, startedAt: "2026-09-21T00:00:00.000Z",
    error: executionFailure("failed", "BROWSER_GPT_DIALOG_UNRECOGNIZED", { metadata: { mutationOutcome: "no",
      evidence: { evidenceRef: "browser-gpt-dialog-unrecognized|2026-09-21T00:00:00.000Z", evidenceHash: hash("d") } } }) });
  assert.equal(result.failureCode, "BROWSER_GPT_DIALOG_UNRECOGNIZED"); assert.equal(result.proof.browserFact, null); assert.equal(result.proof.committedMutation, "no");
}
await verifyKnownRateLimitClosure(profile); await verifySubmitProofs(); await verifyGeneratedImageEvidenceBoundary();

const acknowledgement = (digit: string) => ({ incidentRequestId: `aipcooldown_${digit.repeat(40)}`,
  dialogHash: "sha256:084b621b91e3affcf2199269157febb07ded1b7a3287ac61104108317cddde15" as const,
  observationHash: hash("5"), targetRefHash: hash("6"), documentRefHash: hash("7"), observedAt: new Date(Date.now() - 5_000).toISOString() });
const browserCall = (browser: ReturnType<typeof fakeBrowser>["browser"]): ProductionGptBrowserCall => ({ browser, facade: browser,
  providerWaitLog: null, confirmedProviderEffect: null, settledResultPayloadHash: null, recoverySelectionRequired: false });
const outcome = (state: BrowserAtomicStepOutcome["state"], provider: boolean, terminalPayload?: Readonly<Record<string, unknown>>): BrowserAtomicStepOutcome => ({
  state, mutationOutcome: state === "confirmed" ? "confirmed" : state === "rejected" ? "no" : "dispatched",
  providerEffectIdentityHash: provider ? hash("8") : null, terminalAt: state === "dispatched" ? null : new Date().toISOString(),
  failureCode: state === "rejected" ? "BROWSER_RATE_LIMIT_ACK_REJECTED" : null, nativeFailureCode: null,
  authorityRef: "browser-mutation:original", authorityHash: hash("9"), targetRef: "target:original", documentRef: "document:original",
  physicalInputCount: state === "confirmed" ? 1 : 0, downloadGuidHash: null, downloadCompleted: false, identityRevalidated: true,
  ...(terminalPayload ? { terminalPayload } : {}) });
for (const state of ["rejected", "dispatched", "confirmed"] as const) {
  const harness = createGptAcceptanceHarness(`gpt-proof-original-ack-${state}`), input = acknowledgement(state === "rejected" ? "3" : state === "dispatched" ? "4" : "1");
  const intent = harness.buildIntent("acknowledge_known_gpt_rate_limit", input), identity = productionGptAtomicIdentity(intent, 0);
  const payload = { clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1, postconditionVerified: true };
  const fixture = fakeBrowser(command => {
    assert.equal(command.kind, "readKnownGptRateLimitClearance"); assert.notEqual(state, "confirmed");
    return { schemaVersion: "grasseye.browser.known-gpt-rate-limit-clearance.v1", state: "confirmed_absent", dialogHash: input.dialogHash,
      targetRefHash: input.targetRefHash, documentRefHash: input.documentRefHash, observationHash: hash("9"), observedAt: new Date().toISOString(),
      candidateCount: 0, identityRevalidated: true, mutationCount: 0, postconditionVerified: true, zeroActionSatisfied: true };
  }, { initialRecovery: outcome(state, false, state === "confirmed" ? payload : undefined), initialRecoveryIdentity: identity, exposeInitialRecoveryOutsideAtomic: true });
  const result = await executeProductionGptAtomicCall({ dataDir: "/tmp/gpt-exact-target", gpt: harness.gpt, browsers: {} as never,
    intent, browserCall: browserCall(fixture.browser), signal: new AbortController().signal, resultRevision: 0 });
  assert.equal(result.status, "success", result.failureCode ?? state); assert.equal(Reflect.get(result.value!, "clearance"), "confirmed_absent");
  assert.equal(result.proof.committedMutation, state === "confirmed" ? "confirmed" : "no"); assert.equal(fixture.physicalMutations(), 0);
  assert.equal(fixture.documentCalls(), state === "confirmed" ? 0 : 1);
}
{
  const fixture = fakeBrowser(command => {
    assert.equal(command.kind, "acknowledgeKnownGptRateLimit");
    return { candidateCount: 0, identityRevalidated: true, mutationCount: 0, postconditionVerified: true, zeroActionSatisfied: true };
  });
  const result = await createGptAcceptanceHarness("gpt-proof-absent-ack").execute("acknowledge_known_gpt_rate_limit", fixture.browser, acknowledgement("2"));
  assert.equal(result.status, "success"); assert.equal(result.value?.clearance, "confirmed_absent"); assert.equal(fixture.physicalMutations(), 0);
}
for (const temporary of [false, true]) {
  const harness = createGptAcceptanceHarness(`gpt-proof-original-submit-${temporary}`), intent = harness.buildIntent("submit_exact_gpt_turn_once", { files: [], promptHash });
  const identity = productionGptAtomicIdentity(intent, 0);
  const payload = { canonicalConversationUrl: temporary ? "https://chatgpt.com/c/WEB:temporary-client-route" : conversationUrl,
    promptHash, userTurnId: "00000000-0000-4000-8000-000000000003", exactCallIdentityHash: browserExactCallIdentityHash({
      jobId: intent.jobId, attemptId: intent.attemptId, writerFenceHash: hash("d"), ...identity }), observationRevisionHash: hash("2"),
    targetRefHash: hash("3"), documentRefHash: hash("4"), rawCount: 1, eligibleCount: 1 };
  const prior = outcome("confirmed", true, payload);
  const fixture = fakeBrowser(command => { throw new Error(`RECOVERY_MUST_NOT_TOUCH_PROVIDER:${command.kind}`); },
    { initialRecovery: prior, initialRecoveryIdentity: identity, exposeInitialRecoveryOutsideAtomic: true, initialUrl: conversationUrl });
  const result = await executeProductionGptAtomicCall({ dataDir: "/tmp/gpt-exact-target", gpt: harness.gpt, browsers: {} as never,
    intent, browserCall: browserCall(fixture.browser), signal: new AbortController().signal, resultRevision: 0 });
  assert.equal(result.status, temporary ? "failed" : "success");
  if (temporary) assert.equal(result.failureCode, "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  else { assert.equal(Reflect.get(result.value!, "userTurnId"), payload.userTurnId); assert.equal(result.proof.browserFact?.evidenceRef, prior.authorityRef); }
  assert.equal(fixture.physicalMutations(), 0); assert.equal(fixture.documentCalls(), 0);
}
for (const promptMatches of [true, false]) {
  const harness = createGptAcceptanceHarness(`gpt-proof-dispatched-${promptMatches}`), intent = harness.buildIntent("submit_exact_gpt_turn_once", { files: [], promptHash });
  const fixture = fakeBrowser(command => { throw new Error(`DISPATCHED_CANNOT_REPLAY:${command.kind}`); }, {
    initialRecovery: outcome("dispatched", true), initialRecoveryIdentity: productionGptAtomicIdentity(intent, 0), initialPending: 1, exposeInitialRecoveryOutsideAtomic: true });
  await assert.rejects(executeProductionGptAtomicCall({ dataDir: "/tmp/gpt-exact-target", gpt: harness.gpt, browsers: {} as never,
    intent, browserCall: browserCall(fixture.browser), signal: new AbortController().signal, resultRevision: 0 }), /GPT_ATOMIC_STEP_ALREADY_ATTEMPTED/u);
  assert.equal(fixture.physicalMutations(), 0); assert.equal(fixture.documentCalls(), 0);
}

for (const wrongUrl of [false, true]) {
  const reasons: string[] = [], fixture = fakeBrowser(command => {
    if (command.kind !== "readExactAssistantTurn") throw new Error("CHECKPOINT_MUST_USE_EXACT_RAW_CHANNEL");
    assert.equal(command.turnMarker, "exact");
    const packet = exactAssistantTurnReply(command, "exact response");
    return wrongUrl ? { ...packet, currentUrl: "https://chatgpt.com/c/another-conversation" } : packet;
  }, { initialUrl: conversationUrl });
  const result = await createGptAcceptanceHarness(`gpt-proof-exact-${wrongUrl}`).execute("checkpoint_gpt_text_response", fixture.browser, {
    canonicalConversationUrl: conversationUrl, probeBudgetMs: 200_000, userTurnId: "00000000-0000-4000-8000-000000000001", turnMarker: "exact" }, {
    waitForProviderObservation: async (_deadline, reason) => { reasons.push(reason); return "reobserve"; } });
  assert.deepEqual(reasons, ["initial-observation"]); assert.equal(fixture.physicalMutations(), 0);
  if (wrongUrl) assert.equal(result.failureCode, "GPT_EXACT_ASSISTANT_TURN_RESULT_INVALID");
  else { assert.equal(result.value?.semanticText, "exact response"); assert.equal(result.value?.assistantTurnId, "00000000-0000-4000-8000-000000000004"); assert.ok(result.value?.rawDomHtml); }
}
{
  let reads = 0;
  const reasons: string[] = [], fixture = fakeBrowser(command => {
    if (command.kind !== "readExactAssistantTurn") throw new Error("LONG_RESPONSE_CANNOT_CHANGE_CHANNEL");
    reads += 1;
    return { ...exactAssistantTurnReply(command, reads === 1 ? "partial" : "complete"), generatingRaw: reads === 1 ? 1 : 0 };
  });
  const result = await createGptAcceptanceHarness("gpt-proof-stop-beyond-budget").execute("checkpoint_gpt_text_response", fixture.browser, {
    canonicalConversationUrl: conversationUrl, probeBudgetMs: 1, userTurnId: "00000000-0000-4000-8000-000000000003", turnMarker: "exact" }, {
    waitForProviderObservation: async (_deadline, reason) => { reasons.push(reason); if (reasons.length === 1) await new Promise(resolve => setTimeout(resolve, 5));
      return reasons.length === 2 ? "deadline" : "reobserve"; } });
  assert.equal(result.status, "success", result.failureCode ?? "long response"); assert.equal(result.value?.semanticText, "complete");
  assert.deepEqual(reasons, ["initial-observation", "stop-present", "stop-present"]); assert.equal(reads, 2);
}
{
  let reads = 0;
  const reasons: string[] = [], fixture = fakeBrowser(command => {
    if (command.kind !== "readExactAssistantTurn") throw new Error("WAIT_REASONS_CANNOT_NAVIGATE");
    reads += 1;
    if (reads === 1) throw executionFailure("failed", "BROWSER_EXACT_USER_TURN_UNAVAILABLE");
    if (reads === 2) throw executionFailure("failed", "BROWSER_ADJACENT_ASSISTANT_TURN_MISSING");
    return exactAssistantTurnReply(command, reads === 3 ? "" : "complete");
  });
  const result = await createGptAcceptanceHarness("gpt-proof-wait-reasons").execute("checkpoint_gpt_text_response", fixture.browser, {
    canonicalConversationUrl: conversationUrl, probeBudgetMs: 200_000, userTurnId: "00000000-0000-4000-8000-000000000003", turnMarker: "exact" }, {
    waitForProviderObservation: async (_deadline, reason) => { reasons.push(reason); return "reobserve"; } });
  assert.equal(result.status, "success", result.failureCode ?? "wait reasons");
  assert.deepEqual(reasons, ["initial-observation", "exact-user-turn-unavailable", "adjacent-assistant-missing", "stopped-empty-confirming"]);
}
