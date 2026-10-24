import type { BrowserMutationIdentity } from "../../src/lib/browser/exact-target/browser-mutation-types.js";
import { browserMutationReceiptBindingProjection, browserMutationTerminalFactBytes, type BrowserMutationTerminalFact,
  type BrowserMutationTerminalReceipt } from "../../src/lib/browser/exact-target/browser-observation-receipt.js";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import path, { join } from "node:path";
import Database from "better-sqlite3";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { ensureCurrentSchema } from "../../src/lib/browser/exact-target/browser-mutation-schema.js";
import type { BrowserDomObservationPacketV2 } from "../../src/lib/browser/exact-target/browser-dom-intent.js";
import type { BrowserExecutionBinding } from "../../src/lib/browser/browser-authority-api.js";
import { browserExactCallIdentityHash } from "../../src/lib/browser/browser-authority-api.js";
import { submitRecoveryPayload } from "../../src/lib/browser/exact-target/browser-submit-recovery-payload.js";
import { BrowserCommandActor } from "../../src/lib/browser/exact-target/browser-command-actor.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";

export const hash = `sha256:${"a".repeat(64)}` as const;
export const exactHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const identity = (commandId: string, attemptId: string, executionFenceHash = hash) => ({deliveryPriorityReplayGrantHash: null,
  commandId,
  exactCallIdentityHash: exactHash(`${attemptId}:${commandId}`),
  jobId: "job-1",
  resultRevision: 0,
  attemptId,
  leaseVersion: 1,
  executionFenceHash,
  productStepId: "step-1",
  childCapabilityId: "open_gpt_model_selector_v3",
  callId: "call-1",
  effectScope: "target_local" as const,
  actionOrdinal: 1,
  targetRef: "target-1",
  documentRef: "document-1",
  actionId: "browser.dom.click.v1",
  positivePostconditionHash: hash,
  negativePostconditionHash: `sha256:${"b".repeat(64)}` as const,
  requestHash: hash,
  payloadHash: hash,
});

export const exerciseBrowserMutationStore = (root: string): void => {
  const first = new BrowserMutationStore(root);
  first.verifyRuntimeTaskProvenance(null);
  first.prepare(identity("old-command", "attempt-1"));
  first.markDispatched("old-command");
  first.close();

  const restarted = new BrowserMutationStore(root);
  restarted.verifyRuntimeTaskProvenance(null);
  assert.deepEqual(restarted.dispatchedForBinding({
    jobId: "job-1", attemptId: "attempt-2", leaseVersion: 1, executionFenceHash: hash,
  }), [], "a new attempt must not inherit old pending mutations");
  const nextFence = `sha256:${"b".repeat(64)}` as const;
  assert.equal(restarted.readCommand("old-command")?.state ?? null, "DISPATCHED",
    "a new fence must not terminalize a command from the old attempt");
  assert.equal(restarted.readMutationOutcome("old-command"), "dispatched");
  const oldPending = restarted.readCommand("old-command");
  assert.doesNotThrow(() => restarted.prepare(identity("new-command", "attempt-2", nextFence)),
    "a distinct target-local command stays reachable while the old unknown fact is preserved");
  assert.deepEqual(restarted.readCommand("old-command"), oldPending);
  assert.deepEqual(restarted.dispatchedForBinding({
    jobId: "job-1", attemptId: "attempt-2", leaseVersion: 1, executionFenceHash: nextFence,
  }), []);
  restarted.close();

  const provider = new BrowserMutationStore(join(root, "provider-case"));
  provider.verifyRuntimeTaskProvenance(null);
  const providerIdentity = { ...identity("provider-command", "attempt-provider"),
    effectScope: "provider_effect" as const, logicalMutationId: exactHash("provider-effect"),
    childCapabilityId: "submit_exact_gpt_turn_once" };
  provider.prepare(providerIdentity);
  provider.markDispatched(providerIdentity.commandId);
  assert.deepEqual(provider.dispatchedForBinding({ jobId: "job-1", attemptId: "attempt-provider",
    leaseVersion: 2, executionFenceHash: nextFence }), [providerIdentity.commandId],
  "same-attempt provider DISPATCHED must bind readback across fences");
  assert.equal(provider.readCommand(providerIdentity.commandId)?.state ?? null, "DISPATCHED",
    "provider readback admission must not terminalize or rewrite the unknown effect");
  const dispatchedAuthorityHash = provider.authorityHash(providerIdentity.commandId);
  provider.settleTerminalReceipt(terminalFact(providerIdentity));
  const terminal = provider.readAtomicStepOutcome({ jobId: providerIdentity.jobId,
    attemptId: providerIdentity.attemptId, exactCallIdentityHash: providerIdentity.exactCallIdentityHash,
    actionOrdinal: providerIdentity.actionOrdinal, targetRef: providerIdentity.targetRef,
    effectScope: "provider_effect" });
  assert.equal(terminal?.state, "confirmed");
  assert.equal(terminal?.mutationOutcome, "confirmed");
  assert.notEqual(terminal?.authorityHash, dispatchedAuthorityHash,
    "positive readback must expose the terminal WAL hash, not its prior DISPATCHED hash");
  provider.close();
};

