import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import type { BrowserAtomicStepIdentity } from "../../../lib/browser/browser-authority-api.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { serializeTerminalFailure } from "../../../lib/local-runtime/production/terminal-failure.js";
import { executionFailure } from "../../../lib/execution-failure.js";
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
  let pendingMutations = 0;
  const lifecycleEvents: string[] = [];
  const atomicCommandIdentities: Array<BrowserAtomicStepIdentity | null> = [];
  const atomicCommandLeases: number[] = [];
  const observationWaits: Array<Readonly<{ targetMode: string; eligibleAt: number }>> = [];
  const providerEffectIdentityHash = `sha256:${"8".repeat(64)}` as const;
  const createBrowserLease = (leaseNumber: number) => {
    let physicalAtomicIdentity: BrowserAtomicStepIdentity | null = null;
    const captureCommandIdentity = (): void => {
      atomicCommandIdentities.push(physicalAtomicIdentity ? { ...physicalAtomicIdentity } : null);
      atomicCommandLeases.push(leaseNumber);
    };
    return {
      target: { targetRef: "target:provider-wait" },
      document: { documentRef: "document:provider-wait" },
      pendingMutationCount: () => pendingMutations,
      runAtomicStep: async <T>(identity: BrowserAtomicStepIdentity, action: () => Promise<T>) => {
        assert.equal(physicalAtomicIdentity, null);
        physicalAtomicIdentity = identity;
        try { return await action(); } finally { physicalAtomicIdentity = null; }
      },
      readAtomicStepOutcome: () => ({
        state: "confirmed", mutationOutcome: "confirmed", providerEffectIdentityHash,
        terminalPayload: {
          canonicalConversationUrl: "https://chatgpt.com/c/provider-wait",
          userTurnId: "00000000-0000-4000-8000-000000000001",
        },
      }),
      executeDomIntent: async () => { selections += 1; },
      observeCapability: async () => { captureCommandIdentity(); },
      readAuthenticatedMedia: async () => {
        captureCommandIdentity();
        return {
          authorityTargetHash: HASH_A, authorityDocumentHash: HASH_B,
          assistantTurnId: "assistant:1", precedingUserTurnId: "00000000-0000-4000-8000-000000000001",
          currentUrl: "https://chatgpt.com/c/provider-wait",
          semanticMediaId: "gpt-generated-image-main", bytesBase64: "YQ==",
          sha256: HASH_A, sizeBytes: 1, mediaType: "image/png",
        };
      },
      park: async () => {
        captureCommandIdentity();
        parks += 1; lifecycleEvents.push("park");
      },
    };
  };
  type TestBrowserLease = ReturnType<typeof createBrowserLease>;
  const lifecycle = new ProductionGptBrowserLifecycle(
    { acquireJobBoundTargetLease: async (_binding: unknown, _ownerId: string, _wait: {
      targetMode: string; eligibleAt: number;
    }) => {
      acquisitions += 1; lifecycleEvents.push("acquire"); return createBrowserLease(acquisitions);
    } } as never,
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
      "initial-observation",
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
  }, "https://chatgpt.com/c/provider-wait", "00000000-0000-4000-8000-000000000001");
  const observationStartedAt = Date.now();
  const originalAcquire = (lifecycle as never as { browserAuthority: {
    acquireJobBoundTargetLease: (...args: unknown[]) => Promise<TestBrowserLease>;
  } }).browserAuthority.acquireJobBoundTargetLease;
  (lifecycle as never as { browserAuthority: {
    acquireJobBoundTargetLease: (...args: unknown[]) => Promise<TestBrowserLease>;
  } }).browserAuthority.acquireJobBoundTargetLease = async (...args: unknown[]) => {
    const wait = args[2] as { targetMode: string; eligibleAt: number };
    observationWaits.push({
      targetMode: wait.targetMode, eligibleAt: wait.eligibleAt,
    });
    return originalAcquire(...args);
  };
  const checkpointIdentity = {
    resultRevision: 0, productStepId: "research", callId: "text-wait",
    childCapabilityId: "checkpoint_gpt_text_response", inputHash: HASH_A,
    actionOrdinal: 2, replayPolicy: "observation-only" as const,
  };
  const shortDeadlineAcquisitions = acquisitions;
  const shortDeadlineParks = parks;
  assert.equal(await lifecycle.waitForProviderObservation(
    active, "research", "text-wait", "checkpoint_gpt_text_response", Date.now() + 5_000,
    "initial-observation",
  ), "deadline");
  assert.deepEqual([acquisitions, parks], [shortDeadlineAcquisitions, shortDeadlineParks],
    "a deadline below the 70-second minimum must not park or reacquire Browser");
  await assert.rejects(active.facade.runAtomicStep({
    ...checkpointIdentity, productStepId: "",
  }, async () => undefined), /BROWSER_ATOMIC_STEP_IDENTITY_INVALID/u);
  await active.facade.runAtomicStep(checkpointIdentity, async () => {
    await active.facade.observeCapability({ capabilityId: "browser.dom.inspect.v1" });
    assert.equal(await lifecycle.waitForProviderObservation(
      active, "research", "text-wait", "checkpoint_gpt_text_response", Date.now() + 200_000,
      "initial-observation",
    ), "reobserve");
    await active.facade.observeCapability({ capabilityId: "browser.dom.inspect.v1" });
    assert.equal(await lifecycle.waitForProviderObservation(
      active, "research", "text-wait", "checkpoint_gpt_text_response", Date.now() + 200_000,
      "stop-present",
    ), "reobserve");
    await active.facade.observeCapability({ capabilityId: "browser.dom.inspect.v1" });
  });
  assert.deepEqual(atomicCommandIdentities.slice(0, 5), Array(5).fill(checkpointIdentity),
    "every text observation and park across two new physical leases must retain the full identity");
  assert.deepEqual(atomicCommandLeases.slice(0, 5), [1, 1, 2, 2, 3],
    "the text fixture must prove that facade commands use two distinct reacquired leases");
  const imageIdentity = {
    ...checkpointIdentity, callId: "image-wait",
    childCapabilityId: "checkpoint_gpt_generated_image", actionOrdinal: 3,
  };
  await assert.rejects(active.facade.runAtomicStep(imageIdentity, async () =>
    active.facade.runAtomicStep(checkpointIdentity, async () => undefined)),
  /BROWSER_ATOMIC_STEP_IDENTITY_INVALID/u);
  await active.facade.runAtomicStep(imageIdentity, async () => {
    await active.facade.readAuthenticatedMedia({
      canonicalConversationUrl: "https://chatgpt.com/c/provider-wait",
      userTurnId: "00000000-0000-4000-8000-000000000001", semanticMediaId: "gpt-generated-image-main",
    });
    assert.equal(await lifecycle.waitForProviderObservation(
      active, "research", "image-wait", "checkpoint_gpt_generated_image", Date.now() + 200_000,
      "generated-image-source-pending",
    ), "reobserve");
    await active.facade.readAuthenticatedMedia({
      canonicalConversationUrl: "https://chatgpt.com/c/provider-wait",
      userTurnId: "00000000-0000-4000-8000-000000000001", semanticMediaId: "gpt-generated-image-main",
    });
    assert.equal(await lifecycle.waitForProviderObservation(
      active, "research", "image-wait", "checkpoint_gpt_generated_image", Date.now() + 200_000,
      "generated-image-source-pending",
    ), "reobserve");
    await active.facade.readAuthenticatedMedia({
      canonicalConversationUrl: "https://chatgpt.com/c/provider-wait",
      userTurnId: "00000000-0000-4000-8000-000000000001", semanticMediaId: "gpt-generated-image-main",
    });
  });
  assert.deepEqual(atomicCommandIdentities.slice(5, 10), Array(5).fill(imageIdentity),
    "every image read and park across two new physical leases must retain the full identity");
  assert.deepEqual(atomicCommandLeases.slice(5, 10), [3, 3, 4, 4, 5],
    "the image fixture must prove that facade commands use two distinct reacquired leases");
  assert.deepEqual([acquisitions, selections, parks], [5, 0, 4],
    "normal pending must park immediately and reacquire its exact Target through the one lane");
  assert.equal(observationWaits.at(-1)?.targetMode, "bound-observation");
  assert.ok((observationWaits.at(-1)?.eligibleAt ?? 0) >= observationStartedAt + 69_000,
    "the Child must submit eligibility at least 70 seconds ahead instead of owning a local timer");
  await assert.rejects(
    lifecycle.browserFor("session:next", "research-next", "text-next"),
    /GPT_BROWSER_SESSION_TRANSITION_UNSETTLED/u,
  );
  assert.deepEqual([acquisitions, selections, parks], [5, 0, 4],
    "a later Provider turn must not acquire Browser while the current result is unsettled");
  lifecycle.recordSettledResult(active, HASH_B);
  const settledFailure = serializeTerminalFailure(
    lifecycle.decorateSettledResultFailure(new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID")),
  );
  assert.equal(settledFailure.code, "RESULT_SETTLED_UNUSABLE");
  assert.equal(settledFailure.cause?.code, "AGENT_RESULT_SCHEMA_VERSION_INVALID",
    "the Website-facing settled-result classification must retain the atomic parser cause");
  const typedSettledFailure = serializeTerminalFailure(lifecycle.decorateSettledResultFailure(
    executionFailure("failed", "LOCALIZATION_STATIC_SELECTOR_SELECTION_INVALID"),
  ));
  assert.equal(typedSettledFailure.code, "RESULT_SETTLED_UNUSABLE",
    "a typed Product rejection after a settled GPT answer must remain Website-revision eligible");
  assert.equal(typedSettledFailure.cause?.code, "LOCALIZATION_STATIC_SELECTOR_SELECTION_INVALID");
  const next = await lifecycle.browserFor("session:next", "research-next", "text-next");
  assert.notEqual(next, active);
  assert.equal(await lifecycle.browserFor(
    "session:next", "research-next", "text-next",
  ), next, "the same logical Provider turn must reuse its one active Browser lease");
  assert.deepEqual([acquisitions, selections, parks], [6, 0, 5],
    "a settled turn must park exactly once before the next turn acquires fresh Browser authority");
  assert.deepEqual(lifecycleEvents,
    ["acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park", "acquire"],
    "the next Provider turn must acquire only after the settled prior turn releases Browser");
  const nextFailure = new Error("NEXT_PROVIDER_TURN_FAILED");
  assert.equal(lifecycle.decorateSettledResultFailure(nextFailure), nextFailure,
    "the prior settled result must not classify failures from the newly active Provider turn");
  await lifecycle.settle(nextFailure);
  assert.deepEqual([acquisitions, selections, parks], [6, 0, 6],
    "failed product settlement must park the active lease without closing the system Tab");
  await lifecycle.browserFor("session:final", "research-final", "text-final");
  await lifecycle.settle(null);
  assert.deepEqual([acquisitions, selections, parks], [7, 0, 7],
    "successful product settlement must park the active lease without closing the system Tab");
  assert.deepEqual(lifecycleEvents,
    ["acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park"],
    "every Product terminal handoff must preserve the same reusable system Tab");
  await lifecycle.browserFor("session:unresolved", "research-unresolved", "text-unresolved");
  pendingMutations = 1;
  await lifecycle.settle(new Error("UNRESOLVED_BROWSER_EFFECT"));
  assert.deepEqual([acquisitions, parks], [8, 8],
    "unresolved DISPATCHED must permit zero-input park while WAL continues blocking every acquisition");
  const waitEvents = (await readFile(runtimeLogger.currentSegmentPath()!, "utf8")).trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
    .filter((event) => String(event.code).startsWith("GPT_PROVIDER_WAIT_"));
  assert.deepEqual(waitEvents.map((event) => [event.code,
    (event.typedIdentity as { capabilityCallId: string }).capabilityCallId]), [
    ["GPT_PROVIDER_WAIT_INITIAL_OBSERVATION", "text-wait:checkpoint_gpt_text_response"],
    ["GPT_PROVIDER_WAIT_STOP_PRESENT", "text-wait:checkpoint_gpt_text_response"],
    ["GPT_PROVIDER_WAIT_ACTIVE", "image-wait:checkpoint_gpt_generated_image"],
  ]);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
