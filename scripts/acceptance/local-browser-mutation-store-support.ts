import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { BrowserMutationStore } from
  "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { identityColumns, mutationAuthorityHash } from
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

const verifyLegacyMigration = (root: string): void => {
  const legacyRoot = join(root, "legacy-nonempty");
  const legacy = new BrowserMutationStore(legacyRoot);
  legacy.prepare(identity("legacy-rejected-command", "legacy-job"));
  legacy.markDispatched("legacy-rejected-command");
  legacy.markRejected("legacy-rejected-command", hash);
  legacy.close();
  const legacyFile = join(legacyRoot, "browser", "browser-mutations.sqlite");
  const legacyDatabase = new Database(legacyFile);
  const identityBefore = legacyDatabase.prepare(
    "select command_id,exact_call_identity_hash,state,terminal_at from browser_mutations",
  ).get();
  legacyDatabase.exec("alter table browser_mutations drop column mutation_outcome");
  legacyDatabase.exec("alter table browser_mutations drop column native_cause_code");
  const legacyAuthorityHash = mutationAuthorityHash(legacyDatabase.prepare(
    `select ${identityColumns},proof_hash,state,reason,terminal_at,updated_at from browser_mutations`,
  ).get());
  legacyDatabase.close();
  const migratedLegacy = new BrowserMutationStore(legacyRoot);
  assert.equal(migratedLegacy.authorityHash("legacy-rejected-command"), legacyAuthorityHash,
    "adding mutation outcome and native cause must not invalidate an already-issued legacy Browser authority hash");
  assert.deepEqual(migratedLegacy.readExactCallMutationFact({
    jobId: "legacy-job", attemptId: "attempt-1", ownerPluginId: "fixture-product-plugin",
    pluginVersion: 1, exactCallIdentityHash: exactHash("legacy-rejected-command"), actionOrdinal: 1,
  }), {
    effectScope: "target_local", outcome: "REJECTED", mutationOutcome: "confirmed",
    terminalAt: (identityBefore as { terminal_at: string }).terminal_at,
    failureCode: "BROWSER_POSTCONDITION_FAILED", nativeFailureCode: null,
    authorityRef: "browser-mutation:legacy-rejected-command", authorityHash: legacyAuthorityHash,
    targetRef: "target-1", documentRef: "document-1",
    productStepId: "report_translation:candidate_a", callId: "gpt-turn-flow.v3",
    childCapabilityId: "open_gpt_model_selector_v2", actionOrdinal: 1,
  });
  const migratedDatabase = new Database(legacyFile, { readonly: true });
  assert.deepEqual(migratedDatabase.prepare(
    "select command_id,exact_call_identity_hash,state,terminal_at from browser_mutations",
  ).get(), identityBefore, "the forward ALTER migration must preserve every legacy identity and terminal byte");
  migratedDatabase.close();
  migratedLegacy.close();
};

export const exerciseBrowserMutationStore = (root: string): void => {
  prepareRestartFixture(root);
  const restarted = new BrowserMutationStore(root);
  verifyJobScopedReconciliation(restarted);
  restarted.close();
  verifyTerminalRestart(root);
  verifyLegacyMigration(root);
};
