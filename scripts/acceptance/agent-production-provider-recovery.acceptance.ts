import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import {
  createGptAbilityGroup,
  gptExactCallIdentityHash,
  type GptAbilityGroup,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
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
import { persistGptChildEvidence } from "../../src/lib/local-runtime/production/gpt-evidence-writer.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import type { WorkbenchBrowserAuthority } from "../../src/lib/local-runtime/workbench-browser-authority-support.js";
import { createRuntimeLogger, type RuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { executionFailure, typedExecutionFailure } from "../../src/lib/typed-failure.js";
import { HASH_A, HASH_B, identityFor, task } from "./agent-production-runtime-fixtures.js";

type ProviderOutcome = "CONFIRMED" | "DISPATCHED";
type GptExecutionContext = Parameters<GptAbilityGroup["execute"]>[1];
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

type WalBrowserInput = Readonly<{
  wal: () => BrowserMutationStore;
  jobId: string;
  attemptId: string;
  commandId: string;
  targetRef: string;
  documentRef: string;
  exactCallIdentityHash: `sha256:${string}`;
  counters: ProviderCounters;
}>;

const readWalRecovery = (
  input: WalBrowserInput,
  atomic: Parameters<BrowserTargetLease["runAtomicStep"]>[0],
) => input.wal().atomicStepRecovery({
  jobId: input.jobId,
  attemptId: input.attemptId,
  ownerPluginId: "public-knowledge-article-pipeline",
  pluginVersion: 14,
  exactCallIdentityHash: input.exactCallIdentityHash,
  actionOrdinal: atomic.actionOrdinal,
  targetRef: input.targetRef,
  effectScope: "provider_effect",
});

const runWalStep = async <T>(
  input: WalBrowserInput,
  atomic: Parameters<BrowserTargetLease["runAtomicStep"]>[0],
  action: () => Promise<T>,
): Promise<T> => {
  if (readWalRecovery(input, atomic)) return action();
  input.wal().prepare(walIdentity({ ...input, atomic }));
  input.wal().markDispatched(input.commandId);
  const result = await action();
  const childResult = result as GptChildCapabilityResult;
  if (childResult.proof.committedMutation === "confirmed") {
    input.wal().markConfirmed(input.commandId, childResult.proof.evidenceHash);
  }
  return result;
};

const walBackedBrowser = (input: WalBrowserInput): BrowserTargetLease => ({
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
    readAtomicStepRecovery: (atomic) => readWalRecovery(input, atomic),
    runAtomicStep: (atomic, action) => runWalStep(input, atomic, action),
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
});

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
  runtimeLogger?: RuntimeLogger;
}>): ProductGptExecution => new ProductionGptChildTools(
  input.root,
  HASH_A,
  providerGpt(input.initial, input.counters),
  input.evidence,
  input.authority as WorkbenchBrowserAuthority,
  input.store,
  input.runtimeLogger ?? createRuntimeLogger({
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

const exerciseBrowserAcquisitionTerminal = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "agent-browser-acquisition-terminal-"));
  const providerTask = task({
    jobId: "job:browser-acquisition-terminal",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const attemptId = "attempt:browser-acquisition-terminal";
  const counters: ProviderCounters = { dispatches: 0, readbacks: 0, acquisitions: 0,
    resolutions: 0, parks: 0, closes: 0 };
  const store = new ProductionRuntimeStore(root);
  try {
    store.acceptTask(providerTask, identityFor(providerTask), attemptId);
    const runtimeLogger = createRuntimeLogger({
      producer: "agent-browser-acquisition-terminal",
      owner: "production-runtime",
      component: "gpt-child",
      terminalEnabled: false,
      fileSink: { directoryPath: path.join(root, "runtime-logs") },
    });
    const authority: ProviderBrowserAuthority = {
      readExactCallMutationFact: () => null,
      countProviderTurnDispatches: () => 0,
      acquireJobBoundTargetLease: async () => {
        counters.acquisitions += 1;
        throw executionFailure("failed", "BROWSER_CAPABILITY_REJECTED");
      },
    };
    const execution = providerExecution({
      root,
      initial: "CONFIRMED",
      counters,
      evidence: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root)),
      authority,
      store,
      providerTask,
      attemptId,
      leaseVersion: 1,
      runtimeLogger,
    });
    let observed: unknown = null;
    try { await execution.tools.execute(providerCall); } catch (error) { observed = error; }
    assert.equal(typedExecutionFailure(observed)?.code, "BROWSER_CAPABILITY_REJECTED");
    assert.equal(counters.acquisitions, 1);
    const events = (await readFile(runtimeLogger.currentSegmentPath()!, "utf8")).trim().split("\n")
      .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
      .filter((event) => event.operation === "gpt.child" && event.traceId === providerTask.job_id);
    const started = events.filter((event) => event.kind === "span.started");
    const terminals = events.filter((event) => event.kind === "span.terminal");
    assert.equal(started.length, 1);
    assert.equal(terminals.length, 1, "Browser acquisition failure must terminalize the started GPT Child span");
    assert.equal(terminals[0]?.spanId, started[0]?.spanId);
    await execution.settle(observed);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

const exerciseArtifactReadbackTerminal = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "agent-artifact-readback-terminal-"));
  const providerTask = task({
    jobId: "job:artifact-readback-terminal",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const attemptId = "attempt:artifact-readback-terminal";
  const semanticText = '{"schema_version":"public-knowledge-research-output.v3"}';
  const rawDomHtml = `<div>${semanticText}</div>`;
  const digest = (value: string): `sha256:${string}` =>
    `sha256:${createHash("sha256").update(value).digest("hex")}`;
  const checkpointCall = Object.freeze({
    sessionKey: "session:artifact-readback-terminal",
    productStepId: "corpus_research",
    callId: "response-checkpoint",
    child: "checkpoint_gpt_text_response" as const,
    actionOrdinal: 15,
    input: Object.freeze({
      assistantTurnId: "conversation-turn-2",
      canonicalConversationUrl: "https://chatgpt.com/c/artifact-readback-terminal",
      expectedPromptHash: HASH_A,
      expectedResponseHash: digest(semanticText),
      turnMarker: "[GRASSEYE:artifact-readback-terminal]",
    }),
  });
  const identity = {
    jobId: providerTask.job_id,
    attemptId,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 14,
    productStepId: checkpointCall.productStepId,
    callId: checkpointCall.callId,
    childCapabilityId: checkpointCall.child,
    inputHash: hashCanonical(checkpointCall.input),
  } as const;
  const exactCallIdentityHash = gptExactCallIdentityHash(identity);
  const intent = {
    ...identity,
    executionId: `gpt-call:${exactCallIdentityHash.slice(7)}`,
    actionOrdinal: checkpointCall.actionOrdinal,
    input: checkpointCall.input,
  } as const;
  const timestamp = new Date().toISOString();
  const counters: ProviderCounters = { dispatches: 0, readbacks: 0, acquisitions: 0,
    resolutions: 0, parks: 0, closes: 0 };
  const store = new ProductionRuntimeStore(root);
  try {
    store.acceptTask(providerTask, identityFor(providerTask), attemptId);
    const persistedEvidence = createForensicsPersistenceAbilityGroupFromStorage(
      createGrassEyeFileStorage(root),
    );
    const result = providerResult(intent, "confirmed");
    await persistGptChildEvidence({
      intent,
      evidenceStore: persistedEvidence,
      jobId: providerTask.job_id,
      attemptId,
      stepId: checkpointCall.productStepId,
      exactCallIdentityHash,
      result: {
        ...result,
        value: {
          assistantTurnId: "conversation-turn-2",
          rawDomHtml,
          rawDomHash: digest(rawDomHtml),
          semanticText,
          semanticTextHash: digest(semanticText),
        },
        proof: { ...result.proof, committedMutation: "no", startedAt: timestamp, endedAt: timestamp },
      },
    });
    const failingEvidence: ForensicsPersistenceAbilityGroup = {
      ...persistedEvidence,
      readArtifactRef: async () => ({ status: "failed", failureReason: "forced-readback-failure" }),
    };
    const runtimeLogger = createRuntimeLogger({
      producer: "agent-artifact-readback-terminal",
      owner: "production-runtime",
      component: "gpt-child",
      terminalEnabled: false,
      fileSink: { directoryPath: path.join(root, "runtime-logs") },
    });
    const execution = providerExecution({
      root, initial: "CONFIRMED", counters, evidence: failingEvidence,
      authority: {
        readExactCallMutationFact: () => null,
        countProviderTurnDispatches: () => 0,
        acquireJobBoundTargetLease: async () => { throw new Error("UNEXPECTED_ARTIFACT_BROWSER"); },
      },
      store, providerTask, attemptId, leaseVersion: 1, runtimeLogger,
    });
    let observed: unknown = null;
    try { await execution.tools.execute(checkpointCall); } catch (error) { observed = error; }
    assert.equal(typedExecutionFailure(observed)?.code, "GPT_TEXT_TASK_ARTIFACT_READBACK_FAILED");
    const events = (await readFile(runtimeLogger.currentSegmentPath()!, "utf8")).trim().split("\n")
      .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
      .filter((event) => event.operation === "gpt.child" && event.traceId === providerTask.job_id);
    const started = events.filter((event) => event.kind === "span.started");
    const terminals = events.filter((event) => event.kind === "span.terminal");
    assert.equal(started.length, 1);
    assert.equal(terminals.length, 1, "Artifact readback failure must terminalize the started GPT Child span");
    assert.equal(terminals[0]?.spanId, started[0]?.spanId);
    await execution.settle(observed);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

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
await exerciseBrowserAcquisitionTerminal();
await exerciseArtifactReadbackTerminal();

const exerciseSubmissionLocatorRestart = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "agent-submission-locator-restart-"));
  const providerTask = task({
    jobId: "job:submission-locator-restart",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const attemptId = "attempt:submission-locator-restart";
  const promptHash = HASH_A;
  const turnMarker = "[GRASSEYE:submission-locator-restart]";
  const locatorCall = Object.freeze({
    sessionKey: "",
    productStepId: "corpus_research",
    callId: "submission-reconcile",
    child: "reconcile_gpt_turn_submission" as const,
    actionOrdinal: 13,
    input: Object.freeze({ expectedPromptHash: promptHash, timeoutMs: 60_000, turnMarker }),
  });
  const inputHash = hashCanonical(locatorCall.input);
  const identity = {
    jobId: providerTask.job_id,
    attemptId,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 14,
    productStepId: locatorCall.productStepId,
    callId: locatorCall.callId,
    childCapabilityId: locatorCall.child,
    inputHash,
  } as const;
  const exactCallIdentityHash = gptExactCallIdentityHash(identity);
  const locatorUrl = "https://chatgpt.com/c/submission-locator-restart";
  const userTurnId = "conversation-turn-3";
  const conversationIdentityHash = `sha256:${createHash("sha256")
    .update(`${locatorUrl}\n${turnMarker}\n${userTurnId}\n${promptHash}`).digest("hex")}` as const;
  const timestamp = new Date().toISOString();
  let store = new ProductionRuntimeStore(root);
  try {
    store.acceptTask(providerTask, identityFor(providerTask), attemptId);
    let evidence = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
    await persistGptChildEvidence({
      intent: {
        ...identity,
        executionId: `gpt-call:${exactCallIdentityHash.slice(7)}`,
        actionOrdinal: locatorCall.actionOrdinal,
        input: locatorCall.input,
      },
      evidenceStore: evidence,
      jobId: providerTask.job_id,
      attemptId,
      stepId: locatorCall.productStepId,
      exactCallIdentityHash,
      result: {
        status: "success",
        failureCode: null,
        value: { canonicalConversationUrl: locatorUrl, turnMarker, userTurnId,
          promptHash, conversationIdentityHash },
        proof: {
          schemaVersion: "gpt-child-capability-proof.v2",
          ...identity,
          executionId: `gpt-call:${exactCallIdentityHash.slice(7)}`,
          actionOrdinal: locatorCall.actionOrdinal,
          targetRefHash: HASH_A,
          beforeDocumentRefHash: HASH_A,
          afterDocumentRefHash: HASH_B,
          candidateCount: 1,
          observedSemantics: ["submission locator"],
          committedMutation: "no",
          postconditionResult: "passed",
          startedAt: timestamp,
          endedAt: timestamp,
          evidenceRef: "browser:submission-locator-restart",
          evidenceHash: HASH_B,
        },
      },
    });
    store.close();
    store = new ProductionRuntimeStore(root);
    evidence = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
    let browserAcquisitions = 0;
    let providerDispatchReads = 0;
    const authority = Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
      readExactCallMutationFact: () => null,
      countProviderTurnDispatches: () => { providerDispatchReads += 1; return 0; },
      acquireJobBoundTargetLease: async () => {
        browserAcquisitions += 1;
        throw new Error("UNEXPECTED_SUBMISSION_LOCATOR_BROWSER");
      },
    });
    const execution = continuationExecution({
      root, evidence, authority, store, providerTask, attemptId, leaseVersion: 2,
    });
    const replayed = await execution.tools.execute(locatorCall);
    assert.deepEqual(replayed.value, {
      canonicalConversationUrl: locatorUrl,
      turnMarker,
      userTurnId,
      promptHash,
      conversationIdentityHash,
    });
    assert.equal(browserAcquisitions, 0, "restart replay must read the locator before Browser acquisition");
    assert.equal(providerDispatchReads, 0, "restart replay must not enter submit budget or mutation logic");
    await execution.settle(null);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

const continuationAuthority = (): WorkbenchBrowserAuthority => Object.assign(
  Object.create(null) as WorkbenchBrowserAuthority,
  {
    readExactCallMutationFact: () => null,
    countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => {
      throw new Error("UNEXPECTED_CONTINUATION_BROWSER");
    },
  },
);

const continuationExecution = (input: Readonly<{
  root: string;
  evidence: ForensicsPersistenceAbilityGroup;
  authority: WorkbenchBrowserAuthority;
  store: ProductionRuntimeStore;
  providerTask: WebsiteAgentTask;
  attemptId: string;
  leaseVersion: number;
}>): ProductGptExecution => new ProductionGptChildTools(
  input.root,
  HASH_A,
  createGptAbilityGroup(),
  input.evidence,
  input.authority,
  input.store,
  createRuntimeLogger({
    producer: "agent-continuation-rebuild",
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
    device_id: "device:continuation-rebuild",
    lease_version: input.leaseVersion,
    execution_fence_hash: input.leaseVersion === 1 ? HASH_A : HASH_B,
    control_manifest_hash: HASH_A,
    max_provider_turns: 2,
    provider_turns_used: 0,
    expires_at_monotonic: performance.now() + 10_000,
    command_ttl_ms: 1_000,
    abort_signal: new AbortController().signal,
  },
  parentSpanId: `span:continuation-rebuild:${input.leaseVersion}`,
});

await exerciseSubmissionLocatorRestart();

const exerciseContinuationRebuild = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "agent-continuation-rebuild-"));
  const providerTask = task({
    jobId: "job:continuation-rebuild",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const attemptId = "attempt:continuation-rebuild";
  let store = new ProductionRuntimeStore(root);
  try {
    store.acceptTask(providerTask, identityFor(providerTask), attemptId);
    const evidence = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
    const authority = continuationAuthority();
    const execution = (leaseVersion: number) => continuationExecution({
      root, evidence, authority, store, providerTask, attemptId, leaseVersion,
    });
    const call = Object.freeze({
      sessionKey: "session:continuation-rebuild",
      productStepId: "corpus_research",
      callId: "continuation-persist",
      child: "persist_gpt_continuation" as const,
      actionOrdinal: 16,
      input: Object.freeze({
        jobId: providerTask.job_id,
        pluginId: "public-knowledge-article-pipeline",
        ownerRef: providerTask.business_identity.owner_ref,
        subjectRef: providerTask.business_identity.subject_ref,
        authorizationRef: providerTask.business_identity.authorization_ref,
        provider: Object.freeze({
          provider_page_url: "https://chatgpt.com/c/continuation-rebuild",
          prior_task_id: providerTask.job_id,
          prior_prompt_hash: HASH_A,
          prior_raw_output_hash: HASH_B,
          prior_turn_marker: "[GRASSEYE:continuation-rebuild]",
        }),
      }),
    });
    const first = execution(1);
    const persisted = await first.tools.execute(call);
    await first.settle(null);
    const continuationRef = Reflect.get(persisted.value ?? {}, "continuationRef");
    assert.equal(typeof continuationRef, "string");

    store.close();
    const database = new Database(path.join(root, "production-runtime.sqlite"));
    const deleted = database.prepare(
      "delete from production_continuations where continuation_ref=?",
    ).run(continuationRef);
    database.close();
    assert.equal(deleted.changes, 1);

    store = new ProductionRuntimeStore(root);
    const recovered = execution(2);
    const rebuilt = await recovered.tools.execute(call);
    await recovered.settle(null);
    assert.equal(Reflect.get(rebuilt.value ?? {}, "continuationRef"), continuationRef);
    assert.equal(store.readGptContinuation(continuationRef as string)?.provider.prior_prompt_hash, HASH_A,
      "exact persisted evidence must rebuild only the missing local continuation row");
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

await exerciseContinuationRebuild();
