import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BrowserMutationStore,
  type BrowserMutationIdentity,
} from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { ensureCurrentSchema } from "../../src/lib/browser/exact-target/browser-mutation-schema.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const identity = (attemptId: string, revision = 0): BrowserMutationIdentity => Object.freeze({
  commandId: `command:${attemptId}:${revision}`,
  logicalMutationId: hash(`provider-effect:${revision}`),
  exactCallIdentityHash: hash(`exact-call:${revision}`),
  jobId: "job:fresh-attempt",
  resultRevision: revision,
  attemptId,
  leaseVersion: attemptId === "attempt:1" ? 1 : 2,
  executionFenceHash: hash(`fence:${attemptId}`),
  productStepId: "provider-submit",
  callId: "submit-once",
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
  const recovered = store.readAtomicStepOutcome({
    jobId: second.jobId, attemptId: second.attemptId, exactCallIdentityHash: second.exactCallIdentityHash,
    actionOrdinal: second.actionOrdinal, targetRef: second.targetRef, effectScope: "provider_effect",
  });
  assert.equal(recovered?.state, "confirmed");
  assert.equal(recovered?.providerEffectIdentityHash, first.logicalMutationId);
  assert.deepEqual(recovered?.terminalPayload, terminalPayload);
  store.close();

  const restarted = new BrowserMutationStore(root);
  const restartedOutcome = restarted.readAtomicStepOutcome({
    jobId: second.jobId, attemptId: second.attemptId, exactCallIdentityHash: second.exactCallIdentityHash,
    actionOrdinal: second.actionOrdinal, targetRef: second.targetRef, effectScope: "provider_effect",
  });
  assert.deepEqual(restartedOutcome?.terminalPayload, terminalPayload,
    "confirmed submit payload survives Browser restart for the same effect readback");
  assert.equal(restartedOutcome?.providerEffectIdentityHash, first.logicalMutationId,
    "the public typed outcome carries the Browser-owned provider effect identity");
  assert.doesNotThrow(() => restarted.prepare(identity("attempt:2", 1)),
    "a Website-authorized new result revision receives a new provider effect");
  const rejectedNoInput = identity("attempt:1", 2);
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
  const retriedNoInput = identity("attempt:2", 2);
  assert.doesNotThrow(() => restarted.prepare(retriedNoInput),
    "the new attempt may prepare the same provider effect after proven zero physical input");
  restarted.markDispatched(retriedNoInput.commandId);
  restarted.markConfirmed(retriedNoInput.commandId, hash("retried-terminal"), "confirmed", terminalPayload);
  assert.equal(noInputOutcome("attempt:3")?.state, "confirmed",
    "a consumed provider effect must block every later attempt");
  restarted.close();
} finally {
  await rm(root, { recursive: true, force: true });
}

process.stdout.write("LOCAL_BROWSER_ATTEMPT_FENCE_ACCEPTANCE_PASS\n");
