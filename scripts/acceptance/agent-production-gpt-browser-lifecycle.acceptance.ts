import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../../src/lib/local-runtime/production/production-gpt-browser-lifecycle.js";
import type { BrowserExecutionBinding } from "../../src/lib/browser/browser-authority-api.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { typedExecutionFailure } from "../../src/lib/typed-failure.js";
import { HASH_A, HASH_B, task } from "./agent-production-runtime-fixtures.js";

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
      task: waitTask,
      pluginId: "payment-screenshot-observation",
      pluginVersion: 1,
      lease: {
        attempt_id: "attempt:provider-wait-progress",
        device_id: "device:1",
        lease_version: 1,
        execution_fence_hash: HASH_A,
        control_manifest_hash: HASH_B,
        max_provider_turns: 1,
        provider_turns_used: 0,
        expires_at_monotonic: performance.now() + 10_000,
        command_ttl_ms: 1_000,
        abort_signal: new AbortController().signal,
      },
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
      task: waitTask,
      pluginId: "payment-screenshot-observation",
      pluginVersion: 1,
      lease: {
        attempt_id: "attempt:confirmed-readback-scope",
        device_id: "device:1",
        lease_version: 1,
        execution_fence_hash: HASH_A,
        control_manifest_hash: HASH_B,
        max_provider_turns: 2,
        provider_turns_used: 1,
        expires_at_monotonic: performance.now() + 10_000,
        command_ttl_ms: 1_000,
        abort_signal: new AbortController().signal,
      },
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
      task: waitTask,
      pluginId: "payment-screenshot-observation",
      pluginVersion: 1,
      lease: {
        attempt_id: "attempt:provider-wait-mismatch",
        device_id: "device:1",
        lease_version: 1,
        execution_fence_hash: HASH_A,
        control_manifest_hash: HASH_B,
        max_provider_turns: 1,
        provider_turns_used: 0,
        expires_at_monotonic: performance.now() + 10_000,
        command_ttl_ms: 1_000,
        abort_signal: new AbortController().signal,
      },
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
