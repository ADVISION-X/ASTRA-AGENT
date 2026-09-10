import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import {
  GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS,
  GptCrossConversationPollCadence,
  productionGptCrossConversationPollCadence,
} from "../provider-wait-cross-conversation-cadence.js";
import type {
  BrowserConfirmedProviderSourceReadbackAuthorization,
  BrowserExecutionBinding,
} from "../../../lib/browser/browser-authority-api.js";
import { confirmedSourceReadbackDocumentMatches } from
  "../../../lib/browser/browser-authority-api.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { typedExecutionFailure } from "../../../lib/execution-failure.js";
import { HASH_A, HASH_B, task } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

const documentHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const temporary = await mkdtemp(path.join(tmpdir(), "agent-readback-acceptance-"));
try {
  const runtimeLogger = createRuntimeLogger({
    producer: "agent-readback-acceptance", owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
    fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
  });
  const waitTask = task({
    jobId: "job:agent-readback-acceptance", productId: "payment_screenshot_observation", actionId: "observe",
  });
  let liveExpiresAt = performance.now() + 10_000;
  let liveCommandTtl = 1_000;
  const liveBindings: BrowserExecutionBinding[] = [];
  const liveBudgetLifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async (binding: BrowserExecutionBinding) => {
        liveBindings.push(binding);
        return {
          target: { targetRef: "target:live-budget" }, document: { documentRef: "document:live-budget" },
          pendingMutationCount: () => 0, requiresMutationRecovery: () => false,
          park: async () => undefined, close: async () => undefined,
        };
      },
    } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: "attempt:live-budget",
      pluginId: "payment-screenshot-observation", pluginVersion: 1,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      get expiresAtMonotonic() { return liveExpiresAt; },
      get commandTtlMs() { return liveCommandTtl; },
      abortSignal: new AbortController().signal,
    },
  );
  await liveBudgetLifecycle.browserFor("session:live-budget", "corpus_research", "live-budget-call");
  const liveBinding = liveBindings[0];
  assert.ok(liveBinding);
  assert.ok(liveBinding.commandTtlMs <= 1_000);
  liveExpiresAt = performance.now() + 20_000;
  liveCommandTtl = 7_000;
  assert.ok(liveBinding.commandTtlMs > 6_000 && liveBinding.commandTtlMs <= 7_000,
    "the next permit must read the renewed lease budget instead of a stale GPT snapshot");
  await liveBudgetLifecycle.settle(null);

  const readbackBindings: BrowserExecutionBinding[] = [];
  const readbackParks: Array<Readonly<{ reason: string; mode: string }>> = [];
  let readbackAcquisitions = 0;
  const readbackLifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async (binding: BrowserExecutionBinding) => {
        readbackBindings.push(binding);
        readbackAcquisitions += 1;
        return {
          target: { targetRef: `target:confirmed-readback:${readbackAcquisitions}` },
          document: { documentRef: `document:confirmed-readback:${readbackAcquisitions}` },
          pendingMutationCount: () => 0,
          requiresMutationRecovery: () => false,
          park: async (input: Readonly<{ reason: string; mode: string }>) => {
            readbackParks.push(input);
          },
          close: async () => undefined,
        };
      },
    } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: "attempt:confirmed-readback-scope",
      pluginId: "payment-screenshot-observation", pluginVersion: 1,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  readbackLifecycle.authorizeConfirmedProviderReadback({
    schemaVersion: "browser-confirmed-provider-readback.v1",
    sourceAttemptId: "attempt:confirmed-readback-scope",
    sourceExactCallIdentityHash: HASH_A,
    sourceActionOrdinal: 12,
    sourceProductStepId: "corpus_research",
    sourceCallId: "turn-submit",
    sourceChildCapabilityId: "submit_exact_gpt_turn_once",
    sourceTargetRef: "target:confirmed-readback:source",
    sourceDocumentRef: "document:confirmed-readback:source",
    readbackDocumentRefHash: documentHash("document:confirmed-readback:successor"),
    sourceTerminalAt: new Date().toISOString(),
    evidenceRef: "evidence:confirmed-readback",
    evidenceHash: HASH_B,
    canonicalConversationUrl: "https://chatgpt.com/c/confirmed-readback-scope",
    conversationIdentityHash: HASH_A,
    promptHash: HASH_A,
    turnMarker: "[GRASSEYE:confirmed-readback-scope]",
  });
  await readbackLifecycle.browserFor(
    "session:confirmed-readback", "corpus_research", "text-wait",
  );
  await readbackLifecycle.browserFor(
    "session:next-product-step", "article_draft", "draft-submit",
  );
  assert.deepEqual(readbackBindings.map((binding) => binding.kind), [
    "production-reconciliation", "production",
  ], "confirmed-readback authority must end before the next Product step");
  assert.deepEqual(readbackParks, [{
    reason: "gpt-confirmed-provider-readback-complete", mode: "normal-provider-wait",
  }]);
  await readbackLifecycle.settle(null);

  const sequentialBindings: BrowserExecutionBinding[] = [];
  const sequentialParks: Array<Readonly<{ reason: string; mode: string }>> = [];
  const sequentialLifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async (binding: BrowserExecutionBinding) => {
        sequentialBindings.push(binding);
        const authorization = binding.kind === "production-confirmed-source-readback"
          ? binding.confirmedProviderSourceReadback
          : binding.kind === "production-reconciliation"
            ? binding.confirmedProviderReadback
            : null;
        return {
          target: { targetRef: authorization?.sourceTargetRef ?? "target:sequential-normal" },
          document: {
            documentRef: authorization?.sourceDocumentRef ?? "document:sequential-normal",
            targetRef: authorization?.sourceTargetRef ?? "target:sequential-normal",
            navigationEpoch: 1,
          },
          pendingMutationCount: () => 0,
          requiresMutationRecovery: () => false,
          park: async (input: Readonly<{ reason: string; mode: string }>) => {
            sequentialParks.push(input);
          },
          close: async () => undefined,
        };
      },
    } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: "attempt:sequential-confirmed-readback",
      pluginId: "localization-production", pluginVersion: 14,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  const sequentialSource = (productStepId: string, suffix: string) => Object.freeze({
    schemaVersion: "browser-confirmed-provider-source-readback.v1" as const,
    sourceAttemptId: "attempt:sequential-confirmed-readback",
    sourceExactCallIdentityHash: suffix === "a" ? HASH_A : HASH_B,
    sourceActionOrdinal: 10,
    sourceProductStepId: productStepId,
    sourceCallId: "turn-submit",
    sourceChildCapabilityId: "submit_exact_gpt_turn_once" as const,
    sourceTargetRef: `target:sequential-${suffix}`,
    sourceDocumentRef: `document:sequential-${suffix}`,
    readbackDocumentRefHash: documentHash(`document:sequential-${suffix}:successor`),
    sourceTerminalAt: new Date().toISOString(),
    evidenceRef: `evidence:sequential-${suffix}`,
    evidenceHash: suffix === "a" ? HASH_B : HASH_A,
    promptHash: suffix === "a" ? HASH_A : HASH_B,
    turnMarker: `[GRASSEYE:sequential-${suffix}]`,
  });
  const sequentialA = sequentialSource("batch:candidate-a", "a");
  await sequentialLifecycle.authorizeConfirmedProviderSourceReadback(sequentialA);
  await sequentialLifecycle.browserFor("session:sequential-a", sequentialA.sourceProductStepId, "turn-submit");
  sequentialLifecycle.authorizeConfirmedProviderReadback({
    ...sequentialA,
    schemaVersion: "browser-confirmed-provider-readback.v1",
    canonicalConversationUrl: "https://chatgpt.com/c/sequential-a",
    conversationIdentityHash: HASH_A,
  });
  const sequentialB = sequentialSource("batch:candidate-b", "b");
  await sequentialLifecycle.authorizeConfirmedProviderSourceReadback(sequentialB);
  await sequentialLifecycle.browserFor("session:sequential-b", sequentialB.sourceProductStepId, "turn-submit");
  assert.deepEqual(sequentialBindings.map((binding) => binding.kind), [
    "production-confirmed-source-readback", "production-confirmed-source-readback",
  ], "a later Product step must acquire only its own confirmed-submit readback authority");
  const sequentialBBinding = sequentialBindings[1];
  assert.equal(sequentialBBinding?.kind, "production-confirmed-source-readback");
  if (sequentialBBinding?.kind !== "production-confirmed-source-readback") {
    throw new Error("SEQUENTIAL_B_CONFIRMED_SOURCE_READBACK_BINDING_MISSING");
  }
  assert.deepEqual(sequentialBBinding.confirmedProviderSourceReadback, sequentialB,
    "candidate B must acquire Browser authority with candidate B's exact confirmed-submit identity");
  assert.deepEqual(sequentialParks, [{
    reason: "gpt-confirmed-provider-readback-complete", mode: "normal-provider-wait",
  }], "the completed candidate readback must be parked before the next confirmed source is authorized");
  await sequentialLifecycle.settle(null);

  const confirmedAt = new Date().toISOString();
  const failureReadbackAuthorization: BrowserConfirmedProviderSourceReadbackAuthorization = Object.freeze({
    schemaVersion: "browser-confirmed-provider-source-readback.v1",
    sourceAttemptId: "attempt:confirmed-failure-readback",
    sourceExactCallIdentityHash: HASH_A,
    sourceActionOrdinal: 12,
    sourceProductStepId: "corpus_research",
    sourceCallId: "turn-submit",
    sourceChildCapabilityId: "submit_exact_gpt_turn_once",
    sourceTargetRef: "target:confirmed-failure-readback",
    sourceDocumentRef: "document:confirmed-failure-readback",
    readbackDocumentRefHash: documentHash("document:confirmed-failure-readback:successor"),
    sourceTerminalAt: confirmedAt,
    evidenceRef: "evidence:confirmed-failure-readback",
    evidenceHash: HASH_B,
    promptHash: HASH_A,
    turnMarker: "[GRASSEYE:confirmed-failure-readback]",
  });
  assert.equal(confirmedSourceReadbackDocumentMatches(failureReadbackAuthorization, {
    target: { targetRef: failureReadbackAuthorization.sourceTargetRef },
    document: {
      documentRef: failureReadbackAuthorization.sourceDocumentRef,
      targetRef: failureReadbackAuthorization.sourceTargetRef,
      navigationEpoch: 1,
    },
  } as never), true, "the immutable submit source D0 remains legal");
  assert.equal(confirmedSourceReadbackDocumentMatches(failureReadbackAuthorization, {
    target: { targetRef: failureReadbackAuthorization.sourceTargetRef },
    document: {
      documentRef: "document:confirmed-failure-readback:successor",
      targetRef: failureReadbackAuthorization.sourceTargetRef,
      navigationEpoch: 2,
    },
  } as never), true, "the hash-bound direct submit successor D1 is legal");
  assert.equal(confirmedSourceReadbackDocumentMatches(failureReadbackAuthorization, {
    target: { targetRef: failureReadbackAuthorization.sourceTargetRef },
    document: {
      documentRef: "document:confirmed-failure-readback:later",
      targetRef: failureReadbackAuthorization.sourceTargetRef,
      navigationEpoch: 3,
    },
  } as never), false, "a same-Target later D2 must never inherit source-only authority");
  assert.equal(confirmedSourceReadbackDocumentMatches(failureReadbackAuthorization, {
    target: { targetRef: "target:other" },
    document: {
      documentRef: "document:confirmed-failure-readback:successor",
      targetRef: "target:other",
      navigationEpoch: 2,
    },
  } as never), false, "a hash match on another Target must fail closed");
  const failureReadbackBindings: BrowserExecutionBinding[] = [];
  const failureReadbackParks: Array<Readonly<{ reason: string; mode: string }>> = [];
  const failureReadbackLifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async (binding: BrowserExecutionBinding) => {
        failureReadbackBindings.push(binding);
        return {
          target: { targetRef: failureReadbackAuthorization.sourceTargetRef },
          document: { documentRef: failureReadbackAuthorization.sourceDocumentRef },
          pendingMutationCount: () => 0, requiresMutationRecovery: () => false,
          park: async (input: Readonly<{ reason: string; mode: string }>) => {
            failureReadbackParks.push(input);
          },
          close: async () => undefined,
        };
      },
    } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: failureReadbackAuthorization.sourceAttemptId,
      pluginId: "payment-screenshot-observation", pluginVersion: 1,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  await failureReadbackLifecycle.authorizeConfirmedProviderSourceReadback(failureReadbackAuthorization);
  await failureReadbackLifecycle.browserFor(
    "session:confirmed-failure-readback", "corpus_research", "turn-reconcile",
  );
  assert.equal(failureReadbackBindings[0]?.kind, "production-confirmed-source-readback",
    "reading a confirmed submit failure must authorize the exact source target before reconcile acquisition");
  if (failureReadbackBindings[0]?.kind === "production-confirmed-source-readback") {
    assert.deepEqual(
      failureReadbackBindings[0].confirmedProviderSourceReadback,
      failureReadbackAuthorization,
    );
  }
  failureReadbackLifecycle.authorizeConfirmedProviderReadback({
    ...failureReadbackAuthorization,
    schemaVersion: "browser-confirmed-provider-readback.v1",
    canonicalConversationUrl: "https://chatgpt.com/c/confirmed-failure-readback",
    conversationIdentityHash: HASH_B,
  });
  assert.throws(
    () => failureReadbackLifecycle.authorizeConfirmedProviderReadback({
      ...failureReadbackAuthorization,
      schemaVersion: "browser-confirmed-provider-readback.v1",
      sourceCallId: "other-submit",
      canonicalConversationUrl: "https://chatgpt.com/c/confirmed-failure-readback",
      conversationIdentityHash: HASH_B,
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "BROWSER_RECONCILIATION_SCOPE_INVALID",
    "a locator may upgrade only the same confirmed-submit source authorization",
  );
  await failureReadbackLifecycle.settle(new Error("GPT_TURN_SUBMISSION_RECONCILIATION_PENDING"));
  assert.deepEqual(failureReadbackParks, [{
    reason: "gpt-product-call-failed",
    mode: "normal-provider-wait",
  }], "a failed confirmed-submit reconciliation must release the Browser lane for the next queued task");

  let allowedReadCount = 0;
  let allowedMediaReadCount = 0;
  let sourceReadbackActionCount = 0;
  const exactActiveBrowser = {
    target: { targetRef: failureReadbackAuthorization.sourceTargetRef },
    document: {
      documentRef: "document:confirmed-failure-readback:successor",
      targetRef: failureReadbackAuthorization.sourceTargetRef,
      navigationEpoch: 2,
    },
    runAtomicStep: async (_identity: unknown, action: () => Promise<unknown>) => action(),
    readAtomicStepRecovery: (identity: Readonly<{
      productStepId: string; callId: string; childCapabilityId: string;
      actionOrdinal: number; replayPolicy: string;
    }>) => identity.replayPolicy === "provider-effect-once"
      && identity.childCapabilityId === "submit_exact_gpt_turn_once"
      && identity.productStepId === failureReadbackAuthorization.sourceProductStepId
      && identity.callId === failureReadbackAuthorization.sourceCallId
      && identity.actionOrdinal === failureReadbackAuthorization.sourceActionOrdinal
      ? Object.freeze({
          state: "confirmed" as const,
          mutationOutcome: "confirmed" as const,
          terminalAt: confirmedAt,
          failureCode: null,
          nativeFailureCode: null,
          authorityRef: "browser-mutation:confirmed-source",
          authorityHash: HASH_A,
          targetRef: failureReadbackAuthorization.sourceTargetRef,
          documentRef: failureReadbackAuthorization.sourceDocumentRef,
        })
      : null,
    requiresMutationRecovery: () => false,
    navigate: async () => ({ documentRef: "document:navigated" }),
    executeDomIntent: async () => { allowedReadCount += 1; return Object.freeze({}); },
    observeCapability: async () => Object.freeze({}),
    captureScreenshot: async () => Object.freeze({ artifactRef: "screenshot:unexpected", contentHash: HASH_A }),
    attachFile: async () => undefined,
    downloadAuthenticatedMedia: async () => {
      allowedMediaReadCount += 1;
      return Object.freeze({});
    },
    wait: async () => undefined,
    park: async () => undefined,
    close: async () => undefined,
    resolvePendingMutation: async () => 0,
    pendingMutationCount: () => 0,
    assertNoPendingMutations: () => undefined,
  };
  const reacquiredActiveBrowser = {
    ...exactActiveBrowser,
    document: {
      documentRef: "document:confirmed-failure-readback:reacquired",
      targetRef: failureReadbackAuthorization.sourceTargetRef,
      navigationEpoch: 3,
    },
  };
  let activeFailureReadbackAcquisitions = 0;
  const activeFailureReadbackLifecycle = new ProductionGptBrowserLifecycle(
    { acquireJobBoundTargetLease: async () => {
      activeFailureReadbackAcquisitions += 1;
      return activeFailureReadbackAcquisitions === 1 ? exactActiveBrowser : reacquiredActiveBrowser;
    } } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: failureReadbackAuthorization.sourceAttemptId,
      pluginId: "payment-screenshot-observation", pluginVersion: 1,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  const activeFailureReadback = await activeFailureReadbackLifecycle.browserFor(
    "session:active-confirmed-failure-readback", "corpus_research", "turn-submit",
  );
  await activeFailureReadbackLifecycle.authorizeConfirmedProviderSourceReadback(failureReadbackAuthorization);
  await activeFailureReadback.facade.runAtomicStep({
    productStepId: failureReadbackAuthorization.sourceProductStepId,
    callId: failureReadbackAuthorization.sourceCallId,
    childCapabilityId: "submit_exact_gpt_turn_once",
    inputHash: HASH_A,
    actionOrdinal: failureReadbackAuthorization.sourceActionOrdinal,
    replayPolicy: "provider-effect-once",
  }, async () => { sourceReadbackActionCount += 1; });
  assert.equal(sourceReadbackActionCount, 1,
    "source-only authority must allow exactly the recovered confirmed submit to settle its locator");
  await assert.rejects(
    activeFailureReadback.facade.runAtomicStep({
      productStepId: failureReadbackAuthorization.sourceProductStepId,
      callId: "other-submit",
      childCapabilityId: "submit_exact_gpt_turn_once",
      inputHash: HASH_A,
      actionOrdinal: failureReadbackAuthorization.sourceActionOrdinal,
      replayPolicy: "provider-effect-once",
    }, async () => { sourceReadbackActionCount += 1; }),
    (error: unknown) => typedExecutionFailure(error)?.code === "BROWSER_RECONCILIATION_SCOPE_INVALID",
  );
  assert.equal(sourceReadbackActionCount, 1,
    "source-only authority must reject every non-identical provider submit");
  await activeFailureReadback.facade.executeDomIntent({ kind: "observe" } as never);
  assert.equal(allowedReadCount, 1);
  await assert.rejects(
    () => activeFailureReadback.facade.executeDomIntent({ kind: "fill" } as never),
    (error: unknown) => typedExecutionFailure(error)?.code === "BROWSER_RECONCILIATION_SCOPE_INVALID",
  );
  await assert.rejects(
    () => activeFailureReadback.facade.navigate({ url: "https://chatgpt.com/", title: "forbidden" }),
    (error: unknown) => typedExecutionFailure(error)?.code === "BROWSER_RECONCILIATION_SCOPE_INVALID",
  );
  await assert.rejects(
    () => activeFailureReadback.facade.downloadAuthenticatedMedia({
      assistantTurnId: "conversation-turn-2",
      semanticMediaId: "gpt-generated-image-main",
      delivery: "probe",
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "BROWSER_RECONCILIATION_SCOPE_INVALID",
  );
  assert.equal(allowedMediaReadCount, 0,
    "source-only failure readback must not authorize output-media access before locator closure");
  activeFailureReadbackLifecycle.authorizeConfirmedProviderReadback({
    ...failureReadbackAuthorization,
    schemaVersion: "browser-confirmed-provider-readback.v1",
    canonicalConversationUrl: "https://chatgpt.com/c/confirmed-failure-readback",
    conversationIdentityHash: HASH_B,
  });
  await activeFailureReadback.facade.runAtomicStep({
    productStepId: "corpus_research", callId: "text-wait",
    childCapabilityId: "wait_for_stable_gpt_text", inputHash: HASH_A,
    actionOrdinal: 15, replayPolicy: "target-local-per-generation",
  }, () => activeFailureReadback.facade.navigate({
    url: "https://chatgpt.com/c/confirmed-failure-readback",
    title: "confirmed readback",
  }));
  await assert.rejects(
    activeFailureReadback.facade.runAtomicStep({
      productStepId: "corpus_research", callId: "forbidden-submit",
      childCapabilityId: "submit_exact_gpt_turn_once", inputHash: HASH_A,
      actionOrdinal: 16, replayPolicy: "provider-effect-once",
    }, async () => undefined),
    (error: unknown) => typedExecutionFailure(error)?.code === "BROWSER_RECONCILIATION_SCOPE_INVALID",
  );
  await activeFailureReadbackLifecycle.yieldForProviderWait(
    activeFailureReadback, "corpus_research", "text-wait", "wait_for_stable_gpt_text", 25,
  );
  assert.equal(
    activeFailureReadback.facade.document.documentRef,
    "document:confirmed-failure-readback:reacquired",
    "confirmed-readback policy must remain attached to the newly reacquired lease",
  );
  await activeFailureReadback.facade.downloadAuthenticatedMedia({
    assistantTurnId: "conversation-turn-2",
    semanticMediaId: "gpt-generated-image-main",
    delivery: "probe",
  });
  assert.equal(allowedMediaReadCount, 1,
    "the matching durable locator must upgrade the same facade to full read-only output recovery");
  await activeFailureReadbackLifecycle.settle(null);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
