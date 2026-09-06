import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BrowserTargetLease } from "../../src/lib/browser/browser-authority-api.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import type { BrowserExecutionBinding } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserInfrastructureSupervisor } from "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import {
  browserExecutionFailure,
} from "../../src/lib/browser/browser-failure.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { binding, CONFIRMED_EXACT_HASH, fixtureLease, HASH } from
  "./browser-lane-fifo-support.js";
import { exerciseConfirmedReadbackRecovery } from
  "./browser-lane-confirmed-readback.acceptance-support.js";

const temporary = await mkdtemp(join(tmpdir(), "browser-lane-fifo-"));
let supervisor: BrowserInfrastructureSupervisor | null = null;
try {
  const logger = createRuntimeLogger({
    producer: "browser-lane-acceptance",
    owner: "browser-session",
    component: "browser-infrastructure",
    terminalEnabled: false,
    fileSink: { directoryPath: join(temporary, "runtime-logs") },
  });
  const mutationStore = new BrowserMutationStore(temporary);
  mutationStore.prepare({
    commandId: "historic-dispatched-command",
    exactCallIdentityHash: HASH,
    ownerPluginId: "plugin",
    pluginVersion: 1,
    jobId: "job:historic",
    attemptId: "attempt:job:historic",
    leaseVersion: 1,
    executionFenceHash: HASH,
    productStepId: "historic-step",
    childCapabilityId: "open_gpt_model_selector_v2",
    callId: "gpt-turn-flow.v3",
    effectScope: "target_local",
    actionOrdinal: 1,
    targetRef: "target:historic",
    documentRef: "document:historic",
    actionId: "browser.dom.click.v1",
    positivePostconditionHash: HASH,
    negativePostconditionHash: `sha256:${"b".repeat(64)}`,
    requestHash: HASH,
    payloadHash: HASH,
  });
  mutationStore.markDispatched("historic-dispatched-command");
  mutationStore.markReceiptMissing("historic-dispatched-command");
  mutationStore.prepare({
    commandId: "historic-confirmed-command",
    logicalMutationId: `sha256:${"f".repeat(64)}`,
    exactCallIdentityHash: `sha256:${"c".repeat(64)}`,
    ownerPluginId: "plugin",
    pluginVersion: 1,
    jobId: "job:confirmed",
    attemptId: "attempt:job:confirmed",
    leaseVersion: 1,
    executionFenceHash: HASH,
    productStepId: "confirmed-step",
    childCapabilityId: "submit_exact_gpt_turn_once",
    callId: "confirmed-submit",
    effectScope: "provider_effect",
    actionOrdinal: 1,
    targetRef: "target:confirmed",
    documentRef: "document:confirmed:1",
    actionId: "browser.dom.click.v1",
    positivePostconditionHash: HASH,
    negativePostconditionHash: `sha256:${"d".repeat(64)}`,
    requestHash: HASH,
    payloadHash: HASH,
  });
  mutationStore.markDispatched("historic-confirmed-command");
  mutationStore.markConfirmed("historic-confirmed-command", HASH);
  mutationStore.prepare({
    commandId: "historic-confirmed-target-local-command",
    exactCallIdentityHash: `sha256:${"e".repeat(64)}`,
    ownerPluginId: "plugin",
    pluginVersion: 1,
    jobId: "job:confirmed-target-local",
    attemptId: "attempt:job:confirmed-target-local",
    leaseVersion: 1,
    executionFenceHash: HASH,
    productStepId: "confirmed-target-local-step",
    childCapabilityId: "open_gpt_model_selector_v2",
    callId: "confirmed-target-local",
    effectScope: "target_local",
    actionOrdinal: 1,
    targetRef: "target:confirmed-target-local",
    documentRef: "document:confirmed-target-local",
    actionId: "browser.dom.click.v1",
    positivePostconditionHash: HASH,
    negativePostconditionHash: `sha256:${"f".repeat(64)}`,
    requestHash: HASH,
    payloadHash: HASH,
  });
  mutationStore.markDispatched("historic-confirmed-target-local-command");
  mutationStore.markConfirmed("historic-confirmed-target-local-command", HASH);
  mutationStore.close();
  supervisor = new BrowserInfrastructureSupervisor({
    dataDir: temporary,
    sourceFingerprint: HASH,
    profileConfig: {} as never,
    enrolledProfile: {} as never,
    releaseIdentity: {} as never,
    runtimeLogger: logger,
  });
  await supervisor.start();
  const confirmedFact = supervisor.readExactCallMutationFact({
    jobId: "job:confirmed",
    attemptId: "attempt:job:confirmed",
    ownerPluginId: "plugin",
    pluginVersion: 1,
    exactCallIdentityHash: CONFIRMED_EXACT_HASH,
    actionOrdinal: 1,
  });
  assert(confirmedFact?.terminalAt);
  const confirmedBinding = (): BrowserExecutionBinding => ({
    ...binding("job:confirmed", "confirmed-step", "image-readback"),
    kind: "production-reconciliation",
    confirmedProviderReadback: {
      schemaVersion: "browser-confirmed-provider-readback.v1",
      sourceAttemptId: "attempt:job:confirmed",
      sourceExactCallIdentityHash: CONFIRMED_EXACT_HASH,
      sourceActionOrdinal: 1,
      sourceProductStepId: "confirmed-step",
      sourceCallId: "confirmed-submit",
      sourceChildCapabilityId: "submit_exact_gpt_turn_once",
      sourceTargetRef: "target:confirmed",
      sourceDocumentRef: "document:confirmed:1",
      sourceTerminalAt: confirmedFact.terminalAt!,
      evidenceRef: "forensics:confirmed-submit",
      evidenceHash: HASH,
      canonicalConversationUrl: "https://chatgpt.com/c/confirmed-readback",
      conversationIdentityHash: HASH,
      promptHash: HASH,
      turnMarker: "[GRASSEYE:confirmed-readback]",
    },
  });
  const confirmedFailureBinding = (): BrowserExecutionBinding => ({
    ...binding("job:confirmed", "confirmed-step", "submission-reconcile"),
    kind: "production-confirmed-source-readback",
    confirmedProviderSourceReadback: {
      schemaVersion: "browser-confirmed-provider-source-readback.v1",
      sourceAttemptId: "attempt:job:confirmed",
      sourceExactCallIdentityHash: CONFIRMED_EXACT_HASH,
      sourceActionOrdinal: 1,
      sourceProductStepId: "confirmed-step",
      sourceCallId: "confirmed-submit",
      sourceChildCapabilityId: "submit_exact_gpt_turn_once",
      sourceTargetRef: "target:confirmed",
      sourceDocumentRef: "document:confirmed:1",
      sourceTerminalAt: confirmedFact.terminalAt!,
      evidenceRef: "forensics:confirmed-submit",
      evidenceHash: HASH,
      promptHash: HASH,
      turnMarker: "[GRASSEYE:confirmed-readback]",
    },
  });
  assert.equal(
    supervisor.readBrowserLaneState(),
    "blocked",
    "a historical DISPATCHED command must quarantine the sole Browser lane after restart",
  );
  assert.equal(
    supervisor.readBrowserReconciliationScope({
      jobId: "job:other",
      ownerPluginId: "plugin",
    }),
    null,
  );
  assert.equal(
    supervisor.readBrowserReconciliationScope({
      jobId: "job:historic",
      ownerPluginId: "wrong-plugin",
    }),
    null,
  );
  assert.equal(
    supervisor.readBrowserReconciliationScope({
      jobId: "job:historic",
      ownerPluginId: "plugin",
    })?.commandId,
    "historic-dispatched-command",
  );
  const acquisitions: string[] = [];
  const leaseIdentities = new Map<string, Readonly<{ targetRef: string; documentRef: string }>>();
  const brokerState: { targetStatus: "absent" | "claimed" } = { targetStatus: "claimed" };
  const broker = {
    currentOperatorTargetStatus: () => brokerState.targetStatus,
    revokeOperatorTargetClaim: () => {},
    acquireOperatorClaimedTargetLease: async (
      entry: BrowserExecutionBinding,
    ): Promise<BrowserTargetLease> => {
      acquisitions.push(entry.jobId);
      return fixtureLease(entry, async () => {
          if (entry.jobId === "job:unsettled") {
            throw browserExecutionFailure(new Error("BROWSER_TARGET_LIFECYCLE_UNSETTLED"), "no");
          }
        }, leaseIdentities.get(entry.jobId));
    },
  };
  assert.equal(Reflect.set(supervisor, "broker", broker), true);
  const lane = Reflect.get(supervisor, "lane") as object;
  const targetAcquirer = Reflect.get(lane, "targetAcquirer") as object;
  const targetAcquisitionRequests: Array<string | null> = [];
  assert.equal(Reflect.set(targetAcquirer, "acquireJobBoundTarget", async (
    _commandTtlMs: number,
    targetRef: string | null,
  ): Promise<void> => {
    targetAcquisitionRequests.push(targetRef);
    if (targetRef !== null) throw new Error("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
    brokerState.targetStatus = "claimed";
  }), true);

  const openSignal = new AbortController();
  const recovered = await supervisor.acquireJobBoundTargetLease(
    binding("job:historic", "historic-step", "gpt-turn-flow.v3"),
    "owner:historic",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  assert.deepEqual([recovered.target.targetRef, recovered.document.documentRef],
    ["target:historic", "document:historic"]);
  await recovered.park({ reason: "recovery-scope-proven", mode: "recovery" });
  assert.equal(supervisor.readBrowserLaneState(), "blocked",
    "recovery park must retain Browser-lane quarantine while releasing the upper execution");
  assert.deepEqual(supervisor.readCurrentTargetLocalReconciliationCandidate(), { jobId: "job:historic" },
    "Browser must derive the oldest target-local quarantine identity from its own WAL");
  assert.equal(await supervisor.reconcilePermanentlyRevokedTargetLocal({ jobId: "job:historic" }), "retained",
    "a still-claimed original Target/Document must remain DISPATCHED");

  let unrelatedResolved = false;
  const unrelatedWhileQuarantined = supervisor.acquireJobBoundTargetLease(
    binding("job:quarantined-unrelated"),
    "owner:quarantined-unrelated",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  ).then((lease) => {
    unrelatedResolved = true;
    return lease;
  });
  await Promise.resolve();
  assert.equal(unrelatedResolved, false);
  assert.deepEqual(acquisitions, ["job:historic"],
    "an unrelated Browser job must perform zero acquisition/navigation while DISPATCHED is unresolved");

  brokerState.targetStatus = "absent";
  assert.equal(await supervisor.reconcilePermanentlyRevokedTargetLocal({ jobId: "job:historic" }), "settled",
    "an exact physical-absence result must terminalize the target-local DISPATCHED row without replay");
  assert.equal(targetAcquisitionRequests[0], "target:historic",
    "background reconciliation must probe only the exact WAL-owned Target identity");
  assert.equal(supervisor.readBrowserReconciliationScope({
    jobId: "job:historic", ownerPluginId: "plugin",
  }), null);
  const releasedUnrelated = await unrelatedWhileQuarantined;
  assert.equal(unrelatedResolved, true,
    "the existing FIFO must resume after Browser has terminalized the quarantined mutation");
  await releasedUnrelated.close({ reason: "quarantine-terminalized" });
  leaseIdentities.delete("job:historic");

  const liveMutationStore = Reflect.get(
    Reflect.get(supervisor, "state") as object,
    "mutationState",
  ) as BrowserMutationStore;
  liveMutationStore.prepare({
    commandId: "claim-proven-lost-command",
    exactCallIdentityHash: `sha256:${"9".repeat(64)}`,
    ownerPluginId: "plugin",
    pluginVersion: 1,
    jobId: "job:claim-proven-lost",
    attemptId: "attempt:job:claim-proven-lost",
    leaseVersion: 1,
    executionFenceHash: HASH,
    productStepId: "claim-proven-step",
    childCapabilityId: "open_gpt_model_selector_v2",
    callId: "claim-proven-call",
    effectScope: "target_local",
    actionOrdinal: 1,
    targetRef: "target:claim-proven",
    documentRef: "document:claim-proven:old",
    actionId: "browser.dom.click.v1",
    positivePostconditionHash: HASH,
    negativePostconditionHash: `sha256:${"8".repeat(64)}`,
    requestHash: HASH,
    payloadHash: HASH,
  });
  liveMutationStore.markDispatched("claim-proven-lost-command");
  const laneControl = lane as Readonly<{
    reset(): void;
    observeCurrentTargetClaim(input: Readonly<{ targetRef: string; documentRef: string }>): void;
  }>;
  laneControl.reset();
  assert.equal(supervisor.readBrowserLaneState(), "blocked");
  const acquisitionsBeforeClaimSettlement = acquisitions.length;
  laneControl.observeCurrentTargetClaim({
    targetRef: "target:claim-proven",
    documentRef: "document:claim-proven:new",
  });
  assert.equal(supervisor.readBrowserLaneState(), "idle");
  assert.equal(acquisitions.length, acquisitionsBeforeClaimSettlement,
    "an authenticated current Target/Document claim must settle the lost target-local row with zero navigation/mutation");
  assert.deepEqual(liveMutationStore.readExactCallMutationFact({
    jobId: "job:claim-proven-lost",
    attemptId: "attempt:job:claim-proven-lost",
    ownerPluginId: "plugin",
    pluginVersion: 1,
    exactCallIdentityHash: `sha256:${"9".repeat(64)}`,
    actionOrdinal: 1,
  })?.outcome, "REJECTED");
  const runtimeLogPath = logger.currentSegmentPath();
  assert.ok(runtimeLogPath, "Browser lane acceptance must retain a durable Runtime Log segment");
  const rejectedMutationEvents = (await readFile(runtimeLogPath, "utf8")).trim().split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Readonly<{
      code?: string;
      typedIdentity?: Readonly<{ commandId?: string }>;
    }>)
    .filter((event) => event.code === "BROWSER_MUTATION_REJECTED"
      && event.typedIdentity?.commandId === "claim-proven-lost-command");
  assert.equal(rejectedMutationEvents.length, 1,
    "target-local lost-document settlement must project exactly one BROWSER_MUTATION_REJECTED Runtime Log event");

  liveMutationStore.prepare({
    commandId: "log-failure-after-terminal-command",
    exactCallIdentityHash: `sha256:${"7".repeat(64)}`,
    ownerPluginId: "plugin",
    pluginVersion: 1,
    jobId: "job:log-failure-after-terminal",
    attemptId: "attempt:job:log-failure-after-terminal",
    leaseVersion: 1,
    executionFenceHash: HASH,
    productStepId: "log-failure-step",
    childCapabilityId: "open_gpt_model_selector_v2",
    callId: "log-failure-call",
    effectScope: "target_local",
    actionOrdinal: 1,
    targetRef: "target:log-failure",
    documentRef: "document:log-failure",
    actionId: "browser.dom.click.v1",
    positivePostconditionHash: HASH,
    negativePostconditionHash: `sha256:${"6".repeat(64)}`,
    requestHash: HASH,
    payloadHash: HASH,
  });
  liveMutationStore.markDispatched("log-failure-after-terminal-command");
  laneControl.reset();
  brokerState.targetStatus = "absent";
  assert.equal(Reflect.set(lane, "runtimeLogger", {
    emitEvent: () => ({
      ok: false, code: "RUNTIME_LOG_SINK_WRITE_FAILED", emergencyProjected: false,
    }),
  }), true);
  await assert.rejects(
    supervisor.reconcilePermanentlyRevokedTargetLocal({ jobId: "job:log-failure-after-terminal" }),
    /RUNTIME_LOG_SINK_WRITE_FAILED/u,
  );
  assert.equal(supervisor.readBrowserLaneState(), "idle",
    "a post-WAL Runtime Log failure must not preserve a stale in-memory quarantine");
  assert.equal(supervisor.readBrowserReconciliationScope({
    jobId: "job:log-failure-after-terminal", ownerPluginId: "plugin",
  }), null);
  assert.equal(await supervisor.reconcilePermanentlyRevokedTargetLocal({
    jobId: "job:log-failure-after-terminal",
  }), "settled", "the terminal WAL row must never be transitioned a second time");
  assert.equal(Reflect.set(lane, "runtimeLogger", logger), true);
  brokerState.targetStatus = "claimed";

  await exerciseConfirmedReadbackRecovery({
    supervisor,
    openSignal,
    confirmedBinding,
    confirmedFailureBinding,
    leaseIdentities,
    targetAcquisitionRequests,
    brokerState,
    acquisitions,
  });
} finally {
  await supervisor?.stop();
  await rm(temporary, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][browser-lane-fifo] PASS\n");
