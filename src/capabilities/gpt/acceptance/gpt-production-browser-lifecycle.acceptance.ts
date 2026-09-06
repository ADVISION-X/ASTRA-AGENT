import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
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
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { typedExecutionFailure } from "../../../lib/execution-failure.js";
import { HASH_A, HASH_B, task } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

{
  const cadence = new GptCrossConversationPollCadence();
  assert.deepEqual(cadence.reserve(1_000), { kind: "reserved" });
  assert.deepEqual(cadence.reserve(1_001), {
    kind: "wait", durationMs: GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS - 1,
  });
  assert.deepEqual(cadence.reserve(31_000), { kind: "reserved" });
  assert.deepEqual(cadence.reserve(31_000), {
    kind: "wait", durationMs: GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS,
  }, "one synchronous winner must reserve the shared cross-conversation poll eligibility");
  const dispatchCadence = new GptCrossConversationPollCadence();
  assert.deepEqual(dispatchCadence.reserve(1_000), { kind: "reserved" });
  dispatchCadence.bindDispatch(1_100);
  assert.deepEqual(dispatchCadence.reserve(31_000), { kind: "wait", durationMs: 100 });
  assert.deepEqual(dispatchCadence.reserve(31_100), { kind: "reserved" },
    "eligibility must be measured from the actual navigate entry binding, not the provisional reservation");
}

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

  let crossConversationNow = 0;
  const nativePerformanceNow = performance.now.bind(performance);
  Object.defineProperty(performance, "now", {
    configurable: true,
    value: () => crossConversationNow,
  });
  const crossConversationParks: Array<Readonly<{ reason: string; mode: string }>> = [];
  const crossConversationNavigations: Array<Readonly<{ url: string; title: string; at: number }>> = [];
  let crossConversationAcquisitions = 0;
  const crossConversationAuthority = {
    acquireJobBoundTargetLease: async () => {
      crossConversationAcquisitions += 1;
      return {
        target: { targetRef: "target:cross-conversation-poll" },
        document: { documentRef: `document:cross-conversation-poll:${crossConversationAcquisitions}` },
        pendingMutationCount: () => 0,
        requiresMutationRecovery: () => false,
        park: async (input: Readonly<{ reason: string; mode: string }>) => {
          crossConversationParks.push(input);
        },
        navigate: async (input: Readonly<{ url: string; title: string }>) => {
          const cadenceAtDispatch = productionGptCrossConversationPollCadence.reserve(performance.now());
          assert.equal(cadenceAtDispatch.kind, "wait",
            "the global cadence must be reserved before Browser navigate is invoked");
          if (cadenceAtDispatch.kind === "wait") assert.equal(
            cadenceAtDispatch.durationMs,
            GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS,
            "the cadence check-and-set and Browser navigate invocation must share one synchronous stack",
          );
          crossConversationNavigations.push({ ...input, at: performance.now() });
        },
        close: async () => undefined,
      };
    },
  };
  const crossExecution = (
    jobId: string,
    abortSignal: AbortSignal = new AbortController().signal,
  ) => ({
    jobId, attemptId: `attempt:${jobId}`,
    pluginId: "payment-screenshot-observation", pluginVersion: 1,
    deviceId: "device:1", leaseVersion: 1,
    executionFenceHash: HASH_A, controlManifestHash: HASH_B,
    expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
    abortSignal,
  });
  const firstCrossLifecycle = new ProductionGptBrowserLifecycle(
    crossConversationAuthority as never, runtimeLogger, HASH_A, crossExecution("job:cross-text"),
  );
  const firstCrossActive = await firstCrossLifecycle.browserFor(
    "session:cross-text", "corpus_research", "text-wait",
  );
  assert.equal(await firstCrossLifecycle.navigateCrossConversationPoll(
    firstCrossActive, "corpus_research", "text-wait", "wait_for_stable_gpt_text",
    "https://chatgpt.com/c/cross-text", Date.now() + 1_000,
  ), "navigated");
  assert.deepEqual(crossConversationNavigations, [{
    url: "https://chatgpt.com/c/cross-text", title: "poll exact GPT conversation", at: 0,
  }]);
  crossConversationNow = GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS;
  const secondCrossLifecycle = new ProductionGptBrowserLifecycle(
    crossConversationAuthority as never, runtimeLogger, HASH_A, crossExecution("job:cross-image"),
  );
  const secondCrossActive = await secondCrossLifecycle.browserFor(
    "session:cross-image", "image_generation", "image-wait",
  );
  assert.equal(await secondCrossLifecycle.navigateCrossConversationPoll(
    secondCrossActive, "image_generation", "image-wait", "wait_for_stable_gpt_image",
    "https://chatgpt.com/c/cross-image", Date.now() + 1_000,
  ), "navigated");
  assert.equal(crossConversationNavigations.length, 2);
  assert.equal(crossConversationNavigations[1]!.at - crossConversationNavigations[0]!.at,
    GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS,
    "actual Browser navigate entries from different jobs must be at least 30000ms apart");
  let postReserveRaceNavigations = 0;
  const postReserveRaceAuthority = {
    acquireJobBoundTargetLease: async () => ({
      target: { targetRef: "target:post-reserve-race" },
      document: { documentRef: "document:post-reserve-race" },
      pendingMutationCount: () => 0,
      requiresMutationRecovery: () => false,
      navigate: async () => { postReserveRaceNavigations += 1; },
      park: async () => undefined,
      close: async () => undefined,
    }),
  };
  const nativeReserve = productionGptCrossConversationPollCadence.reserve.bind(
    productionGptCrossConversationPollCadence,
  );
  const nativeDateNow = Date.now;
  let deadlineRaceNow = 0;
  crossConversationNow = GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS * 2;
  Object.defineProperty(productionGptCrossConversationPollCadence, "reserve", {
    configurable: true,
    value: (now: number) => {
      const reserved = nativeReserve(now);
      deadlineRaceNow = 100;
      return reserved;
    },
  });
  Date.now = () => deadlineRaceNow;
  const postReserveDeadlineLifecycle = new ProductionGptBrowserLifecycle(
    postReserveRaceAuthority as never, runtimeLogger, HASH_A, crossExecution("job:post-reserve-deadline"),
  );
  const postReserveDeadlineActive = await postReserveDeadlineLifecycle.browserFor(
    "session:post-reserve-deadline", "corpus_research", "post-reserve-deadline",
  );
  assert.equal(await postReserveDeadlineLifecycle.navigateCrossConversationPoll(
    postReserveDeadlineActive, "corpus_research", "post-reserve-deadline", "wait_for_stable_gpt_text",
    "https://chatgpt.com/c/post-reserve-deadline", 100,
  ), "deadline");
  Date.now = nativeDateNow;
  Object.defineProperty(productionGptCrossConversationPollCadence, "reserve", {
    configurable: true,
    value: nativeReserve,
  });
  assert.equal(postReserveRaceNavigations, 0,
    "a deadline reached synchronously after reserve must stop before Browser navigate");
  await postReserveDeadlineLifecycle.settle(new Error("post-reserve deadline"));
  const postReserveAbortController = new AbortController();
  crossConversationNow = GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS * 3;
  Object.defineProperty(productionGptCrossConversationPollCadence, "reserve", {
    configurable: true,
    value: (now: number) => {
      const reserved = nativeReserve(now);
      postReserveAbortController.abort();
      return reserved;
    },
  });
  const postReserveAbortLifecycle = new ProductionGptBrowserLifecycle(
    postReserveRaceAuthority as never, runtimeLogger, HASH_A,
    crossExecution("job:post-reserve-abort", postReserveAbortController.signal),
  );
  const postReserveAbortActive = await postReserveAbortLifecycle.browserFor(
    "session:post-reserve-abort", "corpus_research", "post-reserve-abort",
  );
  await assert.rejects(
    () => postReserveAbortLifecycle.navigateCrossConversationPoll(
      postReserveAbortActive, "corpus_research", "post-reserve-abort", "wait_for_stable_gpt_text",
      "https://chatgpt.com/c/post-reserve-abort", Date.now() + 1_000,
    ),
    (error: unknown) => typedExecutionFailure(error)?.code === "GPT_RESPONSE_WAIT_ABORTED",
  );
  Object.defineProperty(productionGptCrossConversationPollCadence, "reserve", {
    configurable: true,
    value: nativeReserve,
  });
  assert.equal(postReserveRaceNavigations, 0,
    "an abort raised synchronously after reserve must stop before Browser navigate");
  await postReserveAbortLifecycle.settle(new Error("post-reserve abort"));
  const deadlineCrossLifecycle = new ProductionGptBrowserLifecycle(
    crossConversationAuthority as never, runtimeLogger, HASH_A, crossExecution("job:cross-deadline"),
  );
  const deadlineCrossActive = await deadlineCrossLifecycle.browserFor(
    "session:cross-deadline", "corpus_research", "deadline-wait",
  );
  assert.equal(await deadlineCrossLifecycle.navigateCrossConversationPoll(
    deadlineCrossActive, "corpus_research", "deadline-wait", "wait_for_stable_gpt_text",
    "https://chatgpt.com/c/cross-deadline", Date.now() + 25,
  ), "deadline");
  assert.equal(crossConversationAcquisitions, 3,
    "a Product deadline that wins the cadence race must not reacquire the Browser FIFO");
  assert.deepEqual(crossConversationParks, [{
    reason: "gpt-cross-conversation-poll-wait", mode: "normal-provider-wait",
  }], "a different job and wait Child must park outside the FIFO while the global eligibility is closed");
  await deadlineCrossLifecycle.settle(new Error("deadline already settled outside the FIFO"));
  assert.equal(crossConversationParks.length, 1,
    "settle must not park a deadline call that was already parked and removed from the lifecycle");
  const abortDuringWaitController = new AbortController();
  const abortDuringWaitLifecycle = new ProductionGptBrowserLifecycle(
    crossConversationAuthority as never, runtimeLogger, HASH_A,
    crossExecution("job:cross-abort-during-wait", abortDuringWaitController.signal),
  );
  const abortDuringWaitActive = await abortDuringWaitLifecycle.browserFor(
    "session:cross-abort-during-wait", "corpus_research", "abort-during-wait",
  );
  const abortDuringWait = setTimeout(() => abortDuringWaitController.abort(), 0);
  await assert.rejects(
    () => abortDuringWaitLifecycle.navigateCrossConversationPoll(
      abortDuringWaitActive, "corpus_research", "abort-during-wait", "wait_for_stable_gpt_text",
      "https://chatgpt.com/c/cross-abort-during-wait", Date.now() + 25,
    ),
    (error: unknown) => typedExecutionFailure(error)?.code === "GPT_RESPONSE_WAIT_ABORTED",
  );
  clearTimeout(abortDuringWait);
  assert.equal(crossConversationAcquisitions, 4,
    "abort while parked outside the FIFO must not reacquire a Browser lease");
  assert.equal(crossConversationParks.length, 2);
  await abortDuringWaitLifecycle.settle(new Error("abort already settled outside the FIFO"));
  assert.equal(crossConversationParks.length, 2,
    "settle must not repeat park after aborting a deadline-bounded cadence wait");
  const abortedCrossController = new AbortController();
  abortedCrossController.abort();
  const abortedCrossLifecycle = new ProductionGptBrowserLifecycle(
    crossConversationAuthority as never, runtimeLogger, HASH_A,
    crossExecution("job:cross-aborted", abortedCrossController.signal),
  );
  const abortedCrossActive = await abortedCrossLifecycle.browserFor(
    "session:cross-aborted", "corpus_research", "aborted-wait",
  );
  await assert.rejects(
    () => abortedCrossLifecycle.navigateCrossConversationPoll(
      abortedCrossActive, "corpus_research", "aborted-wait", "wait_for_stable_gpt_text",
      "https://chatgpt.com/c/cross-aborted", Date.now() + 25,
    ),
    (error: unknown) => typedExecutionFailure(error)?.code === "GPT_RESPONSE_WAIT_ABORTED",
  );
  assert.equal(crossConversationParks.length, 2,
    "an aborted caller must fail before reserving or parking for cross-conversation polling");
  await firstCrossLifecycle.settle(null);
  await secondCrossLifecycle.settle(null);
  await abortedCrossLifecycle.settle(null);
  Object.defineProperty(performance, "now", {
    configurable: true,
    value: nativePerformanceNow,
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
  failureReadbackLifecycle.authorizeConfirmedProviderSourceReadback(failureReadbackAuthorization);
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
  await failureReadbackLifecycle.settle(null);

  let allowedReadCount = 0;
  let allowedMediaReadCount = 0;
  let sourceReadbackActionCount = 0;
  const exactActiveBrowser = {
    target: { targetRef: failureReadbackAuthorization.sourceTargetRef },
    document: { documentRef: failureReadbackAuthorization.sourceDocumentRef },
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
  activeFailureReadbackLifecycle.authorizeConfirmedProviderSourceReadback(failureReadbackAuthorization);
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
