import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import path, { join } from "node:path";
import Database from "better-sqlite3";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { ensureCurrentSchema } from "../../src/lib/browser/exact-target/browser-mutation-schema.js";

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
  assert.throws(() => restarted.prepare(identity("new-command", "attempt-2", nextFence)),
    /BROWSER_MUTATION_UNSETTLED/u,
    "a new fence must not bypass a globally unresolved Browser writer");
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
  provider.resolve({ commandId: providerIdentity.commandId, targetRef: providerIdentity.targetRef,
    state: "CONFIRMED", mutationOutcome: "confirmed", proofHash: exactHash("fresh-provider-postcondition") });
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
  store.markRejected(walIdentity.commandId, exactHash("postcondition-rejection"), "confirmed",
    "BROWSER_POSTCONDITION_FAILED", "BROWSER_POSTCONDITION_Q0__NO_LAYOUT_BOX");
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
