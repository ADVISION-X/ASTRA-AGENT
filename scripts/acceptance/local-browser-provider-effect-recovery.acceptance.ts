import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BrowserMutationStore,
  type BrowserMutationIdentity,
} from "../../src/lib/browser/exact-target/browser-mutation-store.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const mutationIdentity = (
  initial: "DISPATCHED" | "CONFIRMED",
): BrowserMutationIdentity => Object.freeze({
  commandId: `command:browser-provider-recovery:${initial.toLowerCase()}`,
  logicalMutationId: hash(`exact:${initial}`),
  exactCallIdentityHash: hash(`exact:${initial}`),
  ownerPluginId: "acceptance-product",
  pluginVersion: 1,
  jobId: `job:browser-provider-recovery:${initial.toLowerCase()}`,
  attemptId: `attempt:browser-provider-recovery:${initial.toLowerCase()}`,
  leaseVersion: 1,
  executionFenceHash: hash("execution-fence"),
  productStepId: "provider-submit",
  callId: "submit-once",
  childCapabilityId: "submit_exact_gpt_turn_once",
  effectScope: "provider_effect",
  actionOrdinal: 1,
  targetRef: `target:${initial.toLowerCase()}`,
  documentRef: `document:${initial.toLowerCase()}`,
  actionId: "browser.dom.click.v1",
  positivePostconditionHash: hash("positive"),
  negativePostconditionHash: hash("negative"),
  requestHash: hash("request"),
  payloadHash: hash("payload"),
});

const exerciseRestart = async (initial: "DISPATCHED" | "CONFIRMED"): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), `browser-provider-recovery-${initial.toLowerCase()}-`));
  const identity = mutationIdentity(initial);
  const { attemptId, commandId, exactCallIdentityHash, jobId, targetRef } = identity;
  const recoveryQuery = Object.freeze({
    jobId,
    attemptId,
    ownerPluginId: identity.ownerPluginId,
    pluginVersion: identity.pluginVersion,
    exactCallIdentityHash,
    actionOrdinal: identity.actionOrdinal,
    targetRef,
    effectScope: "provider_effect" as const,
  });
  let dispatches = 0;
  let readbacks = 0;
  let store = new BrowserMutationStore(root);
  try {
    store.prepare(identity);
    store.markDispatched(commandId);
    dispatches += 1;
    if (initial === "CONFIRMED") store.markConfirmed(commandId, hash("direct-proof"));
    assert.equal(store.readState(commandId), initial);
    store.close();

    store = new BrowserMutationStore(root);
    const recovery = store.atomicStepRecovery(recoveryQuery);
    assert(recovery, "restart must recover the exact provider-effect WAL row");
    assert.equal(recovery.state, initial.toLowerCase());
    assert.equal(recovery.targetRef, targetRef);
    assert.equal(recovery.documentRef, identity.documentRef);
    if (recovery.state === "dispatched") {
      readbacks += 1;
      store.resolve({
        commandId,
        ownerPluginId: identity.ownerPluginId,
        targetRef,
        state: "CONFIRMED",
        mutationOutcome: "dispatched",
        proofHash: hash("reconciled-proof"),
      });
    }
    assert.equal(store.readState(commandId), "CONFIRMED");
    assert.equal(store.countProviderTurnDispatches(jobId, attemptId), 1);
    assert.equal(dispatches, 1, "restart recovery must never redispatch the provider effect");
    assert.equal(readbacks, initial === "DISPATCHED" ? 1 : 0,
      "only an unresolved dispatch may perform one owning Browser readback");

    const terminal = store.atomicStepRecovery(recoveryQuery);
    assert.equal(terminal?.state, "confirmed");
    assert.equal(terminal?.terminalAt === null, false);
    assert.throws(() => store.prepare({ ...identity, commandId: `${commandId}:duplicate` }),
      /BROWSER_(LOGICAL_MUTATION|EXACT_CALL)_REPLAY_FORBIDDEN/u);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

await exerciseRestart("CONFIRMED");
await exerciseRestart("DISPATCHED");
