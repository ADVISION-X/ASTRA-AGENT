import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";

export const hash = `sha256:${"a".repeat(64)}` as const;
export const exactHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const identity = (commandId: string, attemptId: string, executionFenceHash = hash) => ({
  commandId,
  exactCallIdentityHash: exactHash(`${attemptId}:${commandId}`),
  jobId: "job-1",
  resultRevision: 0,
  attemptId,
  leaseVersion: 1,
  executionFenceHash,
  productStepId: "step-1",
  childCapabilityId: "open_gpt_model_selector_v2",
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
  first.prepare(identity("old-command", "attempt-1"));
  first.markDispatched("old-command");
  first.close();

  const restarted = new BrowserMutationStore(root);
  assert.deepEqual(restarted.dispatchedForBinding({
    jobId: "job-1", attemptId: "attempt-2", leaseVersion: 1, executionFenceHash: hash,
  }), [], "a new attempt must not inherit old pending mutations");
  assert.throws(() => restarted.settleRetiredTargetLocal({
    jobId: "job-1", attemptId: "attempt-2", writerFenceHash: hash,
  }), /BROWSER_MUTATION_UNSETTLED/u, "the current fence cannot retire itself");
  const nextFence = `sha256:${"b".repeat(64)}` as const;
  assert.equal(restarted.settleRetiredTargetLocal({
    jobId: "job-1", attemptId: "attempt-2", writerFenceHash: nextFence,
  })?.commandId, "old-command");
  assert.equal(restarted.readState("old-command"), "REJECTED");
  assert.equal(restarted.readMutationOutcome("old-command"), "dispatched");
  restarted.prepare(identity("new-command", "attempt-2", nextFence));
  restarted.markDispatched("new-command");
  assert.deepEqual(restarted.dispatchedForBinding({
    jobId: "job-1", attemptId: "attempt-2", leaseVersion: 1, executionFenceHash: nextFence,
  }), ["new-command"]);
  restarted.close();

  const provider = new BrowserMutationStore(join(root, "provider-case"));
  const providerIdentity = { ...identity("provider-command", "attempt-provider"),
    effectScope: "provider_effect" as const, logicalMutationId: exactHash("provider-effect"),
    childCapabilityId: "submit_exact_gpt_turn_once" };
  provider.prepare(providerIdentity);
  provider.markDispatched(providerIdentity.commandId);
  assert.deepEqual(provider.dispatchedForBinding({ jobId: "job-1", attemptId: "attempt-provider",
    leaseVersion: 2, executionFenceHash: nextFence }), [providerIdentity.commandId],
  "same-attempt provider DISPATCHED must bind readback across fences");
  assert.equal(provider.settleRetiredTargetLocal({ jobId: "job-1", attemptId: "attempt-provider",
    writerFenceHash: nextFence }).effectScope, "provider_effect");
  assert.equal(provider.readState(providerIdentity.commandId), "DISPATCHED",
    "provider readback admission must not terminalize or rewrite the unknown effect");
  assert.throws(() => provider.settleRetiredTargetLocal({ jobId: "job-1", attemptId: "other-attempt",
    writerFenceHash: nextFence }), /BROWSER_MUTATION_UNSETTLED/u);
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
