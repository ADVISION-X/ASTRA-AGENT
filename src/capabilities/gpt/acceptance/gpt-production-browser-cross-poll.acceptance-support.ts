import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { HASH_A, HASH_B } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-provider-conversation-acceptance-"));
try {
  const selections: string[] = [];
  const lifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async () => ({
        target: { targetRef: "target:provider-conversation" },
        document: { documentRef: "document:provider-conversation" },
        pendingMutationCount: () => 0,
        requiresMutationRecovery: () => false,
        executeDomIntent: async (intent: Readonly<{ canonicalConversationUrl?: string }>) => {
          selections.push(intent.canonicalConversationUrl!);
        },
        park: async () => undefined,
        close: async () => undefined,
      }),
    } as never,
    createRuntimeLogger({
      producer: "agent-provider-conversation-acceptance", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
    }),
    HASH_A,
    {
      jobId: "job:provider-conversation", attemptId: "attempt:provider-conversation",
      pluginId: "payment-screenshot-observation", pluginVersion: 1,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal,
    },
  );
  const active = await lifecycle.browserFor(
    "session:provider-conversation", "corpus_research", "text-wait",
  );
  assert.equal(await lifecycle.selectExactProviderConversation(
    active, "checkpoint_gpt_text_response",
    "https://chatgpt.com/c/exact", Date.now() + 1_000,
  ), "selected");
  assert.deepEqual(selections, ["https://chatgpt.com/c/exact"]);
  assert.equal(await lifecycle.selectExactProviderConversation(
    active, "checkpoint_gpt_text_response",
    "https://chatgpt.com/c/exact", Date.now() - 1,
  ), "deadline");
  assert.equal(selections.length, 1);
  await lifecycle.settle(null);

  const nativeDateNow = Date.now;
  let deadlineNow = 0;
  let deadlineAcquisitions = 0;
  let deadlineSelections = 0;
  Date.now = () => deadlineNow;
  try {
    const deadlineLifecycle = new ProductionGptBrowserLifecycle(
      {
        acquireJobBoundTargetLease: async () => {
          deadlineAcquisitions += 1;
          if (deadlineAcquisitions === 2) deadlineNow = 100;
          return {
            target: { targetRef: "target:deadline-race" },
            document: { documentRef: `document:deadline-race:${deadlineAcquisitions}` },
            pendingMutationCount: () => 0,
            requiresMutationRecovery: () => false,
            executeDomIntent: async () => { deadlineSelections += 1; },
            park: async () => undefined,
            close: async () => undefined,
          };
        },
      } as never,
      createRuntimeLogger({
        producer: "agent-provider-deadline-acceptance", owner: "production-runtime",
        component: "gpt-child", terminalEnabled: false,
        fileSink: { directoryPath: path.join(temporary, "deadline-runtime-logs") },
      }),
      HASH_A,
      {
        jobId: "job:provider-deadline", attemptId: "attempt:provider-deadline",
        pluginId: "payment-screenshot-observation", pluginVersion: 1,
        deviceId: "device:1", leaseVersion: 1,
        executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
        expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
        abortSignal: new AbortController().signal,
      },
    );
    const deadlineActive = await deadlineLifecycle.browserFor(
      "session:provider-deadline", "corpus_research", "deadline-wait",
    );
    assert.equal(await deadlineLifecycle.yieldForProviderProbe(
      deadlineActive, "corpus_research", "deadline-wait", "checkpoint_gpt_text_response",
      "https://chatgpt.com/c/deadline", 100,
    ), "deadline");
    assert.equal(deadlineSelections, 0,
      "a Product deadline reached during Browser acquisition must stop before touching the page");
    await deadlineLifecycle.settle(null);
  } finally {
    Date.now = nativeDateNow;
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