/** P.5: a P1 observational postcondition cause must be accepted and round-trip through the WAL unchanged. */
export const exercisePostconditionNativeCauseWalRoundTrip = (root: string): void => {
  const store = new BrowserMutationStore(root);
  store.verifyRuntimeTaskProvenance(null);
  const walIdentity = identity("postcondition-command", "attempt-postcondition");
  store.prepare(walIdentity);
  store.markDispatched(walIdentity.commandId);
  store.settleTerminalReceipt(terminalFact(store.readCommand(walIdentity.commandId)!.identity, { terminal: "rejected", resultHash: exactHash("postcondition-rejection"), mutationOutcome: "confirmed", failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: "BROWSER_POSTCONDITION_Q0__NO_LAYOUT_BOX" }));
  const terminal = store.readAtomicStepOutcome({
    jobId: walIdentity.jobId, attemptId: walIdentity.attemptId,
    exactCallIdentityHash: walIdentity.exactCallIdentityHash, actionOrdinal: walIdentity.actionOrdinal,
    targetRef: walIdentity.targetRef, effectScope: "target_local",
  });
  assert.equal(terminal?.state, "rejected");
  assert.equal(terminal?.failureCode, "BROWSER_POSTCONDITION_FAILED");
  assert.equal(terminal?.nativeFailureCode, "BROWSER_POSTCONDITION_Q0__NO_LAYOUT_BOX",
    "a P1 observational postcondition cause must round-trip through the WAL unchanged");
  store.close();
};

/** Browser startup validates the existing WAL read-only: every drifted or retained legacy shape is rejected unchanged. */
export const verifyWalSchemaStartupRejections = (root: string): void => {
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
};

/** Builds original executor facts for fixtures; settlement always calls the production Store directly. */
export const terminalFact = (identity: BrowserMutationIdentity,
  fields: Partial<BrowserMutationTerminalReceipt> = {}): BrowserMutationTerminalFact => {
  const terminal = fields.terminal ?? "confirmed";
  const mutationOutcome = fields.mutationOutcome ?? "confirmed";
  const payload = terminal === "confirmed" && mutationOutcome === "confirmed"
    && identity.childCapabilityId === "submit_exact_gpt_turn_once" ? {
      canonicalConversationUrl: "https://chatgpt.com/c/fixture-original-turn", promptHash: exactHash("fixture-prompt"),
      userTurnId: "00000000-0000-4000-8000-000000000001", exactCallIdentityHash: identity.exactCallIdentityHash,
      observationRevisionHash: exactHash("fixture-observation"), targetRefHash: exactHash(identity.targetRef),
      documentRefHash: exactHash(identity.documentRef), rawCount: 1, eligibleCount: 1,
    } : null;
  const terminalReceipt: BrowserMutationTerminalReceipt = {
    schemaVersion: "grasseye.browser.command-terminal-receipt.v1", terminal, mutationOutcome,
    physicalInputCount: mutationOutcome === "no" ? 0 : 1,
    failureCode: terminal === "rejected" ? "BROWSER_POSTCONDITION_FAILED" : null, nativeCauseCode: null,
    completedAt: new Date().toISOString(), resultHash: exactHash("fixture-original-result"), submitRecoveryPayload: payload,
    ...fields,
  };
  const fact = { commandId: identity.commandId, receiptBindingHash: exactHash(JSON.stringify(browserMutationReceiptBindingProjection(identity))), terminalReceipt };
  return { type: "fact", ...fact, receiptHash: exactHash(browserMutationTerminalFactBytes(fact)) };
};

