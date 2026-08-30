import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  gptExactCallIdentityHash,
  type GptAbilityGroup,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
  type GptExecutionContext,
} from "../../src/capabilities/gpt/index.js";
import {
  createForensicsPersistenceAbilityGroupFromStorage,
  type ForensicsPersistenceAbilityGroup,
} from "../../src/capabilities/forensics-persistence/index.js";
import type { BrowserTargetLease } from "../../src/lib/browser/browser-authority-api.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import {
  hashCanonical,
  type WebsiteAgentTask,
} from "../../src/lib/local-runtime/production/contracts.js";
import {
  ProductionGptChildTools,
  type ProductGptExecution,
} from "../../src/lib/local-runtime/production/production-gpt-child-tools.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import type { WorkbenchBrowserAuthority } from "../../src/lib/local-runtime/workbench-browser-authority-support.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { typedExecutionFailure } from "../../src/lib/typed-failure.js";
import { HASH_A, HASH_B, identityFor, task } from "./agent-production-runtime-fixtures.js";

type ProviderOutcome = "CONFIRMED" | "DISPATCHED";
type ProviderCounters = {
  dispatches: number;
  readbacks: number;
  acquisitions: number;
  resolutions: number;
  parks: number;
  closes: number;
};
type ProviderBrowserAuthority = Pick<
  WorkbenchBrowserAuthority,
  "readExactCallMutationFact" | "countProviderTurnDispatches" | "acquireJobBoundTargetLease"
>;

const providerResult = (
  intent: GptChildCapabilityIntent,
  outcome: "confirmed" | "dispatched",
): GptChildCapabilityResult => {
  const timestamp = new Date().toISOString();
  const succeeded = outcome === "confirmed";
  const evidenceHash = hashCanonical({ exactCall: intent.executionId, outcome });
  return Object.freeze({
    status: succeeded ? "success" : "failed",
    value: null,
    proof: Object.freeze({
      schemaVersion: "gpt-child-capability-proof.v2",
      childCapabilityId: intent.childCapabilityId,
      executionId: intent.executionId,
      jobId: intent.jobId,
      attemptId: intent.attemptId,
      pluginId: intent.pluginId,
      pluginVersion: intent.pluginVersion,
      productStepId: intent.productStepId,
      callId: intent.callId,
      inputHash: intent.inputHash,
      actionOrdinal: intent.actionOrdinal,
      targetRefHash: HASH_A,
      beforeDocumentRefHash: HASH_A,
      afterDocumentRefHash: HASH_B,
      candidateCount: 1,
      observedSemantics: Object.freeze([`provider-submit-${outcome}`]),
      committedMutation: outcome,
      postconditionResult: succeeded ? "passed" : "pending",
      startedAt: timestamp,
      endedAt: timestamp,
      evidenceRef: `browser:provider-effect:${intent.jobId}`,
      evidenceHash,
    }),
    failureCode: succeeded ? null : "TEST_PROVIDER_RESULT_UNKNOWN",
  });
};

const providerGpt = (initial: ProviderOutcome, counters: ProviderCounters): GptAbilityGroup => Object.freeze({
  abilityGroupId: "gpt",
  transport: "gpt-web",
  listChildCapabilityIds: () => Object.freeze(["submit_exact_gpt_turn_once"] as const),
  execute: async (intent: GptChildCapabilityIntent, context: GptExecutionContext) => {
    if (context.mutationMode === "readback") {
      counters.readbacks += 1;
      return providerResult(intent, "confirmed");
    }
    counters.dispatches += 1;
    return providerResult(intent, initial === "CONFIRMED" ? "confirmed" : "dispatched");
  },
});

const providerCall = Object.freeze({
  sessionKey: "session:provider-effect",
  productStepId: "corpus_research",
  callId: "turn-submit",
  child: "submit_exact_gpt_turn_once" as const,
  actionOrdinal: 12,
  input: Object.freeze({ promptHash: HASH_A, turnMarker: "[GRASSEYE:provider-effect]" }),
});

