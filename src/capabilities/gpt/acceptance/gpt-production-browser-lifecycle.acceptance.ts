import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import type {
  BrowserConfirmedProviderFailureReadbackAuthorization,
  BrowserExecutionBinding,
} from "../../../lib/browser/browser-authority-api.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { typedExecutionFailure } from "../../../lib/execution-failure.js";
import { HASH_A, HASH_B, task } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-provider-wait-progress-"));
try {
  const runtimeLogger = createRuntimeLogger({
    producer: "agent-provider-wait-acceptance",
    owner: "production-runtime",
    component: "gpt-child",
    terminalEnabled: false,
    fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
  });
  let acquisitions = 0;
  let parks = 0;
  let closes = 0;
  const parkInputs: Array<Readonly<{ reason: string; mode: string }>> = [];
  const browsers = Array.from({ length: 5 }, (_unused, index) => ({
    target: { targetRef: "target:provider-wait" },
    document: { documentRef: `document:${index + 1}` },
    pendingMutationCount: () => 0,
    requiresMutationRecovery: () => false,
    park: async (input: Readonly<{ reason: string; mode: string }>) => {
      parks += 1;
      parkInputs.push(input);
    },
    close: async () => { closes += 1; },
  }));
  const waitTask = task({
    jobId: "job:provider-wait-progress",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  const lifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async () => {
        const browser = browsers[acquisitions];
        acquisitions += 1;
        if (!browser) throw new Error("UNEXPECTED_BROWSER_ACQUISITION");
        return browser;
      },
    } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: "attempt:provider-wait-progress",
      pluginId: "payment-screenshot-observation", pluginVersion: 1,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, controlManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  const active = await lifecycle.browserFor(
    "session:provider-wait",
    "corpus_research",
    "text-wait",
  );
  assert.equal(active.facade.document.documentRef, "document:1");
  await lifecycle.yieldForProviderWait(
    active, "corpus_research", "text-wait", "wait_for_stable_gpt_text", 25,
  );
  assert.equal(active.facade.document.documentRef, "document:2",
    "the stable Browser facade must point at the newly reacquired Document");
  await lifecycle.yieldForProviderWait(
    active, "corpus_research", "text-wait", "wait_for_stable_gpt_text", 25,
  );
  assert.equal(active.facade.document.documentRef, "document:3");
  active.providerWaitLog = { ...active.providerWaitLog!, emittedAt: performance.now() - 30_001 };
  await lifecycle.yieldForProviderWait(
    active, "corpus_research", "text-wait", "wait_for_stable_gpt_text", 25,
  );
  assert.equal(active.facade.document.documentRef, "document:4");
  await lifecycle.yieldForProviderWait(
    active, "corpus_research", "image-wait", "wait_for_stable_gpt_image", 25,
  );
  assert.equal(active.facade.document.documentRef, "document:5");
  await lifecycle.settle(null);
  assert.deepEqual([acquisitions, parks, closes], [5, 5, 0],
    "normal completion must park the one reusable production Tab instead of closing it");
  assert.deepEqual(parkInputs, [
    ...Array.from({ length: 4 }, () => ({
      reason: "gpt-normal-provider-wait-yield", mode: "normal-provider-wait",
    })),
    { reason: "gpt-product-call-settled", mode: "normal-provider-wait" },
  ]);
  const waitEvents = (await readFile(runtimeLogger.currentSegmentPath()!, "utf8")).trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
    .filter((event) => event.code === "GPT_PROVIDER_WAIT_ACTIVE");
  assert.equal(waitEvents.length, 3,
    "the same Provider wait logs once per bounded interval, while a new exact call logs immediately");
  assert.deepEqual(waitEvents.map((event) => {
    const identity = event.typedIdentity as Readonly<Record<string, unknown>>;
    return [event.operation, identity.kind, identity.stepId, identity.capabilityCallId];
  }), [
    ["gpt.child", "gpt-call", "corpus_research", "text-wait:wait_for_stable_gpt_text"],
    ["gpt.child", "gpt-call", "corpus_research", "text-wait:wait_for_stable_gpt_text"],
    ["gpt.child", "gpt-call", "corpus_research", "image-wait:wait_for_stable_gpt_image"],
  ]);

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
      executionFenceHash: HASH_A, controlManifestHash: HASH_B,
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
      executionFenceHash: HASH_A, controlManifestHash: HASH_B,
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

  const confirmedAt = new Date().toISOString();
  const failureReadbackAuthorization: BrowserConfirmedProviderFailureReadbackAuthorization = Object.freeze({
    schemaVersion: "browser-confirmed-provider-failure-readback.v1",
    sourceAttemptId: "attempt:confirmed-failure-readback",
    sourceExactCallIdentityHash: HASH_A,
    sourceActionOrdinal: 12,
    sourceProductStepId: "corpus_research",
    sourceCallId: "turn-submit",
    sourceChildCapabilityId: "submit_exact_gpt_turn_once",
    sourceTargetRef: "target:confirmed-failure-readback",
    sourceDocumentRef: "document:confirmed-failure-readback",
    sourceTerminalAt: confirmedAt,
    evidenceRef: "evidence:confirmed-failure-readback",
    evidenceHash: HASH_B,
    promptHash: HASH_A,
    turnMarker: "[GRASSEYE:confirmed-failure-readback]",
  });
  const failureReadbackBindings: BrowserExecutionBinding[] = [];
  const failureReadbackLifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async (binding: BrowserExecutionBinding) => {
        failureReadbackBindings.push(binding);
        return {
          target: { targetRef: failureReadbackAuthorization.sourceTargetRef },
          document: { documentRef: failureReadbackAuthorization.sourceDocumentRef },
          pendingMutationCount: () => 0, requiresMutationRecovery: () => false,
          park: async () => undefined, close: async () => undefined,
        };
      },
    } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: failureReadbackAuthorization.sourceAttemptId,
      pluginId: "payment-screenshot-observation", pluginVersion: 1,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, controlManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  failureReadbackLifecycle.authorizeConfirmedProviderFailureReadback(failureReadbackAuthorization);
  await failureReadbackLifecycle.browserFor(
    "session:confirmed-failure-readback", "corpus_research", "turn-reconcile",
  );
  assert.equal(failureReadbackBindings[0]?.kind, "production-confirmed-failure-readback",
    "reading a confirmed submit failure must authorize the exact source target before reconcile acquisition");
  if (failureReadbackBindings[0]?.kind === "production-confirmed-failure-readback") {
    assert.deepEqual(
      failureReadbackBindings[0].confirmedProviderFailureReadback,
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
  await failureReadbackLifecycle.settle(null);

  let allowedReadCount = 0;
  let allowedMediaReadCount = 0;
  const exactActiveBrowser = {
    target: { targetRef: failureReadbackAuthorization.sourceTargetRef },
    document: { documentRef: failureReadbackAuthorization.sourceDocumentRef },
    runAtomicStep: async (_identity: unknown, action: () => Promise<unknown>) => action(),
    readAtomicStepRecovery: () => null,
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
    document: { documentRef: "document:confirmed-failure-readback:reacquired" },
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
      executionFenceHash: HASH_A, controlManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  const activeFailureReadback = await activeFailureReadbackLifecycle.browserFor(
    "session:active-confirmed-failure-readback", "corpus_research", "turn-submit",
  );
  activeFailureReadbackLifecycle.authorizeConfirmedProviderFailureReadback(failureReadbackAuthorization);
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
  });
  assert.equal(allowedMediaReadCount, 1,
    "the matching durable locator must upgrade the same facade to full read-only output recovery");
  await activeFailureReadbackLifecycle.settle(null);

  const cleanupError = new Error("TEST_REACQUIRED_TARGET_CLOSE_FAILED");
  const originalBrowser = {
    target: { targetRef: "target:provider-wait:original" },
    pendingMutationCount: () => 0,
    requiresMutationRecovery: () => false,
    park: async () => undefined,
    close: async () => undefined,
  };
  const mismatchedBrowser = {
    ...originalBrowser,
    target: { targetRef: "target:provider-wait:mismatched" },
    close: async () => { throw cleanupError; },
  };
  let mismatchAcquisitions = 0;
  const mismatchLifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async () => {
        mismatchAcquisitions += 1;
        return mismatchAcquisitions === 1 ? originalBrowser : mismatchedBrowser;
      },
    } as never,
    runtimeLogger,
    HASH_A,
    {
      jobId: waitTask.job_id, attemptId: "attempt:provider-wait-mismatch",
      pluginId: "payment-screenshot-observation", pluginVersion: 1,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, controlManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  const mismatchActive = await mismatchLifecycle.browserFor(
    "session:provider-wait-mismatch",
    "corpus_research",
    "text-wait",
  );
  await assert.rejects(
    () => mismatchLifecycle.yieldForProviderWait(
      mismatchActive, "corpus_research", "text-wait", "wait_for_stable_gpt_text", 25,
    ),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(typedExecutionFailure(error)?.code, "BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
      assert.deepEqual(error.errors, [cleanupError]);
      return true;
    },
  );
  await mismatchLifecycle.settle(null);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