export const exerciseTerminalFactSettlement = (root: string): void => {
  const store = new BrowserMutationStore(root);
  store.verifyRuntimeTaskProvenance(null);
  const original = identity("original-receipt", "original-attempt");
  store.prepare(original); store.markDispatched(original.commandId);
  const fact = terminalFact(original);
  const before = store.authorityHash(original.commandId);
  for (const key of ["commandId", "exactCallIdentityHash", "jobId", "attemptId", "resultRevision", "leaseVersion", "executionFenceHash",
    "deliveryPriorityReplayGrantHash", "productStepId", "callId", "childCapabilityId", "effectScope", "actionOrdinal", "actionId",
    "positivePostconditionHash", "negativePostconditionHash", "requestHash", "payloadHash"] as const) {
    const value = original[key];
    const mutated = { ...original, [key]: typeof value === "number" ? value + 1 : typeof value === "string" ? value + "-drift" : hash };
    assert.throws(() => store.settleTerminalReceipt(terminalFact(mutated)), /BROWSER_MUTATION_RECORD_MISSING|BROWSER_RECONCILIATION_IDENTITY_MISMATCH/u);
    assert.equal(store.authorityHash(original.commandId), before, key);
  }
  for (const count of [2, 3, 4] as const) assert.throws(() => store.settleTerminalReceipt(
    terminalFact(original, { physicalInputCount: count })), /BROWSER_RECONCILIATION_RECEIPT_INVALID/u);
  assert.throws(() => store.settleTerminalReceipt({ ...fact, terminalReceipt: { ...fact.terminalReceipt,
    unexpected: true } } as BrowserMutationTerminalFact), /BROWSER_RECONCILIATION_IDENTITY_MISMATCH/u);
  assert.equal(store.settleTerminalReceipt(fact).changed, true);
  const committed = store.authorityHash(original.commandId);
  assert.equal(store.settleTerminalReceipt(fact).changed, false);
  store.markReceiptMissing(original.commandId);
  assert.equal(store.authorityHash(original.commandId), committed, "late send catch cannot change committed facts");
  const database = Reflect.get(store, "database") as Database.Database;
  database.prepare("update browser_mutations set physical_input_count=0 where command_id=?").run(original.commandId);
  assert.throws(() => store.settleTerminalReceipt(fact), /BROWSER_MUTATION_STATE_CONFLICT/u,
    "duplicate proof cannot hide a drifted durable count");
  database.prepare("update browser_mutations set physical_input_count=1 where command_id=?").run(original.commandId);
  assert.equal(store.settleTerminalReceipt(fact).changed, false);
  const provider = { ...identity("submit-receipt", "submit-attempt"), effectScope: "provider_effect" as const,
    childCapabilityId: "submit_exact_gpt_turn_once", logicalMutationId: exactHash("receipt-provider") };
  store.prepare(provider); store.markDispatched(provider.commandId);
  assert.throws(() => store.settleTerminalReceipt(terminalFact(provider, { submitRecoveryPayload: null })),
    /BROWSER_RECONCILIATION_RECEIPT_INVALID/u);
  const submit = terminalFact(provider);
  assert.equal(store.settleTerminalReceipt(submit).changed, true);
  assert.equal(store.settleTerminalReceipt(submit).changed, false);
  assert.equal(database.prepare("select physical_input_count from browser_mutations where command_id=?").pluck().get(provider.commandId), 1);
  store.close();
};