const exactCallHash = (jobId: string, attemptId: string) => gptExactCallIdentityHash({
  jobId,
  attemptId,
  pluginId: "public-knowledge-article-pipeline",
  pluginVersion: 14,
  productStepId: providerCall.productStepId,
  callId: providerCall.callId,
  childCapabilityId: providerCall.child,
  inputHash: hashCanonical(providerCall.input),
});

const walIdentity = (input: Readonly<{
  jobId: string;
  attemptId: string;
  commandId: string;
  targetRef: string;
  documentRef: string;
  exactCallIdentityHash: `sha256:${string}`;
  atomic: Parameters<BrowserTargetLease["runAtomicStep"]>[0];
}>) => ({
  commandId: input.commandId,
  logicalMutationId: input.exactCallIdentityHash,
  exactCallIdentityHash: input.exactCallIdentityHash,
  ownerPluginId: "public-knowledge-article-pipeline",
  pluginVersion: 14,
  jobId: input.jobId,
  attemptId: input.attemptId,
  leaseVersion: 1,
  executionFenceHash: HASH_A,
  productStepId: input.atomic.productStepId,
  callId: input.atomic.callId,
  childCapabilityId: input.atomic.childCapabilityId,
  effectScope: "provider_effect" as const,
  actionOrdinal: input.atomic.actionOrdinal,
  targetRef: input.targetRef,
  documentRef: input.documentRef,
  actionId: "browser.dom.click.v1",
  positivePostconditionHash: HASH_A,
  negativePostconditionHash: HASH_B,
  requestHash: input.atomic.inputHash,
  payloadHash: input.atomic.inputHash,
});

