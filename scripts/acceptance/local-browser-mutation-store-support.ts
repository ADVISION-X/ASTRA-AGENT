import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { BrowserMutationStore } from
  "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { ensureCurrentSchema } from
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

const verifyObsoleteSchemaFailsClosed = (root: string): void => {
  const obsoleteRoot = join(root, "obsolete-nonempty");
  const obsolete = new BrowserMutationStore(obsoleteRoot);
  obsolete.prepare(identity("obsolete-rejected-command", "obsolete-job"));
  obsolete.markDispatched("obsolete-rejected-command");
  obsolete.markRejected("obsolete-rejected-command", hash);
  obsolete.close();
  const database = new Database(join(obsoleteRoot, "browser", "browser-mutations.sqlite"));
  database.exec("alter table browser_mutations drop column mutation_outcome");
  database.exec("alter table browser_mutations drop column native_cause_code");
  const columnsBefore = (database.prepare("pragma table_info(browser_mutations)").all() as Array<{ name: string }>)
    .map((column) => column.name).sort();
  assert.throws(() => ensureCurrentSchema(database), /BROWSER_MUTATION_SCHEMA_REBUILD_REQUIRES_EMPTY_STORE/u,
    "a nonempty obsolete Browser WAL must fail closed instead of entering a compatibility migration");
  const columnsAfter = (database.prepare("pragma table_info(browser_mutations)").all() as Array<{ name: string }>)
    .map((column) => column.name).sort();
  assert.deepEqual(columnsAfter, columnsBefore, "schema admission failure must not mutate the obsolete WAL");
  database.close();
};

export const exerciseBrowserMutationStore = (root: string): void => {
  prepareRestartFixture(root);
  const restarted = new BrowserMutationStore(root);
  verifyJobScopedReconciliation(restarted);
  restarted.close();
  verifyTerminalRestart(root);
  verifyObsoleteSchemaFailsClosed(root);
};