const submittedLocatorFixture = (root: string) => {
  const store = new BrowserMutationStore(root); store.verifyRuntimeTaskProvenance(null);
  const base = identity("locator-submit", "attempt:locator");
  const original: BrowserMutationIdentity = { ...base, childCapabilityId: "submit_exact_gpt_turn_once",
    callId: "turn-submit", effectScope: "provider_effect", logicalMutationId: exactHash(JSON.stringify([
      base.jobId, base.resultRevision, base.productStepId, "turn-submit", "submit_exact_gpt_turn_once", base.requestHash, base.payloadHash])) };
  const userTurnId = "00000000-0000-4000-8000-000000000001";
  const proof = submitRecoveryPayload({ postconditionObservation: { exactCallIdentityHash: original.exactCallIdentityHash,
    observationRevisionHash: hash, targetRefHash: exactHash(original.targetRef), documentRefHash: exactHash(original.documentRef),
    currentUrl: "https://chatgpt.com/c/local-chatgpt%3Atemporary", queries: [{ rawCount: 1, eligibleCount: 1,
      matches: [{ turnKey: userTurnId, exactGptUserPromptHash: hash }] }] } });
  store.prepare(original); store.markDispatched(original.commandId);
  store.settleTerminalReceipt(terminalFact(store.readCommand(original.commandId)!.identity,
    { terminal: "confirmed", mutationOutcome: "confirmed", resultHash: hash, submitRecoveryPayload: proof }));
  const binding: BrowserExecutionBinding = { kind: "production", jobId: original.jobId, attemptId: original.attemptId,
    resultRevision: 0, productStepId: original.productStepId, callId: "conversation-url", deviceId: "device:locator",
    leaseVersion: 2, localOrderId: original.jobId, contractManifestHash: hash, executionRef: "locator",
    jobRefHash: hash, executionRefHash: hash, writerLeaseEpoch: 2, writerFenceHash: exactHash("renewed-fence"),
    candidateHash: hash, commandTtlMs: 20_000 };
  const step = { resultRevision: 0, productStepId: original.productStepId, callId: "conversation-url",
    childCapabilityId: "get_submitted_gpt_conversation_url", inputHash: hash, actionOrdinal: 2,
    replayPolicy: "observation-only" as const };
  const packet = (url: string): BrowserDomObservationPacketV2 => ({ schemaVersion: "grasseye.browser.dom-observation.v2",
    exactCallIdentityHash: browserExactCallIdentityHash({ ...binding, ...step }), targetRefHash: exactHash(original.targetRef),
    documentRefHash: exactHash(original.documentRef), observationRevisionHash: exactHash("locator-observation"),
    observedAt: new Date(Date.now()).toISOString(), currentUrl: url, queries: [{ queryId: "submitted-conversation-user",
      rawCount: 1, eligibleCount: 1, scopeRawCount: 0, scopeEligibleCount: 0,
      matches: [{ turnKey: userTurnId, candidateIndex: 0, observationIdentityHash: hash }],
      rejections: [], scopeRejections: [], nativeCauseCode: null, nativeCauseCount: 0, nativeStage: "runtime-call-function-on" }] });
  return { store, original, proof, binding, step, packet };
};
type SubmittedLocatorFixture = ReturnType<typeof submittedLocatorFixture>;
const locatorOutcome = (f: SubmittedLocatorFixture) => f.store.readAtomicStepOutcome({ jobId: f.original.jobId,
  attemptId: f.original.attemptId, exactCallIdentityHash: f.original.exactCallIdentityHash, actionOrdinal: 1,
  targetRef: f.original.targetRef, effectScope: "provider_effect" })!;

const verifyLocatorCas = (root: string): void => {
  const f = submittedLocatorFixture(root), database = new Database(join(root, "browser", "browser-mutations.sqlite"), { readonly: true });
  const row = () => database.prepare("select * from browser_mutations where command_id=?").get(f.original.commandId) as Record<string, unknown>;
  const { provider_recovery_payload: _ciphertext, ...originalRow } = row();
  const authority = f.store.authorityHash(f.original.commandId), effects = f.store.jobHistoryEvidence(f.original.jobId).replayEffects[0]!.sourceEffectSetHash;
  const input = { binding: f.binding, productStepId: f.original.productStepId, submitCallId: "turn-submit",
    providerEffectIdentityHash: f.original.logicalMutationId!, packet: f.packet("https://chatgpt.com/c/locator-cas"),
    assertCurrent: () => f.original.documentRef };
  try {
    assert.equal(locatorOutcome(f).conversationLocator, null);
    assert.equal(f.store.jobHistoryEvidence(f.original.jobId).replayEffects[0]!.anchorState, "absent");
    assert.throws(() => f.store.bindSubmittedConversationLocator({ ...input, binding: { ...f.binding, attemptId: "other-attempt" } }), /BROWSER_SOURCE_EFFECT_IDENTITY_MISMATCH/u);
    assert.throws(() => f.store.bindSubmittedConversationLocator({ ...input, assertCurrent: () => { throw new Error("REVOKED"); } }), /REVOKED/u);
    assert.throws(() => f.store.bindSubmittedConversationLocator({ ...input, packet: { ...input.packet, documentRefHash: hash } }), /BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID/u);
    const located = f.store.bindSubmittedConversationLocator(input);
    assert.equal(located.canonicalConversationUrl, input.packet.currentUrl, "same accepted attempt can renew lease/fence before locating");
    const ciphertext = row().provider_recovery_payload;
    assert.deepEqual(f.store.bindSubmittedConversationLocator(input), located);
    assert.equal(row().provider_recovery_payload, ciphertext, "idempotent locator read must not re-encrypt the envelope");
    assert.throws(() => f.store.bindSubmittedConversationLocator({ ...input, packet: f.packet("https://chatgpt.com/c/conflict") }), /BROWSER_PROVIDER_RECOVERY_ANCHOR_INVALID/u);
    const { provider_recovery_payload: _locatedCiphertext, ...finalRow } = row();
    assert.deepEqual(finalRow, originalRow, "all terminal fields, proof hash and updated_at must remain byte-identical");
    assert.equal(f.store.authorityHash(f.original.commandId), authority);
    assert.equal(f.store.jobHistoryEvidence(f.original.jobId).replayEffects[0]!.sourceEffectSetHash, effects);
    assert.deepEqual(locatorOutcome(f).terminalPayload, f.proof);
    assert.deepEqual(locatorOutcome(f).conversationLocator, located);
    assert.equal(f.store.jobHistoryEvidence(f.original.jobId).replayEffects[0]!.anchorState, "trusted");
    assert.equal(f.store.readUniqueConfirmedConversationUrl(f.original.jobId, f.original.attemptId, f.original.productStepId), located.canonicalConversationUrl);
  } finally { database.close(); f.store.close(); }
};

