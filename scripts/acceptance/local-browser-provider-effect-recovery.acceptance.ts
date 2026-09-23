import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BrowserMutationStore,
} from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import type { BrowserMutationIdentity } from "../../src/lib/browser/exact-target/browser-mutation-types.js";
import { ensureCurrentSchema } from "../../src/lib/browser/exact-target/browser-mutation-schema.js";
import { submitRecoveryPayload } from
  "../../src/lib/browser/exact-target/browser-submit-recovery-payload.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const identity = (attemptId: string, revision = 0): BrowserMutationIdentity => Object.freeze({deliveryPriorityReplayGrantHash: null,
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
  queries: [{ rawCount: 1, eligibleCount: 1, matches: [{ testId: "conversation-turn-1",
    exactGptUserPromptHash: hash("prompt") }] }],
} });

assert.equal(submitRecoveryPayload(submitTerminalReply(
  "https://chatgpt.com/c/durable-provider-route",
)).canonicalConversationUrl, "https://chatgpt.com/c/durable-provider-route");
assert.throws(() => submitRecoveryPayload(submitTerminalReply(
  "https://chatgpt.com/c/WEB:temporary-client-route",
)), /BROWSER_ORIGIN_REJECTED/u,
"Browser WAL must reject a temporary client route before persisting confirmed recovery data");

