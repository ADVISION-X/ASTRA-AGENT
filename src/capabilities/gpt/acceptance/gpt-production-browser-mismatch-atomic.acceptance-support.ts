import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { createGptAbilityGroup } from "../ability-group.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { typedGptExecutionFailure } from "../execution-fault.js";
import { HASH_A, HASH_B, claimTask, deviceStatusWithoutAdmission, task } from
  "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";
import { ProductionRuntimeStore } from "../../../lib/local-runtime/production/store.js";
import { executeClaim } from "../../../lib/local-runtime/production/runtime-claim.js";
import { BrowserMutationStore } from "../../../lib/browser/exact-target/browser-mutation-store.js";
import type { BrowserAtomicStepIdentity, BrowserExecutionBinding } from
  "../../../lib/browser/browser-authority-api.js";
import type { BrowserCommandPermit } from "../../../lib/browser/transport/command-permit.js";
import { detectedKnownGptRateLimitMismatchFact } from
  "../../../../scripts/acceptance/local-browser-rate-limit-detector.acceptance-support.js";
import { absentPreflightEnvelope, createBrowserActorFactory, permit, rateLimitSpecialReceipt } from
  "../../../../scripts/acceptance/local-browser-terminal-fixture.js";

const mismatchPreflightFact = await detectedKnownGptRateLimitMismatchFact();
const temporary = await mkdtemp(path.join(tmpdir(), "agent-dialog-mismatch-atomic-"));
try {
  let atomicArtifactWrites = 0;
  let atomicProviderControlCalls = 0;
  const atomicTargetRef = "target:dialog-mismatch-atomic";
  const atomicDocumentRef = "document:dialog-mismatch-atomic";
  const sha256 = (value: string): `sha256:${string}` =>
    `sha256:${createHash("sha256").update(value).digest("hex")}`;
  const mutationStore = new BrowserMutationStore(
    path.join(temporary, "browser-dialog-mismatch-atomic"),
  );
  mutationStore.verifyRuntimeTaskProvenance(null);
  const atomicLogger = createRuntimeLogger({
    producer: "agent-dialog-mismatch-atomic-acceptance", owner: "production-runtime",
    component: "gpt-child", terminalEnabled: false,
    fileSink: { directoryPath: path.join(temporary, "runtime-logs-dialog-mismatch-atomic") },
  });
  let atomicBinding: BrowserExecutionBinding | null = null;
  let activeAtomicIdentity: BrowserAtomicStepIdentity | null = null;
  let rejectedAtomicIdentity: BrowserAtomicStepIdentity | null = null;
  let mismatchCommandId: string | null = null;
  let actorMismatchFact: Readonly<Record<string, unknown>> | null = null;
  let commandSequence = 0;
  const actor = createBrowserActorFactory(mutationStore, atomicLogger)(
    async (candidate, command, onDispatched) => {
      if (command.kind === "dom-intent"
        && command.intent.kind === "acknowledgeKnownGptRateLimit") {
        onDispatched?.();
        mismatchCommandId = candidate.commandId;
        const special = rateLimitSpecialReceipt(candidate, "mismatch");
        actorMismatchFact = special.knownGptRateLimitPreflightFact as Readonly<Record<string, unknown>>;
        return Object.freeze({
          replyChannelToken: candidate.replyChannelToken,
          transportSequence: candidate.sequence,
          permitSequence: candidate.sequence,
          result: special,
        });
      }
      return Object.freeze({
        replyChannelToken: candidate.replyChannelToken,
        transportSequence: candidate.sequence,
        permitSequence: candidate.sequence,
        result: absentPreflightEnvelope(candidate, Object.freeze({ waited: true })),
      });
    },
    false,
  );
  const atomicPermit = (
    identity: BrowserAtomicStepIdentity,
    capabilityId: "browser.dom.click.v1" | "browser.wait.v1",
    mutationClass: "mutation" | "observation",
    commandId: string,
  ): BrowserCommandPermit => {
    if (!atomicBinding) throw new Error("BROWSER_EXECUTION_BINDING_MISSING");
    commandSequence += 1;
    return Object.freeze({
      ...permit(commandId),
      jobId: atomicBinding.jobId,
      resultRevision: atomicBinding.resultRevision,
      attemptId: atomicBinding.attemptId,
      deviceId: atomicBinding.deviceId,
      leaseVersion: atomicBinding.leaseVersion,
      localOrderId: atomicBinding.localOrderId,
      targetRef: atomicTargetRef,
      documentRef: atomicDocumentRef,
      productStepId: identity.productStepId,
      callId: identity.callId,
      childCapabilityId: identity.childCapabilityId,
      inputHash: identity.inputHash,
      replayPolicy: identity.replayPolicy,
      actionOrdinal: identity.actionOrdinal,
      writerFenceHash: atomicBinding.writerFenceHash,
      candidateHash: atomicBinding.candidateHash,
      contractManifestHash: atomicBinding.contractManifestHash,
      commandTtlMs: atomicBinding.commandTtlMs,
      capabilityId,
      commandId,
      sequence: commandSequence,
      mutationClass,
      replyChannelToken: `reply:${commandId}`,
    });
  };
  let deliveredClearance: unknown = null;
  const atomicTools = new ProductionGptChildTools(
    temporary,
    HASH_A,
    createGptAbilityGroup(),
    {
      appendArtifact: async () => { atomicArtifactWrites += 1;
        return { status: "failed", failureReason: "forbidden" }; },
      readArtifact: async () => { atomicArtifactWrites += 1;
        return { status: "failed", failureReason: "forbidden" }; },
    },
    {
      readProviderEffectStepCallFact: () => null,
      countProviderTurnDispatches: () => 0,
      acquireJobBoundTargetLease: async (binding: BrowserExecutionBinding, ownerId: string) => {
        atomicBinding = binding;
        return {
          leaseRef: "lease:dialog-mismatch-atomic",
          authorityRef: "authority:dialog-mismatch-atomic",
          authorityEpoch: 1,
          executionBindingHash: HASH_A,
          ownerId,
          agentJobRefHash: binding.jobRefHash,
          agentExecutionRefHash: binding.executionRefHash,
          writerLeaseEpoch: binding.writerLeaseEpoch,
          writerFenceHash: binding.writerFenceHash,
          target: { targetRef: atomicTargetRef },
          document: { documentRef: atomicDocumentRef },
          pendingMutationCount: () => actor.pendingMutationCommandIds(binding).length,
          readAtomicStepOutcome: (identity: BrowserAtomicStepIdentity) =>
            actor.readAtomicStepOutcome(binding, atomicTargetRef, identity),
          runAtomicStep: async <T>(
            identity: BrowserAtomicStepIdentity,
            action: () => Promise<T>,
          ): Promise<T> => {
            if (activeAtomicIdentity) throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_INVALID");
            activeAtomicIdentity = identity;
            rejectedAtomicIdentity = identity;
            try { return await action(); } finally { activeAtomicIdentity = null; }
          },
          executeDomIntent: async (intent: Readonly<Record<string, unknown>>) => {
            if (!activeAtomicIdentity) throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_REQUIRED");
            const commandId = "command:dialog-mismatch-atomic";
            return actor.execute(
              atomicPermit(activeAtomicIdentity, "browser.dom.click.v1", "mutation", commandId),
              { kind: "dom-intent", intent } as never,
            );
          },
          park: async () => undefined,
        } as never;
      },
    } as never,
    atomicLogger,
    {
      assertProviderSubmitAllowed: () => { atomicProviderControlCalls += 1; },
      pendingIncidents: () => {
        atomicProviderControlCalls += 1;
        return [Object.freeze({
          jobId: "job:dialog-mismatch-atomic",
          attemptId: "attempt:dialog-mismatch-atomic",
          resultRevision: 0,
          deviceId: "device:1",
          leaseVersion: 1,
          fenceHash: HASH_A,
          capabilityManifestHash: HASH_B,
          dialogHash: mismatchPreflightFact.dialogHash as `sha256:${string}`,
          observationHash: HASH_A,
          targetRefHash: sha256(atomicTargetRef),
          documentRefHash: sha256(atomicDocumentRef),
          sessionKey: "session:dialog-mismatch-atomic",
          observedAt: "2026-09-21T00:00:00.000Z",
        })];
      },
      beginIncident: async () => {
        atomicProviderControlCalls += 1;
        return Object.freeze({
          incidentRequestId: "aipcooldown_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          deliver: async (clearance: unknown) => {
            atomicProviderControlCalls += 1;
            deliveredClearance = clearance;
          },
        });
      },
    },
  );
  let atomicMismatchFailure: unknown = null;
  try {
    await atomicTools.reconcilePendingProviderRateLimitIncidents(
      "parent:dialog-mismatch-atomic",
      new AbortController().signal,
    );
  } catch (error) { atomicMismatchFailure = error; }
  const normalizedAtomicMismatch = typedGptExecutionFailure(atomicMismatchFailure);
  assert.equal(normalizedAtomicMismatch?.code, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
  assert.ok(mismatchCommandId, "the real Browser actor must dispatch one mismatch command");
  assert.ok(rejectedAtomicIdentity, "the real GPT atomic call must bind its Browser identity");
  assert.equal(mutationStore.readCommand(mismatchCommandId!)?.state, "REJECTED");
  const rejectedWal = actor.readAtomicStepOutcome(
    atomicBinding!, atomicTargetRef, rejectedAtomicIdentity!,
  );
  assert.equal(rejectedWal?.state, "rejected");
  assert.equal(rejectedWal?.failureCode, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
  assert.equal(normalizedAtomicMismatch?.proofFacts?.browserFact?.evidenceRef,
    rejectedWal?.authorityRef);
  assert.equal(normalizedAtomicMismatch?.proofFacts?.browserFact?.evidenceHash,
    rejectedWal?.authorityHash);
  assert.deepEqual(normalizedAtomicMismatch?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact,
    actorMismatchFact,
    "the real detector fact from the Browser actor must survive GPT normalization");
  assert.equal(atomicArtifactWrites, 0);
  assert.equal(atomicProviderControlCalls, 3,
    "the Runtime cooldown port must read, bind, and fail-close the one incident");
  assert.equal((deliveredClearance as { clearance?: string } | null)?.clearance, "not_cleared");

  const runtimeDirectory = path.join(temporary, "runtime-mismatch-integration");
  await mkdir(runtimeDirectory, { recursive: true });
  const runtimeStore = new ProductionRuntimeStore(runtimeDirectory);
  try {
    const websiteTask = task({
      jobId: "job:dialog-mismatch-atomic",
      productId: "payment_screenshot_observation",
      actionId: "observe",
    });
    const job = claimTask(websiteTask);
    const status = deviceStatusWithoutAdmission(job.job_id);
    let releaseRequests = 0;
    await executeClaim({
      abort: new AbortController(), active: new Map(),
      activeAbort: new Map([[job.job_id, new AbortController()]]),
      store: runtimeStore,
      executor: {
        accept: (acceptedTask: typeof websiteTask, attemptId: string) =>
          runtimeStore.acceptTask(acceptedTask, attemptId),
        acceptAfterFailureReconciled: () => { throw new Error("UNEXPECTED_RECONCILIATION"); },
        execute: async () => { throw atomicMismatchFailure; },
      } as never,
      session: {
        workerSessionId: "worker:dialog-mismatch-integration", workerSessionEpoch: 1,
        device: { server_base_url: "http://127.0.0.1:4322" },
        request: async (requestPath: string) => {
          if (requestPath.endsWith("/lease-release")) releaseRequests += 1;
          return status.request();
        },
      } as never,
      providerRateLimitControl: {} as never, browserAuthority: {} as never,
      gpt: {} as never, evidenceStore: {} as never, dataDir: runtimeDirectory,
      runtimeLogger: createRuntimeLogger({
        producer: "agent-dialog-mismatch-integration", owner: "production-runtime",
        component: "production-runtime", terminalEnabled: false,
        fileSink: { directoryPath: path.join(runtimeDirectory, "runtime-logs") },
      }),
      draining: false, lastHeartbeat: null, lastErrorCode: null, lastErrorReason: null,
      stopped: false, ledgerReconciled: true,
    }, job);
    const runtimeRecord = runtimeStore.readTask(job.job_id);
    assert.equal(runtimeRecord?.current_reason, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
    assert.equal(runtimeRecord?.attempt_failure, null,
      "the real detector-to-GPT mismatch must not become an attempt failure in Runtime");
    assert.equal(runtimeStore.outboxAuthorities().length, 0);
    assert.equal(releaseRequests, 0);
    const rejectedWalHash = rejectedWal!.authorityHash;
    const freshIdentity: BrowserAtomicStepIdentity = Object.freeze({
      resultRevision: 0,
      productStepId: "gpt-rate-limit-control",
      callId: "fresh-absence-after-mismatch",
      childCapabilityId: "fresh_known_gpt_rate_limit_absence",
      inputHash: HASH_B,
      actionOrdinal: 1,
      replayPolicy: "observation-only",
    });
    const freshCommandId = "command:fresh-absence-after-dialog-mismatch";
    const freshResult = await actor.execute(
      atomicPermit(freshIdentity, "browser.wait.v1", "observation", freshCommandId),
      { kind: "wait", durationMs: 1 },
    );
    assert.deepEqual(freshResult, { waited: true },
      "the same Browser authority must admit a fresh absent preflight after the mismatch");
    assert.equal(mutationStore.readCommand(freshCommandId), null,
      "the fresh absence proof must not create a mutation WAL row");
    assert.equal(mutationStore.authorityHash(mismatchCommandId!), rejectedWalHash,
      "the fresh absence must not rewrite the prior rejected WAL authority");
  } finally {
    runtimeStore.close();
    mutationStore.close();
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
