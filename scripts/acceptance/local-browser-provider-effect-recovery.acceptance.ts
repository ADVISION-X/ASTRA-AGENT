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
import { browserMutationPayloadKey, sealProviderRecoveryPayload } from
  "../../src/lib/browser/exact-target/browser-mutation-payload.js";
import { submitRecoveryPayload } from
  "../../src/lib/browser/exact-target/browser-submit-recovery-payload.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

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
  const schemaReceipt = (database: Database.Database): string => JSON.stringify(database.prepare(
    "select type,name,sql from sqlite_master where type in ('table','index') order by type,name").all());
  const rejectWithoutChange = (database: Database.Database, reason: string): void => {
    const before = schemaReceipt(database);
    assert.throws(() => ensureCurrentSchema(database), /BROWSER_REPAIR_REQUIRED/u, reason);
    assert.equal(schemaReceipt(database), before, `${reason}: schema must remain unchanged`);
    database.close();
  };
  const currentFixture = new Database(path.join(root, "current-schema-source.sqlite"));
  ensureCurrentSchema(currentFixture);
  const currentDdl = currentFixture.prepare("select type,name,sql from sqlite_master where sql is not null and type in ('table','index') order by case type when 'table' then 0 else 1 end,name").all() as Array<{ type: string; name: string; sql: string }>;
  currentFixture.close();
  const alteredSchema = (name: string, alter: (entry: { type: string; name: string; sql: string }) => string) => {
    const database = new Database(path.join(root, `${name}.sqlite`));
    for (const entry of currentDdl) database.exec(alter(entry));
    return database;
  };
  const nullableTarget = alteredSchema("nullable-target", (entry) => entry.name === "browser_mutations"
    ? entry.sql.replace("target_ref text not null", "target_ref text") : entry.sql);
  rejectWithoutChange(nullableTarget, "Browser startup must reject a nullable WAL target identity");
  const wrongIndex = alteredSchema("wrong-index", (entry) => entry.name === "browser_mutations_unresolved"
    ? entry.sql.replace("job_id,attempt_id,lease_version", "job_id,attempt_id,result_revision") : entry.sql);
  rejectWithoutChange(wrongIndex, "Browser startup must reject an index name with different columns");
  const viewOnly = new Database(path.join(root, "view-only.sqlite"));
  viewOnly.exec("create view legacy_browser_view as select 1 as id");
  assert.throws(() => ensureCurrentSchema(viewOnly), /BROWSER_REPAIR_REQUIRED/u,
    "a database containing an old view must not be treated as empty");
  assert.equal(viewOnly.prepare("select name from sqlite_master where name='browser_mutations'").get(), undefined);
  viewOnly.close();
  const oldClaimSchema = new Database(path.join(root, "old-target-claims.sqlite"));
  ensureCurrentSchema(oldClaimSchema);
  oldClaimSchema.exec("create table browser_target_claims (target_ref text, job_ref_hash text, tab_id integer, claimed_at text, released_at text)");
  oldClaimSchema.exec("insert into browser_target_claims values ('target-tab-old','job-hash-old',12,'2026-01-01T00:00:00Z',null)");
  rejectWithoutChange(oldClaimSchema, "Browser startup must reject a retained target identity table");
  const missingGrantSchema = new Database(path.join(root, "missing-replay-grant.sqlite"));
  ensureCurrentSchema(missingGrantSchema);
  missingGrantSchema.exec("alter table browser_mutations drop column delivery_priority_replay_grant_hash");
  rejectWithoutChange(missingGrantSchema, "Browser startup must reject a missing current grant column");
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
  store.markConfirmed(first.commandId, hash("terminal-proof"), "confirmed", terminalPayload);
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
  store.markConfirmed(firstAttachment.commandId, hash("attachment-1"), "confirmed", null);
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
  store.markConfirmed(riskOld.commandId, hash("risk-old-proof"), "confirmed", null);
  const riskOldSecond = withProviderIdentity({ ...riskOld, commandId: "command:risk:old-second",
    productStepId: "provider-submit-second",
    exactCallIdentityHash: hash("risk-old-second-call") });
  store.prepare(riskOldSecond);
  store.markDispatched(riskOldSecond.commandId);
  store.markConfirmed(riskOldSecond.commandId, hash("risk-old-second-proof"), "confirmed", null);
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
  store.markConfirmed(risk.commandId, hash("risk-new-proof"), "confirmed", null);
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
  assert.throws(() => restarted.prepare({ ...identity("attempt:2", 1),
    domainRejectionRevision: true }), /BROWSER_MUTATION_UNSETTLED/u,
  "an unresolved physical input blocks even a Website-authorized new revision");
  restarted.markRejected(unresolvedParent.commandId, hash("terminal-no-input"), "no");
  assert.doesNotThrow(() => restarted.prepare({ ...identity("attempt:2", 1),
    domainRejectionRevision: true }),
    "a new revision may proceed only after the old writer has a reliable terminal");
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
  restarted.markConfirmed(retriedNoInput.commandId, hash("retried-terminal"), "confirmed", {
    ...terminalPayload, exactCallIdentityHash: retriedNoInput.exactCallIdentityHash,
    targetRefHash: hash(retriedNoInput.targetRef), documentRefHash: hash(retriedNoInput.documentRef),
  });
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
  riskStore.markConfirmed(source.commandId, hash("risk-source-confirmed"), "confirmed");
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
    /BROWSER_MUTATION_UNSETTLED/u,
    "an unresolved dispatch cannot obtain a second Provider command");
  afterCrash.markRejected(rebound.commandId, hash("risk-zero-input-proof"), "no",
    "BROWSER_TARGET_NOT_INTERACTIVE", null, 0);
  const firstZeroAuthorityHash = afterCrash.authorityHash(rebound.commandId);
  const afterNoInput = { ...rebound, commandId: "command:risk-after-no-input",
    leaseVersion: 4, executionFenceHash: hash("risk-next-fence"),
    targetRef: "target:risk-next", documentRef: "document:risk-next" };
  assert.doesNotThrow(() => afterCrash.prepare(afterNoInput),
    "a terminal REJECTED/no/zero command must leave the same grant's physical input available");
  assert.equal(grantRows().length, 2,
    "the old terminal proof must stay intact while the new command uses the one WAL");
  afterCrash.markDispatched(afterNoInput.commandId);
  afterCrash.markRejected(afterNoInput.commandId, hash("risk-second-zero-proof"), "no",
    "BROWSER_TARGET_NOT_INTERACTIVE", null, 0);
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
  afterCrash.markConfirmed(eventual.commandId, hash("risk-eventual-input"),
    "confirmed", { ...terminalPayload, exactCallIdentityHash: eventual.exactCallIdentityHash,
      targetRefHash: hash(eventual.targetRef), documentRefHash: hash(eventual.documentRef) }, 1);
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
  lawId: "LAW-LOCAL-BROWSER-SESSION-004-V54", evidenceMode: "exam.golden",
  clauses: ["forbidden:0", "forbidden:3", "forbidden:4", "forbidden:5"],
  locator: "acceptance:local-browser-provider-effect-recovery:risk-grant",
  observedValue: "original Provider effect sets remain in WAL; a risk grant rebinds only proven zero-input PREPARED and retries only proven REJECTED/no commands until one physical input",
});
