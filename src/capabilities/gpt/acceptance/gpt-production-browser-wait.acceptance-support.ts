import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { executionFailure } from "../../../lib/execution-failure.js";
import { serializeTerminalFailureTransport } from
  "../../../lib/local-runtime/production/terminal-failure.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
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
  let selections = 0;
  let parks = 0;
  let closes = 0;
  const order: string[] = [];
  const acquisitionPurposes: string[] = [];
  const acquisitionModes: string[] = [];
  const parkInputs: Array<Readonly<{
    reason: string; mode: string; startProviderProbeCooldown: boolean;
  }>> = [];
  const browsers = Array.from({ length: 5 }, (_unused, index) => ({
    target: { targetRef: `target:provider-wait:${index + 1}` },
    document: { documentRef: `document:${index + 1}` },
    pendingMutationCount: () => 0,
    requiresMutationRecovery: () => false,
    readAtomicStepOutcome: () => {
      order.push(`wal:${index + 1}`);
      return {
        state: "confirmed", mutationOutcome: "confirmed",
        providerEffectIdentityHash: `sha256:${"8".repeat(64)}`,
        terminalPayload: {
          canonicalConversationUrl: "https://chatgpt.com/c/provider-wait",
          userTurnId: "conversation-turn-1",
        },
      };
    },
    executeDomIntent: async () => { selections += 1; order.push(`select:${index + 1}`); },
    park: async (input: Readonly<{
      reason: string; mode: string; startProviderProbeCooldown: boolean;
    }>) => {
      parks += 1;
      order.push(`park:${index + 1}`);
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
      acquireJobBoundTargetLease: async (_binding: unknown, _ownerId: unknown, wait: Readonly<{
        purpose: string; targetMode: string;
      }>) => {
        order.push(`acquire:${acquisitions + 1}`);
        acquisitionPurposes.push(wait.purpose);
        acquisitionModes.push(wait.targetMode);
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
      resultRevision: 0,
      deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
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
  await assert.rejects(
    lifecycle.yieldForProviderProbe(
      active, "corpus_research", "text-wait", "checkpoint_gpt_text_response",
      "https://chatgpt.com/c/provider-wait", Date.now() + 1_000,
    ),
    /GPT_CONFIRMED_SUBMIT_READBACK_INVALID/u,
    "Provider polling must be impossible before the submit effect is confirmed in Browser WAL",
  );
  assert.deepEqual([acquisitions, parks], [1, 0],
    "an unconfirmed probe must fail before parking or acquiring a Browser Target");
  const providerEffectIdentityHash = `sha256:${"8".repeat(64)}` as const;
  lifecycle.recordConfirmedProviderEffect(active, {
    exactCallIdentityHash: `sha256:${"6".repeat(64)}`,
    providerEffectIdentityHash,
    childCapabilityId: "submit_exact_gpt_turn_once", effectScope: "provider_effect",
    browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
    terminalAt: "2026-09-12T00:00:00.000Z", evidenceRef: "browser-mutation:submit",
    evidenceHash: `sha256:${"5".repeat(64)}`,
  }, {
    resultRevision: 0, productStepId: "corpus_research", callId: "turn-submit",
    childCapabilityId: "submit_exact_gpt_turn_once", inputHash: HASH_A,
    actionOrdinal: 1, replayPolicy: "provider-effect-once",
  }, "https://chatgpt.com/c/provider-wait", "conversation-turn-1");
  await lifecycle.yieldForProviderProbe(
    active, "corpus_research", "text-wait", "checkpoint_gpt_text_response",
    "https://chatgpt.com/c/provider-wait", Date.now() + 1_000,
  );
  assert.equal(active.facade.document.documentRef, "document:2",
    "the stable Browser facade must point at the newly reacquired Document");
  await lifecycle.yieldForProviderProbe(
    active, "corpus_research", "text-wait", "checkpoint_gpt_text_response",
    "https://chatgpt.com/c/provider-wait", Date.now() + 1_000,
  );
  assert.equal(active.facade.document.documentRef, "document:3");
  active.providerWaitLog = { ...active.providerWaitLog!, emittedAt: performance.now() - 30_001 };
  await lifecycle.yieldForProviderProbe(
    active, "corpus_research", "text-wait", "checkpoint_gpt_text_response",
    "https://chatgpt.com/c/provider-wait", Date.now() + 1_000,
  );
  assert.equal(active.facade.document.documentRef, "document:4");
  await lifecycle.yieldForProviderProbe(
    active, "corpus_research", "image-wait", "checkpoint_gpt_generated_image",
    "https://chatgpt.com/c/provider-wait", Date.now() + 1_000,
  );
  assert.equal(active.facade.document.documentRef, "document:5");
  lifecycle.recordSettledResult(active, HASH_B);
  assert.deepEqual(
    serializeTerminalFailureTransport(lifecycle.decorateSettledResultFailure(
      new Error("PRODUCT_RESULT_JSON_INVALID"),
    )),
    {
      code: "RESULT_SETTLED_UNUSABLE", mutation_outcome: "confirmed",
      effect_scope: "provider_effect", child_capability_id: "submit_exact_gpt_turn_once",
      browser_outcome: "CONFIRMED", evidence_ref: "browser-mutation:submit",
      evidence_hash: `sha256:${"5".repeat(64)}`, cause: { name: "Error", code: null },
      provider_effect_identity_hash: providerEffectIdentityHash,
      settled_result_payload_hash: HASH_B,
    },
  );
  const typedFailure = executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE");
  assert.equal(lifecycle.decorateSettledResultFailure(typedFailure), typedFailure,
    "typed infrastructure failures must preserve same-effect readback instead of minting a result revision");
  await lifecycle.settle(null);
  assert.deepEqual([acquisitions, parks, closes], [5, 5, 0],
    "normal completion must park the one reusable production Tab instead of closing it");
  assert.deepEqual(parkInputs, [
    ...Array.from({ length: 4 }, () => ({
      reason: "gpt-provider-probe-yield", mode: "normal-provider-wait",
      startProviderProbeCooldown: true,
    })),
    { reason: "gpt-product-call-settled", mode: "normal-provider-wait",
      startProviderProbeCooldown: false },
  ]);
  assert.deepEqual(acquisitionPurposes, [
    "general", "provider-probe", "provider-probe", "provider-probe", "provider-probe",
  ]);
  assert.deepEqual(acquisitionModes, ["fresh",
    ...Array.from({ length: 4 }, () => "confirmed-readback")],
  "Provider probes must acquire the current system Target without resetting to the GPT root");
  assert.equal(selections, 4,
    "each qualified Provider probe must converge on the exact canonical conversation URL before observation");
  assert.deepEqual(order, [
    "acquire:1",
    "wal:1", "park:1", "acquire:2", "select:2",
    "wal:2", "park:2", "acquire:3", "select:3",
    "wal:3", "park:3", "acquire:4", "select:4",
    "wal:4", "park:4", "acquire:5", "select:5",
    "park:5",
  ], "every Provider probe must prove the same WAL effect before releasing FIFO and reacquiring");
  const waitEvents = (await readFile(runtimeLogger.currentSegmentPath()!, "utf8")).trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
    .filter((event) => event.code === "GPT_PROVIDER_WAIT_ACTIVE");
  assert.equal(waitEvents.length, 3,
    "the same Provider wait logs once per bounded interval, while a new exact call logs immediately");
  assert.deepEqual(waitEvents.map((event) => {
    const identity = event.typedIdentity as Readonly<Record<string, unknown>>;
    return [event.operation, identity.kind, identity.stepId, identity.capabilityCallId];
  }), [
    ["gpt.child", "gpt-call", "corpus_research", "text-wait:checkpoint_gpt_text_response"],
    ["gpt.child", "gpt-call", "corpus_research", "text-wait:checkpoint_gpt_text_response"],
    ["gpt.child", "gpt-call", "corpus_research", "image-wait:checkpoint_gpt_generated_image"],
  ]);

} finally {
  await rm(temporary, { recursive: true, force: true });
}