const walBackedBrowser = (input: Readonly<{
  wal: () => BrowserMutationStore;
  jobId: string;
  attemptId: string;
  commandId: string;
  targetRef: string;
  documentRef: string;
  exactCallIdentityHash: `sha256:${string}`;
  counters: ProviderCounters;
}>): BrowserTargetLease => {
  const recovery = (atomic: Parameters<BrowserTargetLease["runAtomicStep"]>[0]) =>
    input.wal().atomicStepRecovery({
      jobId: input.jobId,
      attemptId: input.attemptId,
      ownerPluginId: "public-knowledge-article-pipeline",
      pluginVersion: 14,
      exactCallIdentityHash: input.exactCallIdentityHash,
      actionOrdinal: atomic.actionOrdinal,
      targetRef: input.targetRef,
      effectScope: "provider_effect",
    });
  return {
    leaseRef: `lease:${input.jobId}`,
    authorityRef: `authority:${input.jobId}`,
    authorityEpoch: 1,
    executionBindingHash: HASH_A,
    ownerId: "public-knowledge-article-pipeline",
    agentJobRefHash: HASH_A,
    agentExecutionRefHash: HASH_B,
    writerLeaseEpoch: 1,
    writerFenceHash: HASH_A,
    target: { targetRef: input.targetRef, authorityEpoch: 1, executionBindingHash: HASH_A },
    document: { documentRef: input.documentRef, targetRef: input.targetRef, navigationEpoch: 1 },
    readAtomicStepRecovery: recovery,
    runAtomicStep: async <T>(
      atomic: Parameters<BrowserTargetLease["runAtomicStep"]>[0],
      action: () => Promise<T>,
    ): Promise<T> => {
      if (recovery(atomic)) return action();
      input.wal().prepare(walIdentity({ ...input, atomic }));
      input.wal().markDispatched(input.commandId);
      const result = await action();
      const childResult = result as GptChildCapabilityResult;
      if (childResult.proof.committedMutation === "confirmed") {
        input.wal().markConfirmed(input.commandId, childResult.proof.evidenceHash);
      }
      return result;
    },
    navigate: async () => { throw new Error("UNEXPECTED_PROVIDER_BROWSER_NAVIGATE"); },
    executeDomIntent: async () => { throw new Error("UNEXPECTED_PROVIDER_BROWSER_DOM"); },
    observeCapability: async () => { throw new Error("UNEXPECTED_PROVIDER_BROWSER_OBSERVE"); },
    captureScreenshot: async () => { throw new Error("UNEXPECTED_PROVIDER_BROWSER_SCREENSHOT"); },
    attachFile: async () => { throw new Error("UNEXPECTED_PROVIDER_BROWSER_ATTACH"); },
    downloadAuthenticatedMedia: async () => { throw new Error("UNEXPECTED_PROVIDER_BROWSER_MEDIA"); },
    registerFileArtifact: async () => { throw new Error("UNEXPECTED_PROVIDER_BROWSER_ARTIFACT"); },
    issueFileArtifactGrant: async () => { throw new Error("UNEXPECTED_PROVIDER_BROWSER_GRANT"); },
    wait: async () => { throw new Error("UNEXPECTED_PROVIDER_BROWSER_WAIT"); },
    resolvePendingMutation: async () => {
      input.counters.resolutions += 1;
      input.wal().resolve({
        commandId: input.commandId,
        ownerPluginId: "public-knowledge-article-pipeline",
        targetRef: input.targetRef,
        state: "CONFIRMED",
        proofHash: HASH_A,
      });
      return 1;
    },
    pendingMutationCount: () => input.wal().dispatchedForJob({
      jobId: input.jobId,
      ownerPluginId: "public-knowledge-article-pipeline",
    }).length,
    requiresMutationRecovery: () => input.wal().readState(input.commandId) === "DISPATCHED",
    park: async ({ mode }: { mode: string }) => {
      assert.equal(
        mode,
        input.wal().readState(input.commandId) === "DISPATCHED"
          ? "recovery"
          : "normal-provider-wait",
      );
      input.counters.parks += 1;
    },
    close: async () => {
      assert.equal(input.wal().readState(input.commandId), "CONFIRMED");
      input.counters.closes += 1;
    },
    assertNoPendingMutations: () => assert.equal(input.wal().dispatchedForJob({
      jobId: input.jobId,
      ownerPluginId: "public-knowledge-article-pipeline",
    }).length, 0),
  };
};

const providerAuthority = (input: Readonly<{
  wal: () => BrowserMutationStore;
  browser: ReturnType<typeof walBackedBrowser>;
  counters: ProviderCounters;
}>): ProviderBrowserAuthority => ({
  readExactCallMutationFact: (query) => input.wal().readExactCallMutationFact(query),
  countProviderTurnDispatches: (jobId, attemptId) =>
    input.wal().countProviderTurnDispatches(jobId, attemptId),
  acquireJobBoundTargetLease: async () => {
    input.counters.acquisitions += 1;
    return input.browser;
  },
});

const providerExecution = (input: Readonly<{
  root: string;
  initial: ProviderOutcome;
  counters: ProviderCounters;
  evidence: ForensicsPersistenceAbilityGroup;
  authority: ProviderBrowserAuthority;
  store: ProductionRuntimeStore;
  providerTask: WebsiteAgentTask;
  attemptId: string;
  leaseVersion: number;
}>): ProductGptExecution => new ProductionGptChildTools(
  input.root,
  HASH_A,
  providerGpt(input.initial, input.counters),
  input.evidence,
  input.authority as WorkbenchBrowserAuthority,
  input.store,
  createRuntimeLogger({
    producer: `agent-provider-effect-${input.initial.toLowerCase()}`,
    owner: "production-runtime",
    component: "gpt-child",
    terminalEnabled: false,
    fileSink: { directoryPath: path.join(input.root, "runtime-logs") },
  }),
).createExecution({
  task: input.providerTask,
  pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 14,
  lease: {
    attempt_id: input.attemptId,
    device_id: "device:provider-effect",
    lease_version: input.leaseVersion,
    execution_fence_hash: input.leaseVersion === 1 ? HASH_A : HASH_B,
    control_manifest_hash: HASH_A,
    max_provider_turns: 2,
    provider_turns_used: 0,
    expires_at_monotonic: performance.now() + 10_000,
    command_ttl_ms: 1_000,
    abort_signal: new AbortController().signal,
  },
  parentSpanId: `span:provider-effect:${input.leaseVersion}`,
});