const verifyLocatorObservation = async (root: string, mode: "delayed" | "timeout" | "revoked" | "recorded", formalUrlDelayMs = 0): Promise<void> => {
  const f = submittedLocatorFixture(root), oldNow = Date.now;
  const startedAt = oldNow();
  let now = startedAt, reads = 0, revoked = false;
  Date.now = () => now;
  const actor = new BrowserCommandActor(new BrowserCommandAdmissionBudget(), { send: async () => { throw new Error("UNEXPECTED_NATIVE_DISPATCH"); } },
    f.store, { assertCurrentAuthority: () => undefined }, createRuntimeLogger({ producer: "locator-acceptance", owner: "browser-session",
      component: "browser-command", terminalEnabled: false, fileSink: { directoryPath: join(root, "logs") } }));
  const request = { binding: f.binding, step: f.step, targetRef: f.original.targetRef, submitCallId: "turn-submit",
    providerEffectIdentityHash: f.original.logicalMutationId!, timeoutMs: 15_000,
    assertCurrent: () => { if (revoked) throw new Error("REVOKED"); return f.original.documentRef; },
    execute: async () => { reads += 1; if (reads === 1) now += 40_000;
      const packet = f.packet(mode === "timeout" || mode === "delayed" && reads < 3
        || mode === "recorded" && now < startedAt + 5_000 + formalUrlDelayMs
        ? "https://chatgpt.com/c/local-chatgpt%3Atemporary" : "https://chatgpt.com/c/delayed-locator");
      if (mode === "revoked") revoked = true; return packet; }, wait: async (durationMs: number) => { now += durationMs; } };
  try {
    if (mode === "delayed" || mode === "recorded") {
      const located = await actor.readSubmittedConversationUrl(request);
      const expectedReads = mode === "recorded" ? 1 : 3;
      assert.equal(reads, expectedReads); assert.equal(now - startedAt >= 40_000, true);
      assert.equal(located.canonicalConversationUrl, "https://chatgpt.com/c/delayed-locator");
      assert.deepEqual(await actor.readSubmittedConversationUrl(request), located);
      assert.equal(reads, expectedReads, "cached locator must issue zero further page observations");
    } else {
      await assert.rejects(actor.readSubmittedConversationUrl(request), mode === "revoked" ? /REVOKED/u : /GPT_SUBMITTED_CONVERSATION_URL_INVALID/u);
      assert.equal(locatorOutcome(f).conversationLocator, null);
    }
    assert.equal(locatorOutcome(f).state, "confirmed"); assert.equal(locatorOutcome(f).physicalInputCount, 1);
    assert.deepEqual(locatorOutcome(f).terminalPayload, f.proof);
  } finally { Date.now = oldNow; f.store.close(); }
};

export const verifySubmittedConversationLocator = async (root: string): Promise<void> => {
  verifyLocatorCas(join(root, "locator-cas"));
  for (const mode of ["delayed", "timeout", "revoked"] as const) await verifyLocatorObservation(join(root, `locator-${mode}`), mode);
  for (const delay of [10_777, 1_386, 3_905, 2_738, 1_253, 835]) {
    await verifyLocatorObservation(join(root, `locator-recorded-${delay}`), "recorded", delay);
  }
};
