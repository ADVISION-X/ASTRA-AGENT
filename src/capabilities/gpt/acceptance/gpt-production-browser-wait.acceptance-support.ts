import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { HASH_A, HASH_B } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-provider-wait-progress-"));
try {
  const runtimeLogger = createRuntimeLogger({
    producer: "agent-provider-wait-acceptance", owner: "production-runtime",
    component: "gpt-child", terminalEnabled: false,
    fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
  });
  let acquisitions = 0;
  let selections = 0;
  let parks = 0;
  const providerEffectIdentityHash = `sha256:${"8".repeat(64)}` as const;
  const browser = {
    target: { targetRef: "target:provider-wait" },
    document: { documentRef: "document:provider-wait" },
    pendingMutationCount: () => 0,
    readAtomicStepOutcome: () => ({
      state: "confirmed", mutationOutcome: "confirmed", providerEffectIdentityHash,
      terminalPayload: {
        canonicalConversationUrl: "https://chatgpt.com/c/provider-wait",
        userTurnId: "conversation-turn-1",
      },
    }),
    executeDomIntent: async () => { selections += 1; },
    park: async () => { parks += 1; },
    close: async () => undefined,
  };
  const lifecycle = new ProductionGptBrowserLifecycle(
    { acquireJobBoundTargetLease: async () => { acquisitions += 1; return browser; } } as never,
    runtimeLogger, HASH_A,
    {
      jobId: "job:provider-wait", attemptId: "attempt:provider-wait", resultRevision: 0,
      deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
      capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
      commandTtlMs: 1_000, abortSignal: new AbortController().signal,
    },
  );
  const active = await lifecycle.browserFor("session:provider-wait", "research", "text-wait");
  await assert.rejects(
    lifecycle.waitForProviderObservation(
      active, "research", "text-wait", "checkpoint_gpt_text_response", Date.now() + 5,
    ),
    /GPT_CONFIRMED_SUBMIT_READBACK_INVALID/u,
  );
  await lifecycle.recordConfirmedProviderEffect(active, {
    exactCallIdentityHash: `sha256:${"6".repeat(64)}`, providerEffectIdentityHash,
    childCapabilityId: "submit_exact_gpt_turn_once", effectScope: "provider_effect",
    browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
    terminalAt: "2026-09-12T00:00:00.000Z", evidenceRef: "browser-mutation:submit",
    evidenceHash: `sha256:${"5".repeat(64)}`,
  }, {
    resultRevision: 0, productStepId: "research", callId: "turn-submit",
    childCapabilityId: "submit_exact_gpt_turn_once", inputHash: HASH_A,
    actionOrdinal: 1, replayPolicy: "provider-effect-once",
  }, "https://chatgpt.com/c/provider-wait", "conversation-turn-1");
  assert.equal(await lifecycle.waitForProviderObservation(
    active, "research", "text-wait", "checkpoint_gpt_text_response", Date.now() + 5,
  ), "deadline");
  assert.deepEqual([acquisitions, selections, parks], [1, 0, 0],
    "normal pending must retain the same lease, Target and Document without navigation");
  await lifecycle.settle(null);
  assert.deepEqual([acquisitions, selections, parks], [1, 0, 1],
    "only product settlement may release the retained Browser lease");
  const waitEvents = (await readFile(runtimeLogger.currentSegmentPath()!, "utf8")).trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
    .filter((event) => event.code === "GPT_PROVIDER_WAIT_ACTIVE");
  assert.equal(waitEvents.length, 1);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