const exerciseProviderEffectRecovery = async (initial: ProviderOutcome): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), `agent-provider-effect-${initial.toLowerCase()}-`));
  const jobId = `job:provider-effect:${initial.toLowerCase()}`;
  const attemptId = `attempt:provider-effect:${initial.toLowerCase()}`;
  const commandId = `command:provider-effect:${initial.toLowerCase()}`;
  const counters: ProviderCounters = { dispatches: 0, readbacks: 0, acquisitions: 0,
    resolutions: 0, parks: 0, closes: 0 };
  let store = new ProductionRuntimeStore(root);
  let wal = new BrowserMutationStore(root);
  let evidence = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
  try {
    const providerTask = task({
      jobId, productId: "public_knowledge_article_pipeline", actionId: "produce_article",
    });
    store.acceptTask(providerTask, identityFor(providerTask), attemptId);
    const exactHash = exactCallHash(jobId, attemptId);
    const browser = walBackedBrowser({ wal: () => wal, jobId, attemptId, commandId,
      targetRef: `target:${jobId}`, documentRef: `document:${jobId}`,
      exactCallIdentityHash: exactHash, counters });
    const authority = providerAuthority({ wal: () => wal, browser, counters });
    const execution = (leaseVersion: number) => providerExecution({
      root, initial, counters, evidence, authority, store, providerTask, attemptId, leaseVersion,
    });
    const first = execution(1);
    let firstFailure: unknown = null;
    try { await first.tools.execute(providerCall); } catch (error) { firstFailure = error; }
    assert.equal(initial === "CONFIRMED" ? firstFailure : typedExecutionFailure(firstFailure)?.code,
      initial === "CONFIRMED" ? null : "TEST_PROVIDER_RESULT_UNKNOWN");
    await first.settle(firstFailure);
    assert.equal(wal.readState(commandId), initial);
    assert.equal(wal.countProviderTurnDispatches(jobId, attemptId), 1);

    store.close();
    wal.close();
    store = new ProductionRuntimeStore(root);
    wal = new BrowserMutationStore(root);
    evidence = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
    assert.equal(store.readTask(jobId)?.current_attempt_id, attemptId);
    assert.equal(wal.readState(commandId), initial);

    const recovered = execution(2);
    await recovered.tools.execute(providerCall);
    await recovered.settle(null);
    const acquisitionsAfterRecovery = counters.acquisitions;
    await recovered.tools.execute(providerCall);
    assert.equal(counters.dispatches, 1, "recovery must not dispatch the same Provider effect again");
    assert.equal(wal.countProviderTurnDispatches(jobId, attemptId), 1);
    assert.equal(wal.readState(commandId), "CONFIRMED");
    assert.equal(counters.acquisitions, acquisitionsAfterRecovery,
      "confirmed exact evidence must bypass Browser on the next replay");
    assert.deepEqual(
      [counters.readbacks, counters.acquisitions, counters.resolutions, counters.parks, counters.closes],
      initial === "CONFIRMED" ? [0, 1, 0, 1, 0] : [1, 2, 1, 2, 0],
    );
  } finally {
    store.close();
    wal.close();
    await rm(root, { recursive: true, force: true });
  }
};

await exerciseProviderEffectRecovery("CONFIRMED");
await exerciseProviderEffectRecovery("DISPATCHED");
