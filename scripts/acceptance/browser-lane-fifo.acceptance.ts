import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BrowserTargetLease } from "../../src/lib/browser/browser-authority-api.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import type { BrowserExecutionBinding } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserInfrastructureSupervisor } from "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import {
  browserExecutionFailure,
  typedBrowserExecutionFailure,
} from "../../src/lib/browser/browser-failure.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { binding, CONFIRMED_EXACT_HASH, fixtureLease, HASH } from "./browser-lane-fifo-support.js";

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
  assert.equal(
    supervisor.readBrowserLaneState(),
    "idle",
    "a historical job-scoped DISPATCHED command must not deadlock unrelated jobs after restart",
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
  let brokerTargetStatus: "absent" | "claimed" = "claimed";
  const broker = {
    currentOperatorTargetStatus: () => brokerTargetStatus,
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
  const targetAcquisitionRequests: Array<string | null> = [];
  assert.equal(Reflect.set(lane, "acquireJobBoundTarget", async (
    _commandTtlMs: number,
    targetRef: string | null,
  ): Promise<void> => {
    targetAcquisitionRequests.push(targetRef);
    if (targetRef !== null) throw new Error("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
    brokerTargetStatus = "claimed";
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

  leaseIdentities.set("job:historic", {
    targetRef: "target:historic", documentRef: "document:historic:changed",
  });
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:historic", "historic-step", "gpt-turn-flow.v3"), "owner:historic:wrong-document",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    (error) => {
      const failure = typedBrowserExecutionFailure(error);
      assert.equal(failure?.code, "BROWSER_DOCUMENT_INVALID");
      assert.equal(failure?.mutationOutcome, "dispatched");
      return true;
    },
    "DISPATCHED recovery must retain the original Target and Document",
  );
  leaseIdentities.set("job:historic", {
    targetRef: "target:historic:changed", documentRef: "document:historic",
  });
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:historic", "historic-step", "gpt-turn-flow.v3"), "owner:historic:wrong-target",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    /BROWSER_DOCUMENT_INVALID/u,
  );
  leaseIdentities.delete("job:historic");

  leaseIdentities.set("job:confirmed", {
    targetRef: "target:confirmed", documentRef: "document:confirmed:2",
  });
  const confirmedNewDocument = await supervisor.acquireJobBoundTargetLease(
    binding("job:confirmed", "confirmed-step", "confirmed-submit"),
    "owner:confirmed:new-document",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  assert.deepEqual(
    [confirmedNewDocument.target.targetRef, confirmedNewDocument.document.documentRef],
    ["target:confirmed", "document:confirmed:2"],
    "CONFIRMED recovery may advance Document while retaining the exact Target",
  );
  await confirmedNewDocument.park({ reason: "confirmed-document-advanced", mode: "normal-provider-wait" });
  leaseIdentities.set("job:confirmed", {
    targetRef: "target:confirmed:changed", documentRef: "document:confirmed:3",
  });
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:confirmed", "confirmed-step", "confirmed-submit"),
      "owner:confirmed:wrong-target",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    (error) => {
      const failure = typedBrowserExecutionFailure(error);
      assert.equal(failure?.code, "BROWSER_DOCUMENT_INVALID");
      assert.equal(failure?.mutationOutcome, "confirmed");
      return true;
    },
    "a claimed but mismatched Target is not proof that the original physical Target was lost",
  );
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:confirmed", "confirmed-step", "submission-reconcile"),
      "owner:confirmed:later-readback",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    (error) => {
      const failure = typedBrowserExecutionFailure(error);
      assert.equal(failure?.code, "BROWSER_DOCUMENT_INVALID");
      assert.equal(failure?.mutationOutcome, "no");
      return true;
    },
    "a prior confirmed submit must not relabel a later read-only call failure as confirmed",
  );
  brokerTargetStatus = "absent";
  targetAcquisitionRequests.length = 0;
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:confirmed", "confirmed-step", "confirmed-submit"),
      "owner:confirmed:wal-only",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    /BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT/u,
    "Browser WAL CONFIRMED by itself must not authorize a replacement Target",
  );
  assert.deepEqual(targetAcquisitionRequests, ["target:confirmed"],
    "without Runtime-projected Forensics and task locator proof Browser must not request a new Target");
  targetAcquisitionRequests.length = 0;
  const confirmedReplacement = await supervisor.acquireJobBoundTargetLease(
    confirmedBinding(),
    "owner:confirmed:physical-replacement",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  assert.deepEqual(
    targetAcquisitionRequests,
    ["target:confirmed", null],
    "CONFIRMED provider recovery must prove the old Target unavailable before one inactive replacement",
  );
  assert.deepEqual(
    [confirmedReplacement.target.targetRef, confirmedReplacement.document.documentRef],
    ["target:confirmed:changed", "document:confirmed:3"],
  );
  const observation = await confirmedReplacement.runAtomicStep({
    productStepId: "confirmed-step", callId: "image-readback",
    childCapabilityId: "wait_for_stable_gpt_image", inputHash: HASH,
    actionOrdinal: 44, replayPolicy: "observation-only",
  }, () => confirmedReplacement.executeDomIntent({ kind: "document" }));
  assert.deepEqual(observation, { observed: true });
  await confirmedReplacement.navigate({
    url: "https://chatgpt.com/c/confirmed-readback", title: "exact readback",
  });
  await confirmedReplacement.downloadAuthenticatedMedia({
    assistantTurnId: "conversation-turn-2", semanticMediaId: "gpt-generated-image-main",
  });
  await assert.rejects(
    confirmedReplacement.runAtomicStep({
      productStepId: "confirmed-step", callId: "forbidden-submit",
      childCapabilityId: "submit_exact_gpt_turn_once", inputHash: HASH,
      actionOrdinal: 45, replayPolicy: "provider-effect-once",
    }, async () => null),
    /BROWSER_RECONCILIATION_SCOPE_INVALID/u,
  );
  await assert.rejects(confirmedReplacement.executeDomIntent({
    kind: "fill", selector: "#prompt-textarea", approvedText: "forbidden",
    clearBeforeType: true, expectedMatches: 1,
  }), /BROWSER_RECONCILIATION_SCOPE_INVALID/u);
  await assert.rejects(confirmedReplacement.navigate({
    url: "https://chatgpt.com/", title: "wrong page",
  }), /BROWSER_RECONCILIATION_SCOPE_INVALID/u);
  await assert.rejects(confirmedReplacement.attachFile({ selector: "input", approvedArtifacts: [] }),
    /BROWSER_RECONCILIATION_SCOPE_INVALID/u);
  await confirmedReplacement.park({ reason: "confirmed-provider-target-replaced", mode: "recovery" });

  brokerTargetStatus = "absent";
  targetAcquisitionRequests.length = 0;
  leaseIdentities.set("job:confirmed-target-local", {
    targetRef: "target:confirmed-target-local:changed",
    documentRef: "document:confirmed-target-local:changed",
  });
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:confirmed-target-local", "confirmed-target-local-step", "confirmed-target-local"),
      "owner:confirmed-target-local:no-replacement",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    (error) => {
      const failure = typedBrowserExecutionFailure(error);
      assert.equal(failure?.code, "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
      assert.equal(failure?.mutationOutcome, "confirmed");
      return true;
    },
    "a CONFIRMED target-local action must not authorize a replacement physical Target",
  );
  assert.deepEqual(targetAcquisitionRequests, ["target:confirmed-target-local"]);
  brokerTargetStatus = "claimed";
  leaseIdentities.delete("job:confirmed-target-local");
  leaseIdentities.delete("job:confirmed");
  acquisitions.length = 0;
  const first = await supervisor.acquireJobBoundTargetLease(
    binding("job:1"),
    "owner:1",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  let secondResolved = false;
  const secondPromise = supervisor
    .acquireJobBoundTargetLease(binding("job:2"), "owner:2", {
      signal: openSignal.signal,
      remainingMs: () => 60_000,
    })
    .then((lease) => {
      secondResolved = true;
      return lease;
    });
  await Promise.resolve();
  assert.equal(secondResolved, false);
  assert.deepEqual(acquisitions, ["job:1"]);
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 1);
  await first.close({ reason: "settled" });
  const second = await secondPromise;
  assert.deepEqual(acquisitions, ["job:1", "job:2"]);
  await second.close({ reason: "settled" });
  assert.equal(supervisor.readBrowserLaneState(), "idle");

  const active = await supervisor.acquireJobBoundTargetLease(
    binding("job:active"),
    "owner:active",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  const aborted = new AbortController();
  const abortedPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:aborted"),
    "owner:aborted",
    { signal: aborted.signal, remainingMs: () => 60_000 },
  );
  aborted.abort();
  await assert.rejects(abortedPromise, /BROWSER_WAIT_ABORTED/u);
  let remaining = 60_000;
  const expiredPromise = supervisor.acquireJobBoundTargetLease(
    binding("job:expired"),
    "owner:expired",
    { signal: openSignal.signal, remainingMs: () => remaining },
  );
  remaining = 0;
  await assert.rejects(expiredPromise, /V6_DEADLINE_BUDGET_EXHAUSTED/u);
  await active.close({ reason: "settled" });

  const boundedActive = await supervisor.acquireJobBoundTargetLease(
    binding("job:bounded-active"),
    "owner:bounded-active",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  const waitingControllers = Array.from(
    { length: 10 },
    () => new AbortController(),
  );
  const laneSupervisor = supervisor;
  const waiting = waitingControllers.map((controller, index) =>
    laneSupervisor.acquireJobBoundTargetLease(
      binding(`job:waiting-${index}`),
      `owner:waiting-${index}`,
      { signal: controller.signal, remainingMs: () => 60_000 },
    ),
  );
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 10);
  await assert.rejects(
    supervisor.acquireJobBoundTargetLease(
      binding("job:overflow"),
      "owner:overflow",
      { signal: openSignal.signal, remainingMs: () => 60_000 },
    ),
    (error) => {
      const failure = typedBrowserExecutionFailure(error);
      assert.equal(failure?.status, "failed");
      assert.equal(failure?.code, "BROWSER_BACKPRESSURE");
      assert.equal(failure?.mutationOutcome, "no");
      return true;
    },
  );
  waitingControllers.forEach((controller) => controller.abort());
  const waitingOutcomes = await Promise.allSettled(waiting);
  assert(waitingOutcomes.every((outcome) => outcome.status === "rejected"));
  await boundedActive.close({ reason: "settled" });

  const unsettled = await supervisor.acquireJobBoundTargetLease(
    binding("job:unsettled"),
    "owner:unsettled",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  await assert.rejects(
    unsettled.close({ reason: "unsettled" }),
    /BROWSER_TARGET_LIFECYCLE_UNSETTLED/u,
  );
  assert.equal(supervisor.readBrowserLaneState(), "idle");
  const afterLifecycleFault = await supervisor.acquireJobBoundTargetLease(
    binding("job:after-lifecycle-fault"),
    "owner:after-lifecycle-fault",
    { signal: openSignal.signal, remainingMs: () => 60_000 },
  );
  await afterLifecycleFault.close({ reason: "settled" });
  assert.equal(supervisor.readBrowserLaneState(), "idle",
    "one job's lifecycle fault must be reported without permanently freezing the global FIFO lane");
  assert.equal(supervisor.readBrowserLaneWaiterCount(), 0);
} finally {
  await supervisor?.stop();
  await rm(temporary, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][browser-lane-fifo] PASS\n");