const root = await mkdtemp(path.join(tmpdir(), "browser-attempt-fence-"));
try {
  for (const forbiddenColumn of [
    "consultation_identity_hash", "source_task_ref_hash", "continuation_checkpoint_hash",
    "owner_plugin_id", "plugin_version",
  ]) {
    const forbiddenSchema = new Database(path.join(root, `${forbiddenColumn}.sqlite`));
    ensureCurrentSchema(forbiddenSchema);
    forbiddenSchema.exec(`alter table browser_mutations add column ${forbiddenColumn} text`);
    assert.throws(() => ensureCurrentSchema(forbiddenSchema), /BROWSER_REPAIR_REQUIRED/u,
      `Browser startup must reject a WAL that retains ${forbiddenColumn}`);
    forbiddenSchema.close();
  }
  const incompleteSchema = new Database(path.join(root, "incomplete.sqlite"));
  ensureCurrentSchema(incompleteSchema);
  incompleteSchema.exec("alter table browser_mutations drop column mutation_outcome");
  assert.throws(() => ensureCurrentSchema(incompleteSchema), /BROWSER_REPAIR_REQUIRED/u,
    "Browser startup must reject an incomplete WAL instead of migrating it");
  incompleteSchema.close();

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
    promptHash: hash("prompt"), userTurnId: "conversation-turn-1",
    exactCallIdentityHash: first.exactCallIdentityHash,
    observationRevisionHash: hash("observation"),
    targetRefHash: hash(first.targetRef), documentRefHash: hash(first.documentRef),
    rawCount: 1, eligibleCount: 1,
  };
  const conversationUrl = (conversationId: string) =>
    new URL(`/c/${conversationId}`, terminalPayload.canonicalConversationUrl).href;
  store.prepare(first);
  store.markDispatched(first.commandId);
  store.markConfirmed(first.commandId, hash("terminal-proof"), "confirmed", terminalPayload);
  const attachmentPreparation = (attemptId: string, generation: number): BrowserMutationIdentity => ({
    ...identity(attemptId), commandId: `attachment:${attemptId}`,
    logicalMutationId: hash(`attachment:${attemptId}:${generation}`),
    exactCallIdentityHash: hash(`attachment-call:${attemptId}:${generation}`),
    childCapabilityId: "attach_approved_gpt_files_once", effectScope: "target_local",
  });
  const firstAttachment = attachmentPreparation("attempt:1", 1);
  store.prepare(firstAttachment);
  store.markDispatched(firstAttachment.commandId);
  store.markConfirmed(firstAttachment.commandId, hash("attachment-1"), "confirmed", null);
  const secondAttachment = attachmentPreparation("attempt:2", 2);
  assert.doesNotThrow(() => store.prepare(secondAttachment),
    "a different attempt must receive its own target-local attachment preparation");
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
  const riskOld = { ...identity("attempt:risk-old"), jobId: "job:risk-scope",
    commandId: "command:risk:old", logicalMutationId: hash("risk-old-effect"),
    exactCallIdentityHash: hash("risk-old-call") };
  store.prepare(riskOld);
  store.markDispatched(riskOld.commandId);
  store.markConfirmed(riskOld.commandId, hash("risk-old-proof"), "confirmed", null);
  const riskOldSecond = { ...riskOld, commandId: "command:risk:old-second",
    productStepId: "provider-submit-second",
    logicalMutationId: hash("risk-old-second-effect"),
    exactCallIdentityHash: hash("risk-old-second-call") };
  store.prepare(riskOldSecond);
  store.markDispatched(riskOldSecond.commandId);
  store.markConfirmed(riskOldSecond.commandId, hash("risk-old-second-proof"), "confirmed", null);
  const replayCalls = store.jobHistoryEvidence(riskOld.jobId).replayCalls;
  assert.equal(replayCalls.length, 2,
    "the source must enumerate every old Provider call that may have received input");
  const replayCall = replayCalls[0];
  assert.ok(replayCall, "the WAL must name the exact old Provider call and effect set");
  const risk = { ...identity("attempt:risk-new", 1), jobId: riskOld.jobId,
    commandId: "command:risk:once",
    deliveryPriorityReplayGrantHash: hash("website-risk-grant"),
    deliveryPriorityReplayCall: replayCall };
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
  const riskSecond = { ...risk, commandId: "command:risk:other-scoped-call",
    productStepId: riskOldSecond.productStepId,
    logicalMutationId: hash("risk-second-new-effect"),
    exactCallIdentityHash: hash("risk-second-new-call"),
    deliveryPriorityReplayGrantHash: hash("website-risk-second-grant"),
    deliveryPriorityReplayCall: replayCalls[1]! };
  assert.doesNotThrow(() => store.prepare(riskSecond),
    "a second old Provider call may use its own exact Website grant in the same revision");
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
  assert.equal(historicalFact?.inputHash, first.requestHash,
    "confirmed recovery must return the persisted atomic input identity, not rebuild the current one");
  const continuationIdentity = (
    jobId: string,
    suffix: string,
    productStepId = `continuation-step:${suffix}`,
    revision = 0,
  ): BrowserMutationIdentity => ({
    ...identity(`attempt:${suffix}`, revision),
    commandId: `continuation:${jobId}:${suffix}`,
    logicalMutationId: hash(`continuation-effect:${jobId}:${suffix}`),
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
    store.markConfirmed(mutation.commandId, hash(`continuation-proof:${jobId}:${suffix}`),
      "confirmed", canonicalConversationUrl ? { ...terminalPayload, canonicalConversationUrl } : null);
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
  assert.doesNotThrow(() => restarted.prepare({ ...identity("attempt:2", 1),
    domainRejectionRevision: true }),
    "a Website-authorized new result revision receives a new provider effect");
  const rejectedNoInput = { ...identity("attempt:1", 2), domainRejectionRevision: true };
  restarted.prepare(rejectedNoInput);
  restarted.markDispatched(rejectedNoInput.commandId);
  restarted.markRejected(rejectedNoInput.commandId, hash("no-input"), "no", "BROWSER_DOM_READ_INVALID");
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
  restarted.markConfirmed(retriedNoInput.commandId, hash("retried-terminal"), "confirmed", terminalPayload);
  assert.equal(noInputOutcome("attempt:3")?.state, "confirmed",
    "a consumed provider effect must block every later attempt");
  restarted.close();
} finally {
  await rm(root, { recursive: true, force: true });
}

process.stdout.write("LOCAL_BROWSER_ATTEMPT_FENCE_ACCEPTANCE_PASS\n");
