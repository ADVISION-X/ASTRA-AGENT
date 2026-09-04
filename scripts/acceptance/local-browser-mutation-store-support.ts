import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { BrowserMutationStore } from
  "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { ensureCurrentSchema, identityColumns } from
  "../../src/lib/browser/exact-target/browser-mutation-schema.js";

export const hash = `sha256:${"a".repeat(64)}` as const;
export const negativeHash = `sha256:${"b".repeat(64)}` as const;
export const exactHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const valueHash = (value: unknown): `sha256:${string}` => exactHash(JSON.stringify(value));

export const identity = (
  commandId: string,
  jobId = "job-1",
  ownerPluginId = "fixture-product-plugin",
) => ({
  commandId, exactCallIdentityHash: exactHash(commandId), ownerPluginId, pluginVersion: 1, jobId,
  attemptId: "attempt-1", leaseVersion: 1, executionFenceHash: hash,
  productStepId: "report_translation:candidate_a", childCapabilityId: "open_gpt_model_selector_v2",
  callId: "gpt-turn-flow.v3", effectScope: "target_local" as const, actionOrdinal: 1,
  targetRef: "target-1", documentRef: "document-1", actionId: "browser.dom.click.v1",
  positivePostconditionHash: hash, negativePostconditionHash: negativeHash,
  requestHash: hash, payloadHash: hash,
});

const prepareRestartFixture = (root: string): void => {
  const first = new BrowserMutationStore(root);
  first.prepare(identity("dispatched-command"));
  first.markDispatched("dispatched-command");
  first.markReceiptMissing("dispatched-command");
  first.prepare(identity("prepared-command"));
  first.close();
};

const verifyJobScopedReconciliation = (restarted: BrowserMutationStore): void => {
  assert.deepEqual(restarted.reconciliationStates()
    .map((entry) => [entry.mutation.commandId, entry.current])
    .sort((left, right) => left[0]!.localeCompare(right[0]!)), [
    ["dispatched-command", "DISPATCHED"], ["prepared-command", "FAILED"],
  ]);
  assert.deepEqual(restarted.dispatchedForBinding({
    jobId: "job-1", attemptId: "attempt-1", leaseVersion: 1, executionFenceHash: hash,
  }), ["dispatched-command"]);
  assert.equal(restarted.reconciliationScope({
    jobId: "job-2", ownerPluginId: "fixture-product-plugin",
  }), null, "DISPATCHED reconciliation must be scoped to the owning job");
  assert.deepEqual(restarted.reconciliationScope({
    jobId: "job-1", ownerPluginId: "fixture-product-plugin",
  }), {
    commandId: "dispatched-command", ownerPluginId: "fixture-product-plugin", jobId: "job-1",
    targetRef: "target-1", documentRef: "document-1", payloadHash: hash,
  });
  restarted.prepare(identity("second-dispatched-command"));
  restarted.markDispatched("second-dispatched-command");
  restarted.markReceiptMissing("second-dispatched-command");
  assert.throws(() => restarted.reconciliationScope({
    jobId: "job-1", ownerPluginId: "fixture-product-plugin",
  }), /BROWSER_RECONCILIATION_SCOPE_AMBIGUOUS/u,
  "multiple DISPATCHED mutations in one job must fail closed without affecting other jobs");
  restarted.resolve({
    commandId: "second-dispatched-command", ownerPluginId: "fixture-product-plugin",
    targetRef: "target-1", state: "REJECTED", mutationOutcome: "dispatched", proofHash: hash,
  });
  assert.equal(restarted.readMutationOutcome("second-dispatched-command"), "dispatched",
    "owning-plugin reconciliation must not invent proof that a physical input occurred");
  assert.equal(restarted.readDispatched("prepared-command"), null);
  restarted.resolve({
    commandId: "dispatched-command", ownerPluginId: "fixture-product-plugin",
    targetRef: "target-1", state: "CONFIRMED", mutationOutcome: "dispatched", proofHash: hash,
  });
  assert.equal(restarted.readMutationOutcome("dispatched-command"), "dispatched",
    "semantic terminal readback must not invent a physical-input fact after a lost reply");
  assert.deepEqual(restarted.dispatchedForBinding({
    jobId: "job-1", attemptId: "attempt-1", leaseVersion: 1, executionFenceHash: hash,
  }), []);
};

const verifyTerminalRestart = (root: string): void => {
  const terminalRestart = new BrowserMutationStore(root);
  assert.deepEqual(terminalRestart.reconciliationStates()
    .map((entry) => [entry.mutation.commandId, entry.current])
    .sort((left, right) => left[0]!.localeCompare(right[0]!)), [
    ["dispatched-command", "CONFIRMED"], ["prepared-command", "FAILED"],
    ["second-dispatched-command", "REJECTED"],
  ]);
  terminalRestart.close();
};

const verifyNonemptyForwardSchemaMigration = (root: string): void => {
  const migrationRoot = join(root, "nonempty-forward-migration");
  const beforeMigration = new BrowserMutationStore(migrationRoot);
  beforeMigration.prepare(identity("migrated-rejected-command", "migration-job"));
  beforeMigration.markDispatched("migrated-rejected-command");
  beforeMigration.markRejected("migrated-rejected-command", hash);
  beforeMigration.close();
  const database = new Database(join(migrationRoot, "browser", "browser-mutations.sqlite"));
  const durableBefore = database.prepare(
    `select ${identityColumns},proof_hash,state,reason,terminal_at,updated_at from browser_mutations`,
  ).get();
  database.exec("alter table browser_mutations drop column mutation_outcome");
  database.exec("alter table browser_mutations drop column native_cause_code");
  ensureCurrentSchema(database);
  const durableAfter = database.prepare(
    `select ${identityColumns},proof_hash,state,reason,terminal_at,updated_at from browser_mutations`,
  ).get();
  assert.deepEqual(durableAfter, durableBefore,
    "the forward migration must preserve every nonempty WAL identity, terminal, proof, and timestamp byte");
  assert.deepEqual(database.prepare(
    "select mutation_outcome,native_cause_code from browser_mutations",
  ).get(), { mutation_outcome: "confirmed", native_cause_code: null },
  "the one-time migration must materialize current mechanical fields before normal reads resume");
  database.prepare("update browser_mutations set mutation_outcome=null").run();
  database.close();
  const migrated = new BrowserMutationStore(migrationRoot);
  assert.equal(migrated.readMutationOutcome("migrated-rejected-command"), "confirmed",
    "an already-added legacy column with an unfinished null row must complete the same in-place backfill");
  migrated.close();
};

export const exerciseBrowserMutationStore = (root: string): void => {
  prepareRestartFixture(root);
  const restarted = new BrowserMutationStore(root);
  verifyJobScopedReconciliation(restarted);
  restarted.close();
  verifyTerminalRestart(root);
  verifyNonemptyForwardSchemaMigration(root);
};
