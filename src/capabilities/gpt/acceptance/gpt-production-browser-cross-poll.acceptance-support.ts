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

const temporary = await mkdtemp(path.join(tmpdir(), "agent-cross-poll-acceptance-"));
try {
  const runtimeLogger = createRuntimeLogger({
    producer: "agent-cross-poll-acceptance", owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
    fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
  });
  const waitTask = task({
    jobId: "job:agent-cross-poll-acceptance", productId: "payment_screenshot_observation", actionId: "observe",
  });
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
    executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
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
} finally {
  await rm(temporary, { recursive: true, force: true });
}
