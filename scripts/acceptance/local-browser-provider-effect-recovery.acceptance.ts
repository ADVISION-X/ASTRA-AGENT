import { verifySubmittedConversationLocator } from "./local-browser-mutation-store-support.js";
import { terminalFact } from "./local-browser-mutation-store-support.js";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { executionFailureMetadata } from "../../src/lib/execution-failure.js";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BrowserMutationStore,
} from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import type { BrowserMutationIdentity } from "../../src/lib/browser/exact-target/browser-mutation-types.js";
import { browserMutationPayloadKey, sealProviderRecoveryPayload } from
  "../../src/lib/browser/exact-target/browser-mutation-payload.js";
import { submitRecoveryPayload } from
  "../../src/lib/browser/exact-target/browser-submit-recovery-payload.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { verifyWalSchemaStartupRejections } from "./local-browser-mutation-store-support.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const withProviderIdentity = <T extends BrowserMutationIdentity>(input: T): T => ({ ...input,
  logicalMutationId: hash(JSON.stringify([input.jobId, input.resultRevision,
    input.productStepId, input.callId, input.childCapabilityId,
    input.requestHash, input.payloadHash])) });
const identity = (attemptId: string, revision = 0): BrowserMutationIdentity => withProviderIdentity({deliveryPriorityReplayGrantHash: null,
  commandId: `command:${attemptId}:${revision}`,
  logicalMutationId: hash(`provider-effect:${revision}`),
  exactCallIdentityHash: hash(`exact-call:${revision}`),
  jobId: "job:fresh-attempt",
  resultRevision: revision,
  attemptId,
  leaseVersion: attemptId === "attempt:1" ? 1 : 2,
  executionFenceHash: hash(`fence:${attemptId}`),
  productStepId: "provider-submit",
  callId: "turn-submit",
  childCapabilityId: "submit_exact_gpt_turn_once",
  effectScope: "provider_effect",
  actionOrdinal: 1,
  targetRef: `target:${attemptId}`,
  documentRef: `document:${attemptId}`,
  actionId: "browser.dom.click.v1",
  positivePostconditionHash: hash("positive"),
  negativePostconditionHash: hash("negative"),
  requestHash: hash(`request:${revision}`),
  payloadHash: hash(`payload:${revision}`),
});

const submitTerminalReply = (currentUrl: string) => ({ postconditionObservation: {
  currentUrl,
  exactCallIdentityHash: hash("exact-call"), observationRevisionHash: hash("observation"),
  targetRefHash: hash("target"), documentRefHash: hash("document"),
  queries: [{ rawCount: 1, eligibleCount: 1, matches: [{ turnKey: "00000000-0000-4000-8000-000000000001",
    exactGptUserPromptHash: hash("prompt") }] }],
} });

