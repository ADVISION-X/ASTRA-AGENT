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

const historyIdentity = (
  attemptId: string,
  overrides: Partial<BrowserMutationIdentity> = {},
): BrowserMutationIdentity => Object.freeze({
  commandId: `command:provider-history:${attemptId}`,
  logicalMutationId: hash("provider-effect-history"),
  exactCallIdentityHash: hash(`provider-exact:${attemptId}`),
  ownerPluginId: "acceptance-product",
  pluginVersion: 1,
  jobId: "job:provider-effect-history",
  attemptId,
  leaseVersion: 1,
  executionFenceHash: hash(`execution-fence:${attemptId}`),
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
  requestHash: hash("request"),
  payloadHash: hash("payload"),
  ...overrides,
});

const seedHistory = (
  store: BrowserMutationStore,
  identity: BrowserMutationIdentity,
  state: "PREPARED" | "FAILED" | "DISPATCHED" | "CONFIRMED" | "REJECTED_NO"
    | "REJECTED_DISPATCHED" | "REJECTED_CONFIRMED",
): void => {
  store.prepare(identity);
  if (state === "PREPARED") return;
  if (state === "FAILED") {
    store.markFailedBeforeDispatch(identity.commandId, "BROWSER_COMMAND_NOT_DISPATCHED");
    return;
  }
  store.markDispatched(identity.commandId);
  if (state === "DISPATCHED") return;
  if (state === "CONFIRMED") {
    store.markConfirmed(identity.commandId, hash("direct-proof"));
    return;
  }
  const outcome = state === "REJECTED_NO" ? "no"
    : state === "REJECTED_DISPATCHED" ? "dispatched" : "confirmed";
  store.markRejected(identity.commandId, hash(`rejected-proof:${outcome}`), outcome);
};

const withHistoryStore = async (
  label: string,
  exercise: (store: BrowserMutationStore) => void,
): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), `browser-provider-history-${label}-`));
  const store = new BrowserMutationStore(root);
  try { exercise(store); }
  finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

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
      /BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN/u);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

await exerciseRestart("CONFIRMED");
await exerciseRestart("DISPATCHED");

await withHistoryStore("zero", (store) => {
  store.prepare(historyIdentity("attempt:new"));
  assert.equal(store.readState("command:provider-history:attempt:new"), "PREPARED");
});

await withHistoryStore("rejected-no", (store) => {
  seedHistory(store, historyIdentity("attempt:old-1"), "REJECTED_NO");
  seedHistory(store, historyIdentity("attempt:old-2"), "REJECTED_NO");
  store.prepare(historyIdentity("attempt:new"));
  assert.equal(store.readState("command:provider-history:attempt:new"), "PREPARED",
    "only distinct older REJECTED + no attempts may admit a Website-issued new attempt");
});

await withHistoryStore("failed-before-dispatch", (store) => {
  seedHistory(store, historyIdentity("attempt:old"), "FAILED");
  store.prepare(historyIdentity("attempt:new"));
  assert.equal(store.readState("command:provider-history:attempt:new"), "PREPARED",
    "a pre-dispatch FAILED row must not claim a physical provider effect");
});

for (const state of [
  "PREPARED", "DISPATCHED", "CONFIRMED", "REJECTED_DISPATCHED", "REJECTED_CONFIRMED",
] as const) {
  await withHistoryStore(state.toLowerCase(), (store) => {
    seedHistory(store, historyIdentity("attempt:old"), state);
    assert.throws(() => store.prepare(historyIdentity("attempt:new")),
      /BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN/u,
      `${state} provider history must block before a new PREPARED row`);
  });
}

await withHistoryStore("current-attempt", (store) => {
  seedHistory(store, historyIdentity("attempt:same"), "REJECTED_NO");
  assert.throws(() => store.prepare(historyIdentity("attempt:same", {
    commandId: "command:provider-history:attempt:same:duplicate",
  })), /BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN/u,
  "the current accepted attempt must never get a second provider-effect row");
});

await withHistoryStore("identity-collision", (store) => {
  seedHistory(store, historyIdentity("attempt:old"), "REJECTED_NO");
  assert.throws(() => store.prepare(historyIdentity("attempt:new", {
    payloadHash: hash("payload-drift-under-same-logical-id"),
  })), /BROWSER_PROVIDER_EFFECT_HISTORY_AMBIGUOUS/u,
  "a logical-id collision with different identity fields must fail closed");
});