for (const url of ["https://chatgpt.com/c/durable-provider-route", "https://chatgpt.com/c/WEB:temporary-client-route"]) {
  const proof = submitRecoveryPayload(submitTerminalReply(url));
  assert.equal(proof.schemaVersion, "grasseye.browser.confirmed-submit-proof.v2");
  assert.equal("canonicalConversationUrl" in proof, false, "message confirmation must be independent of formal URL readiness");
}
const root = await mkdtemp(path.join(tmpdir(), "browser-attempt-fence-"));
try {
  verifyWalSchemaStartupRejections(root);
  await verifySubmittedConversationLocator(root);
  const store = new BrowserMutationStore(root);
  store.verifyRuntimeTaskProvenance(null);
  const schema = new Database(path.join(root, "browser", "browser-mutations.sqlite"), { readonly: true });
  const columns = (schema.prepare("pragma table_info(browser_mutations)").all() as Array<{ name: string }>)
    .map((column) => column.name);
  assert.equal(columns.includes("result_revision"), true);
  assert.equal(columns.includes("owner_plugin_id") || columns.includes("plugin_version"), false,
    "Browser WAL identity must not retain internal Product plugin fields");
  schema.close();
  const first = identity("attempt:1");
  const terminalPayload = {
    canonicalConversationUrl: "https://chatgpt.com/c/consultation-1",
    promptHash: hash("prompt"), userTurnId: "00000000-0000-4000-8000-000000000001",
    exactCallIdentityHash: first.exactCallIdentityHash,
    observationRevisionHash: hash("observation"),
    targetRefHash: hash(first.targetRef), documentRefHash: hash(first.documentRef),
    rawCount: 1, eligibleCount: 1,
  };
  const conversationUrl = (conversationId: string) =>
    new URL(`/c/${conversationId}`, terminalPayload.canonicalConversationUrl).href;
  store.prepare(first);
  store.markDispatched(first.commandId);
  store.settleTerminalReceipt(terminalFact(store.readCommand(first.commandId)!.identity, { terminal: "confirmed", resultHash: hash("terminal-proof"), mutationOutcome: "confirmed", submitRecoveryPayload: terminalPayload }));
  const anchorDatabase = new Database(path.join(root, "browser", "browser-mutations.sqlite"));
  const anchorBefore = store.jobHistoryEvidence(first.jobId).replayEffects[0]!.anchorProofHash;
  anchorDatabase.prepare("update browser_mutations set target_ref=?,document_ref=? where command_id=?")
    .run("target:replacement", "document:replacement", first.commandId);
  assert.equal(store.jobHistoryEvidence(first.jobId).replayEffects[0]!.anchorProofHash, anchorBefore,
    "V44 conversation anchor must not depend on historical Target or Document");
  anchorDatabase.prepare("update browser_mutations set target_ref=?,document_ref=? where command_id=?")
    .run(first.targetRef, first.documentRef, first.commandId);
  const sealedOriginal = anchorDatabase.prepare("select provider_recovery_payload from browser_mutations where command_id=?")
    .pluck().get(first.commandId) as string;
  const sealAnchor = (terminal: object) => sealProviderRecoveryPayload(
    browserMutationPayloadKey(root), first.commandId, { terminalPayload: terminal });
  anchorDatabase.prepare("update browser_mutations set provider_recovery_payload=? where command_id=?")
    .run(sealAnchor({ ...terminalPayload, promptHash: hash("different-prompt") }), first.commandId);
  assert.notEqual(store.jobHistoryEvidence(first.jobId).replayEffects[0]!.anchorProofHash, anchorBefore,
    "a changed prompt binding must change the V44 anchor proof");
  anchorDatabase.prepare("update browser_mutations set provider_recovery_payload=? where command_id=?")
    .run(sealAnchor({ ...terminalPayload, exactCallIdentityHash: hash("different-call") }), first.commandId);
  assert.throws(() => store.jobHistoryEvidence(first.jobId), /BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID/u,
    "a sealed anchor with the wrong exact call must fail closed");
  anchorDatabase.prepare("update browser_mutations set provider_recovery_payload=? where command_id=?")
    .run(sealedOriginal, first.commandId);
  anchorDatabase.close();
  const attachmentPreparation = (attemptId: string, generation: number): BrowserMutationIdentity => ({
    ...identity(attemptId), commandId: `attachment:${attemptId}`,
    logicalMutationId: hash(`attachment:${attemptId}:${generation}`),
    exactCallIdentityHash: hash(`attachment-call:${attemptId}:${generation}`),
    childCapabilityId: "attach_approved_gpt_files_once", effectScope: "target_local",
  });
  const firstAttachment = attachmentPreparation("attempt:1", 1);
  store.prepare(firstAttachment);
  store.markDispatched(firstAttachment.commandId);
  store.settleTerminalReceipt(terminalFact(store.readCommand(firstAttachment.commandId)!.identity, { terminal: "confirmed", resultHash: hash("attachment-1"), mutationOutcome: "confirmed" }));
  const secondAttachment = attachmentPreparation("attempt:2", 2);
  assert.doesNotThrow(() => store.prepare(secondAttachment),
    "a different attempt must receive its own target-local attachment preparation");
  assert.equal(store.readJobPhysicalInputState(first.jobId), "possible");
  assert.equal(store.readAttemptPhysicalInputState(first.jobId, secondAttachment.attemptId), "zero",
    "a rejected result in an older attempt must not become current attempt Provider input");
  assert.throws(() => store.prepare({ ...first, commandId: "command:attempt:1:again" }),
    /BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN|BROWSER_EXACT_CALL_REPLAY_FORBIDDEN/u,
    "one provider effect may dispatch only once inside an attempt");
  const second = identity("attempt:2");
  assert.equal(first.logicalMutationId, second.logicalMutationId);
  assert.throws(() => store.prepare(second),
    /BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN|BROWSER_EXACT_CALL_REPLAY_FORBIDDEN/u,
    "the same provider effect remains single-submit across attempts");
  assert.throws(() => store.prepare({
    ...second,
    commandId: "command:attempt:2:drift",
    logicalMutationId: hash("provider-effect:drift"),
    exactCallIdentityHash: hash("exact-call:drift"),
    requestHash: hash("request:drift"),
    payloadHash: hash("payload:drift"),
  }), /BROWSER_PROVIDER_EFFECT_IDENTITY_DRIFT/u,
  "one result revision cannot hide a second submit behind request or payload drift");
  const riskOld = withProviderIdentity({ ...identity("attempt:risk-old"), jobId: "job:risk-scope",
    commandId: "command:risk:old", exactCallIdentityHash: hash("risk-old-call") });
  store.prepare(riskOld);
  store.markDispatched(riskOld.commandId);
  store.settleTerminalReceipt(terminalFact(store.readCommand(riskOld.commandId)!.identity, { terminal: "confirmed", resultHash: hash("risk-old-proof"), mutationOutcome: "confirmed" }));
  const riskOldSecond = withProviderIdentity({ ...riskOld, commandId: "command:risk:old-second",
    productStepId: "provider-submit-second",
    exactCallIdentityHash: hash("risk-old-second-call") });
  store.prepare(riskOldSecond);
  store.markDispatched(riskOldSecond.commandId);
  store.settleTerminalReceipt(terminalFact(store.readCommand(riskOldSecond.commandId)!.identity, { terminal: "confirmed", resultHash: hash("risk-old-second-proof"), mutationOutcome: "confirmed" }));
  const replayCalls = store.jobHistoryEvidence(riskOld.jobId).replayCalls;
  assert.equal(replayCalls.length, 2,
    "the source must enumerate every old Provider call that may have received input");
  const replayCall = replayCalls[0];
  assert.ok(replayCall, "the WAL must name the exact old Provider call and effect set");
  const oldEffectSetHash = store.jobHistoryEvidence(riskOld.jobId).replayEffects
    .find((effect) => effect.effectIdentityHash === riskOld.logicalMutationId)?.sourceEffectSetHash;
  assert.ok(oldEffectSetHash);
  const risk = withProviderIdentity({ ...identity("attempt:risk-new", 1), jobId: riskOld.jobId,
    commandId: "command:risk:once",
    deliveryPriorityReplayGrantHash: hash("website-risk-grant"),
    deliveryPriorityReplayCall: replayCall });
  assert.throws(() => store.prepare({ ...risk, deliveryPriorityReplayCall: null }),
    /BROWSER_REPLAY_GRANT_INVALID/u,
    "a job-level grant hash without an exact old call must not allow Provider input");
  assert.throws(() => store.prepare({ ...risk, deliveryPriorityReplayCall: {
    ...replayCall, sourceEffectSetHash: hash("wrong-old-effect-set"),
  } }), /BROWSER_PROVIDER_EFFECT_OLD_INPUT_UNAUTHORIZED/u,
  "the risk grant must match the complete old Provider effect set");
  assert.doesNotThrow(() => store.prepare(risk),
    "one Website-scoped risk grant may prepare the designated new effect");
  assert.throws(() => store.prepare({ ...risk, commandId: "command:risk:second",
    exactCallIdentityHash: hash("risk-second-call") }), /BROWSER_REPLAY_GRANT_CONSUMED/u,
  "the same grant must not prepare a second Provider effect row");
  assert.throws(() => store.prepare({ ...risk, commandId: "command:risk:sibling",
    productStepId: riskOldSecond.productStepId }), /BROWSER_PROVIDER_EFFECT_OLD_INPUT_UNAUTHORIZED/u,
  "a grant for one old call must not move to another Provider call");
  const riskSecond = withProviderIdentity({ ...risk, commandId: "command:risk:other-scoped-call",
    productStepId: riskOldSecond.productStepId,
    exactCallIdentityHash: hash("risk-second-new-call"),
    deliveryPriorityReplayGrantHash: hash("website-risk-second-grant"),
    deliveryPriorityReplayCall: replayCalls[1]! });
  assert.doesNotThrow(() => store.prepare(riskSecond),
    "a second old Provider call may use its own exact Website grant in the same revision");
  store.markDispatched(risk.commandId);
  store.settleTerminalReceipt(terminalFact(store.readCommand(risk.commandId)!.identity, { terminal: "confirmed", resultHash: hash("risk-new-proof"), mutationOutcome: "confirmed" }));
  const afterRisk = store.jobHistoryEvidence(riskOld.jobId);
  assert.equal(afterRisk.replayEffects.find((effect) =>
    effect.effectIdentityHash === riskOld.logicalMutationId)?.sourceEffectSetHash,
  oldEffectSetHash, "a later revision must not rewrite an old effect observation identity");
  assert.notEqual(afterRisk.replayCalls.find((call) =>
    call.productStepId === riskOld.productStepId)?.sourceEffectSetHash,
  oldEffectSetHash, "the current call hash must still cover the complete old effect set");
  const recovered = store.readAtomicStepOutcome({
    jobId: second.jobId, attemptId: second.attemptId, exactCallIdentityHash: second.exactCallIdentityHash,
    actionOrdinal: second.actionOrdinal, targetRef: second.targetRef, effectScope: "provider_effect",
  });
  assert.equal(recovered?.state, "confirmed");
  assert.equal(recovered?.providerEffectIdentityHash, first.logicalMutationId);
  assert.deepEqual(recovered?.terminalPayload, terminalPayload);
  assert.equal(store.readUniqueConfirmedConversationUrl(
    first.jobId, first.attemptId, first.productStepId,
  ),
    terminalPayload.canonicalConversationUrl,
    "an exact parent job must resolve only its own confirmed conversation URL");
  const historicalFact = store.readProviderEffectStepCallFact({
    jobId: second.jobId, attemptId: second.attemptId, resultRevision: second.resultRevision,
    productStepId: second.productStepId, callId: second.callId,
    childCapabilityId: second.childCapabilityId,
  });
  assert.equal(historicalFact?.exactCallIdentityHash, first.exactCallIdentityHash);
  assert.deepEqual(historicalFact?.confirmedOutcome, recovered,
    "the existing typed WAL fact returns the original decrypted outcome without acquiring a page");
  const receiptDatabase = new Database(path.join(root, "browser", "browser-mutations.sqlite"));
  const originalSeal = receiptDatabase.prepare("select provider_recovery_payload from browser_mutations where command_id=?")
    .pluck().get(first.commandId) as string;
  const originalAuthority = store.authorityHash(first.commandId);
  const readOriginalFact = () => store.readProviderEffectStepCallFact({ jobId: second.jobId, attemptId: second.attemptId,
    resultRevision: second.resultRevision, productStepId: second.productStepId, callId: second.callId, childCapabilityId: second.childCapabilityId });
  receiptDatabase.prepare("update browser_mutations set provider_recovery_payload=null where command_id=?").run(first.commandId);
  assert.throws(readOriginalFact, (error: unknown) => {
    const facts = executionFailureMetadata(error);
    assert.equal(facts?.mutationOutcome, "confirmed"); assert.equal(facts?.browserEffect?.providerEffectIdentityHash, first.logicalMutationId);
    assert.equal(facts?.evidence?.evidenceRef, `browser-mutation:${first.commandId}`);
    return error instanceof Error && error.message === "BROWSER_PROVIDER_EFFECT_FACT_INVALID";
  }, "a confirmed row with missing payload cannot become fresh or lose the original effect");
  receiptDatabase.prepare("update browser_mutations set provider_recovery_payload=? where command_id=?").run("corrupt", first.commandId);
  assert.throws(readOriginalFact, (error: unknown) => {
    assert.equal(executionFailureMetadata(error)?.mutationOutcome, "confirmed");
    assert.equal(executionFailureMetadata(error)?.browserEffect?.providerEffectIdentityHash, first.logicalMutationId);
    return error instanceof Error && /^BROWSER_/u.test(error.message);
  }, "corrupt ciphertext retains its read error and confirmed effect");
  receiptDatabase.prepare("update browser_mutations set provider_recovery_payload=? where command_id=?").run(originalSeal, first.commandId);
  assert.equal(store.authorityHash(first.commandId), originalAuthority);
  assert.deepEqual(readOriginalFact()?.confirmedOutcome?.terminalPayload, terminalPayload);
  receiptDatabase.close();
  assert.equal(historicalFact?.inputHash, first.requestHash,
    "confirmed recovery must return the persisted atomic input identity, not rebuild the current one");
  const continuationIdentity = (
    jobId: string,
    suffix: string,
    productStepId = `continuation-step:${suffix}`,
    revision = 0,
  ): BrowserMutationIdentity => withProviderIdentity({
    ...identity(`attempt:${suffix}`, revision),
    commandId: `continuation:${jobId}:${suffix}`,
    exactCallIdentityHash: hash(`continuation-call:${jobId}:${suffix}`),
    jobId,
    productStepId,
    callId: "turn-submit",
    requestHash: hash(`continuation-request:${jobId}:${suffix}`),
    payloadHash: hash(`continuation-payload:${jobId}:${suffix}`),
    domainRejectionRevision: revision > 0,
  });
  const confirmContinuation = (jobId: string, suffix: string, canonicalConversationUrl: string | null,
    productStepId?: string, revision = 0) => {
    const mutation = continuationIdentity(jobId, suffix, productStepId, revision);
    store.prepare(mutation);
    store.markDispatched(mutation.commandId);
    store.settleTerminalReceipt(terminalFact(store.readCommand(mutation.commandId)!.identity, { terminal: "confirmed", resultHash: hash(`continuation-proof:${jobId}:${suffix}`), mutationOutcome: "confirmed", submitRecoveryPayload: { ...terminalPayload, exactCallIdentityHash: mutation.exactCallIdentityHash, targetRefHash: hash(mutation.targetRef), documentRefHash: hash(mutation.documentRef), canonicalConversationUrl: canonicalConversationUrl?.startsWith("https://chatgpt.com/c/") ? canonicalConversationUrl : conversationUrl("fixture-before-corruption") } }));
    if (canonicalConversationUrl === null) (Reflect.get(store, "database") as Database.Database).prepare("update browser_mutations set provider_recovery_payload=null where command_id=?").run(mutation.commandId);
    else if (!canonicalConversationUrl.startsWith("https://chatgpt.com/c/")) (Reflect.get(store, "database") as Database.Database).prepare("update browser_mutations set provider_recovery_payload=? where command_id=?").run(sealProviderRecoveryPayload(browserMutationPayloadKey(root), mutation.commandId, { terminalPayload: { ...terminalPayload, canonicalConversationUrl } }), mutation.commandId);
  };
  confirmContinuation("job:article:A", "a1", "https://chatgpt.com/c/article-A", "shared-step");
  confirmContinuation("job:article:A", "a2", conversationUrl("article-A-revision"), "shared-step", 1);
  confirmContinuation("job:article:A", "a3", conversationUrl("article-A-other"), "other-step");
  confirmContinuation("job:article:B", "b1", "https://chatgpt.com/c/article-B", "shared-step");
  const mutationDatabase = Reflect.get(store, "database") as Database.Database;
  const rowCountBeforeRead = Number((mutationDatabase.prepare(
    "select count(*) as count from browser_mutations",
  ).get() as { count: number }).count);
  assert.equal(store.readUniqueConfirmedConversationUrl(
    "job:article:A", "attempt:a1", "shared-step",
  ), "https://chatgpt.com/c/article-A",
  "the completed parent attempt must select its own confirmed historical locator");
  assert.equal(Number((mutationDatabase.prepare(
    "select count(*) as count from browser_mutations",
  ).get() as { count: number }).count), rowCountBeforeRead,
  "parent locator reads must not mutate the WAL");
  assert.equal(store.readUniqueConfirmedConversationUrl(
    "job:article:A", "attempt:a2", "shared-step",
  ), conversationUrl("article-A-revision"),
  "a later completed parent attempt must select its own locator without changing effect identity");
  assert.throws(() => store.readUniqueConfirmedConversationUrl(
    "job:article:A", "attempt:a3", "shared-step",
  ), /BROWSER_PARENT_PROVIDER_EFFECT_MISSING/u,
  "a sibling attempt with another step must not satisfy the completed parent selector");
  assert.throws(() => store.readUniqueConfirmedConversationUrl(
    "", "attempt:a1", "shared-step",
  ), /BROWSER_PARENT_IDENTITY_INVALID/u);
  assert.throws(() => store.readUniqueConfirmedConversationUrl(
    "job:article:A", "attempt:\0bad", "shared-step",
  ), /BROWSER_PARENT_IDENTITY_INVALID/u);
  assert.equal(store.readUniqueConfirmedConversationUrl(
    "job:article:B", "attempt:b1", "shared-step",
  ),
    "https://chatgpt.com/c/article-B",
    "interleaved jobs and sibling steps must never lend their URL to the exact parent step");
  confirmContinuation("job:article:ambiguous", "first", conversationUrl("ambiguous-first"), "shared-step");
  confirmContinuation("job:article:ambiguous-staging", "second",
    conversationUrl("ambiguous-first"), "shared-step");
  mutationDatabase.prepare(`update browser_mutations set job_id=?,attempt_id=?
    where command_id=?`).run("job:article:ambiguous", "attempt:first",
    "continuation:job:article:ambiguous-staging:second");
  assert.throws(() => store.readUniqueConfirmedConversationUrl(
    "job:article:ambiguous", "attempt:first", "shared-step"),
  /BROWSER_PARENT_PROVIDER_EFFECT_AMBIGUOUS/u);
  assert.throws(() => store.readUniqueConfirmedConversationUrl(
    "job:article:A", "attempt:a1", "missing-step"), /BROWSER_PARENT_PROVIDER_EFFECT_MISSING/u);
  confirmContinuation("job:article:missing-payload", "d1", null);
  assert.throws(() => store.readUniqueConfirmedConversationUrl(
    "job:article:missing-payload", "attempt:d1", "continuation-step:d1"),
    /BROWSER_PARENT_PROVIDER_EFFECT_INVALID/u);
  confirmContinuation("job:article:invalid-url", "f1", "https://example.com/c/not-chatgpt");
  assert.throws(() => store.readUniqueConfirmedConversationUrl(
    "job:article:invalid-url", "attempt:f1", "continuation-step:f1"),
    /BROWSER_PARENT_PROVIDER_EFFECT_INVALID/u);
  confirmContinuation("job:article:corrupt", "g1", conversationUrl("corrupt"));
  mutationDatabase.prepare("update browser_mutations set provider_recovery_payload=? where command_id=?")
    .run("corrupt", "continuation:job:article:corrupt:g1");
  assert.throws(() => store.readUniqueConfirmedConversationUrl(
    "job:article:corrupt", "attempt:g1", "continuation-step:g1"),
    /BROWSER_PARENT_PROVIDER_EFFECT_INVALID/u);
  const unresolvedParent = continuationIdentity("job:article:A", "a4", "shared-step", 2);
  store.prepare(unresolvedParent);
  store.markDispatched(unresolvedParent.commandId);
  assert.equal(store.readUniqueConfirmedConversationUrl(
    "job:article:A", "attempt:a2", "shared-step",
  ), conversationUrl("article-A-revision"),
  "an unresolved historical sibling attempt must not block the completed parent attempt locator");
  assert.throws(() => store.readUniqueConfirmedConversationUrl(
    "job:article:A", "attempt:a4", "shared-step"),
    /BROWSER_PARENT_PROVIDER_EFFECT_UNSETTLED/u);
  store.close();

  const restarted = new BrowserMutationStore(root);
  restarted.verifyRuntimeTaskProvenance(null);
  const restartedOutcome = restarted.readAtomicStepOutcome({
    jobId: second.jobId, attemptId: second.attemptId, exactCallIdentityHash: second.exactCallIdentityHash,
    actionOrdinal: second.actionOrdinal, targetRef: second.targetRef, effectScope: "provider_effect",
  });
  assert.deepEqual(restartedOutcome?.terminalPayload, terminalPayload,
    "confirmed submit payload survives Browser restart for the same effect readback");
  assert.equal(restartedOutcome?.providerEffectIdentityHash, first.logicalMutationId,
    "the public typed outcome carries the Browser-owned provider effect identity");
  const unrelatedUnknown = restarted.readCommand(unresolvedParent.commandId);
  assert.doesNotThrow(() => restarted.prepare({ ...identity("attempt:2", 1),
    domainRejectionRevision: true }),
    "an unrelated unresolved writer must not block the exact Website-authorized new revision");
  assert.deepEqual(restarted.readCommand(unresolvedParent.commandId), unrelatedUnknown);
  restarted.settleTerminalReceipt(terminalFact(restarted.readCommand(unresolvedParent.commandId)!.identity, { terminal: "rejected", resultHash: hash("terminal-no-input"), mutationOutcome: "no" }));
  assert.throws(() => restarted.prepare({ ...identity("attempt:2", 1),
    domainRejectionRevision: true }), /BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN/u,
    "settling an unrelated writer cannot authorize a second preparation of the same provider effect");
  const rejectedNoInput = { ...identity("attempt:1", 2), domainRejectionRevision: true };
  restarted.prepare(rejectedNoInput);
  restarted.markDispatched(rejectedNoInput.commandId);
  restarted.settleTerminalReceipt(terminalFact(restarted.readCommand(rejectedNoInput.commandId)!.identity, { terminal: "rejected", resultHash: hash("no-input"), mutationOutcome: "no", failureCode: "BROWSER_DOM_READ_INVALID" }));
  const noInputOutcome = (attemptId: string) => restarted.readAtomicStepOutcome({
    jobId: rejectedNoInput.jobId, attemptId,
    exactCallIdentityHash: rejectedNoInput.exactCallIdentityHash,
    actionOrdinal: rejectedNoInput.actionOrdinal, targetRef: `target:${attemptId}`,
    effectScope: "provider_effect",
  });
  assert.equal(noInputOutcome("attempt:1")?.mutationOutcome, "no",
    "the same attempt must retain its no-input rejection instead of self-retrying");
  assert.equal(noInputOutcome("attempt:2"), null,
    "a Website-authorized new attempt must not be blocked by an older zero-input rejection");
  const retriedNoInput = { ...identity("attempt:2", 2), domainRejectionRevision: true };
  assert.doesNotThrow(() => restarted.prepare(retriedNoInput),
    "the new attempt may prepare an effect after proven zero physical input");
  assert.throws(() => restarted.prepare({
    ...retriedNoInput,
    commandId: "command:attempt:2:no-input-drift",
    logicalMutationId: hash("provider-effect:no-input-drift"),
    requestHash: hash("request:no-input-drift"),
    payloadHash: hash("payload:no-input-drift"),
  }), /BROWSER_PROVIDER_EFFECT_IDENTITY_DRIFT/u,
  "after the new attempt fixes its effect identity, a different identity must be rejected");
  restarted.markDispatched(retriedNoInput.commandId);
  restarted.settleTerminalReceipt(terminalFact(restarted.readCommand(retriedNoInput.commandId)!.identity, { terminal: "confirmed", resultHash: hash("retried-terminal"), mutationOutcome: "confirmed", submitRecoveryPayload: {
    ...terminalPayload, exactCallIdentityHash: retriedNoInput.exactCallIdentityHash,
    targetRefHash: hash(retriedNoInput.targetRef), documentRefHash: hash(retriedNoInput.documentRef),
  } }));
  assert.equal(noInputOutcome("attempt:3")?.state, "confirmed",
    "a consumed provider effect must block every later attempt");
  restarted.close();

  const riskDir = path.join(root, "risk-rebind");
  const riskStore = new BrowserMutationStore(riskDir);
  riskStore.verifyRuntimeTaskProvenance(null);
  const source = withProviderIdentity({ ...identity("attempt:risk-source"), jobId: "job:risk-rebind",
    commandId: "command:risk-source" });
  riskStore.prepare(source);
  riskStore.markDispatched(source.commandId);
  riskStore.settleTerminalReceipt(terminalFact(riskStore.readCommand(source.commandId)!.identity, { terminal: "confirmed", resultHash: hash("risk-source-confirmed"), mutationOutcome: "confirmed" }));
  const sourceCall = riskStore.jobHistoryEvidence(source.jobId).replayCalls[0]!;
  const firstRisk = withProviderIdentity({ ...identity("attempt:risk-issued", 1), jobId: source.jobId,
    commandId: "command:risk-prepared", deliveryPriorityReplayGrantHash: hash("risk-rebind-grant"),
    deliveryPriorityReplayCall: sourceCall });
  riskStore.prepare(firstRisk);
  riskStore.close();
  const afterCrash = new BrowserMutationStore(riskDir);
  afterCrash.verifyRuntimeTaskProvenance(null);
  const rebound = { ...firstRisk, commandId: "command:risk-rebound",
    leaseVersion: 3, executionFenceHash: hash("risk-new-fence"),
    targetRef: "target:risk-rebound", documentRef: "document:risk-rebound" };
  assert.doesNotThrow(() => afterCrash.prepare(rebound),
    "a PREPARED risk grant which never dispatched must rebind its one WAL row");
  const riskDatabase = new Database(path.join(riskDir, "browser", "browser-mutations.sqlite"));
  const grantRows = () => riskDatabase.prepare(`select command_id,state,mutation_outcome,
    physical_input_count,terminal_at from browser_mutations
    where delivery_priority_replay_grant_hash=? order by rowid`).all(
    firstRisk.deliveryPriorityReplayGrantHash,
  ) as Array<{ command_id: string; state: string; mutation_outcome: string;
    physical_input_count: number; terminal_at: string | null }>;
  assert.deepEqual(grantRows().map((row) => row.command_id), [rebound.commandId]);
  afterCrash.markDispatched(rebound.commandId);
  assert.throws(() => afterCrash.prepare({ ...rebound, commandId: "command:risk-unsettled" }),
    /BROWSER_REPLAY_GRANT_CONSUMED/u,
    "an unresolved dispatch still consumes its exact risk grant and cannot obtain a second Provider command");
  afterCrash.settleTerminalReceipt(terminalFact(afterCrash.readCommand(rebound.commandId)!.identity, { terminal: "rejected", resultHash: hash("risk-zero-input-proof"), mutationOutcome: "no", failureCode: "BROWSER_TARGET_NOT_INTERACTIVE", nativeCauseCode: null, physicalInputCount: 0 }));
  const firstZeroAuthorityHash = afterCrash.authorityHash(rebound.commandId);
  const afterNoInput = { ...rebound, commandId: "command:risk-after-no-input",
    leaseVersion: 4, executionFenceHash: hash("risk-next-fence"),
    targetRef: "target:risk-next", documentRef: "document:risk-next" };
  assert.doesNotThrow(() => afterCrash.prepare(afterNoInput),
    "a terminal REJECTED/no/zero command must leave the same grant's physical input available");
  assert.equal(grantRows().length, 2,
    "the old terminal proof must stay intact while the new command uses the one WAL");
  afterCrash.markDispatched(afterNoInput.commandId);
  afterCrash.settleTerminalReceipt(terminalFact(afterCrash.readCommand(afterNoInput.commandId)!.identity, { terminal: "rejected", resultHash: hash("risk-second-zero-proof"), mutationOutcome: "no", failureCode: "BROWSER_TARGET_NOT_INTERACTIVE", nativeCauseCode: null, physicalInputCount: 0 }));
  assert.equal(afterCrash.readProvenZeroInputProviderCommand({
    authorityRef: `browser-mutation:${rebound.commandId}`,
    authorityHash: firstZeroAuthorityHash,
    jobId: rebound.jobId, attemptId: rebound.attemptId,
    resultRevision: rebound.resultRevision,
    effectIdentityHash: rebound.logicalMutationId!,
  })?.grantHash, rebound.deliveryPriorityReplayGrantHash,
  "the original failure proof remains readable after a second zero-input terminal");
  const eventual = { ...afterNoInput, commandId: "command:risk-third",
    leaseVersion: 5, executionFenceHash: hash("risk-third-fence"),
    targetRef: "target:risk-third", documentRef: "document:risk-third" };
  afterCrash.prepare(eventual);
  afterCrash.markDispatched(eventual.commandId);
  afterCrash.settleTerminalReceipt(terminalFact(afterCrash.readCommand(eventual.commandId)!.identity, { terminal: "confirmed", resultHash: hash("risk-eventual-input"), mutationOutcome: "confirmed", submitRecoveryPayload: { ...terminalPayload, exactCallIdentityHash: eventual.exactCallIdentityHash,
      targetRefHash: hash(eventual.targetRef), documentRefHash: hash(eventual.documentRef) }, physicalInputCount: 1 }));
  assert.equal(afterCrash.readAtomicStepOutcome({
    jobId: afterNoInput.jobId, attemptId: afterNoInput.attemptId,
    exactCallIdentityHash: afterNoInput.exactCallIdentityHash,
    actionOrdinal: afterNoInput.actionOrdinal, targetRef: afterNoInput.targetRef,
    effectScope: "provider_effect",
  })?.state, "confirmed", "current effect readback ignores only earlier proven zero-input commands");
  assert.equal(afterCrash.readProviderEffectStepCallFact({
    jobId: afterNoInput.jobId, attemptId: afterNoInput.attemptId,
    resultRevision: afterNoInput.resultRevision, productStepId: afterNoInput.productStepId,
    callId: afterNoInput.callId, childCapabilityId: afterNoInput.childCapabilityId,
  })?.mutation.outcome, "CONFIRMED", "business call readback selects the one input-bearing command");
  assert.equal(afterCrash.readExactCallMutationFact({
    jobId: afterNoInput.jobId, attemptId: afterNoInput.attemptId,
    exactCallIdentityHash: afterNoInput.exactCallIdentityHash,
    actionOrdinal: afterNoInput.actionOrdinal,
  })?.outcome, "CONFIRMED", "exact readback excludes earlier no-input terminal commands");
  assert.equal(afterCrash.readSourceConfirmedProviderEffect({
    jobId: afterNoInput.jobId, sourceAttemptId: afterNoInput.attemptId,
    sourceResultRevision: afterNoInput.resultRevision,
    productStepId: afterNoInput.productStepId, callId: afterNoInput.callId,
    childCapabilityId: afterNoInput.childCapabilityId,
    effectIdentityHash: afterNoInput.logicalMutationId!,
    walAuthorityHash: afterCrash.jobHistoryEvidence(afterNoInput.jobId)
      .replayEffects.find((effect) => effect.effectIdentityHash
        === afterNoInput.logicalMutationId)!.walAuthorityHash,
  }).authorityHash, afterCrash.authorityHash(eventual.commandId),
  "later source recovery selects only the actual confirmed Provider command");
  assert.throws(() => afterCrash.prepare({ ...afterNoInput,
    commandId: "command:risk-after-confirmed" }), /BROWSER_REPLAY_GRANT_CONSUMED/u,
  "one real Provider input consumes the exact risk grant");
  riskDatabase.close();
  afterCrash.close();
} finally {
  await rm(root, { recursive: true, force: true });
}
process.stdout.write("LOCAL_BROWSER_ATTEMPT_FENCE_ACCEPTANCE_PASS\n");
emitQualityProofObservation({
  lawId: "LAW-LOCAL-BROWSER-SESSION-004-V59", evidenceMode: "exam.golden",
  clauses: ["forbidden:0", "forbidden:3", "forbidden:4", "forbidden:5"],
  locator: "acceptance:local-browser-provider-effect-recovery:risk-grant",
  observedValue: "original Provider effect sets remain in WAL; a risk grant rebinds only proven zero-input PREPARED and retries only proven REJECTED/no commands until one physical input",
});
