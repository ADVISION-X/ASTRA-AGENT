import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import type { BrowserAtomicStepIdentity } from "../../../lib/browser/browser-authority-api.js";
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
  let pendingMutations = 0;
  let providerInputs = 0;
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
      get document() { return { documentRef: `document:provider-wait:${leaseNumber}` }; },
      pendingMutationCount: () => pendingMutations,
      runAtomicStep: async <T>(identity: BrowserAtomicStepIdentity, action: () => Promise<T>) => {
        assert.equal(physicalAtomicIdentity, null);
        physicalAtomicIdentity = identity;
        try { return await action(); } finally { physicalAtomicIdentity = null; }
      },
      readAtomicStepOutcome: () => ({
        state: "confirmed", mutationOutcome: "confirmed", providerEffectIdentityHash,
        conversationLocator: { canonicalConversationUrl: "https://chatgpt.com/c/provider-wait" },
        terminalPayload: {
          canonicalConversationUrl: "https://chatgpt.com/c/provider-wait",
          userTurnId: "00000000-0000-4000-8000-000000000001",
        },
      }),
      executeDomIntent: async (intent: { kind: string; canonicalConversationUrl?: string }) => {
        if (intent.kind !== "selectExactGptConversation") providerInputs += 1;
        assert.deepEqual(intent, { kind: "selectExactGptConversation", canonicalConversationUrl: "https://chatgpt.com/c/provider-wait" });
        captureCommandIdentity(); selections += 1;
      },
      attachFile: async () => { providerInputs += 1; throw new Error("UNEXPECTED_PROVIDER_FILE_INPUT"); },
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
  assert.deepEqual(atomicCommandIdentities.slice(0, 7), Array(7).fill(checkpointIdentity),
    "each text observation, park and selection retains the original Child identity");
  assert.deepEqual(atomicCommandLeases.slice(0, 7), [1, 1, 2, 2, 2, 3, 3]);
  assert.equal(active.facade.document.documentRef, "document:provider-wait:3", "facade keeps the new lease live view");
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
  assert.deepEqual(atomicCommandIdentities.slice(7, 14), Array(7).fill(imageIdentity),
    "each image read, park and selection retains the original Child identity");
  assert.deepEqual(atomicCommandLeases.slice(7, 14), [3, 3, 4, 4, 4, 5, 5]);
  assert.deepEqual([acquisitions, selections, parks], [5, 4, 4],
    "normal pending must park immediately and reacquire its exact Target through the one lane");
  assert.equal(observationWaits.at(-1)?.targetMode, "confirmed-readback");
  assert.ok((observationWaits.at(-1)?.eligibleAt ?? 0) >= observationStartedAt + 69_000,
    "the Child must submit eligibility at least 70 seconds ahead instead of owning a local timer");
  await assert.rejects(
    lifecycle.browserFor("session:next", "research-next", "text-next"),
    /GPT_BROWSER_SESSION_TRANSITION_UNSETTLED/u,
  );
  assert.deepEqual([acquisitions, selections, parks], [5, 4, 4],
    "a later Provider turn must not acquire Browser while the current result is unsettled");
  lifecycle.recordSettledResult(active, HASH_B);
  const next = await lifecycle.browserFor("session:next", "research-next", "text-next");
  assert.notEqual(next, active);
  assert.equal(await lifecycle.browserFor(
    "session:next", "research-next", "text-next",
  ), next, "the same logical Provider turn must reuse its one active Browser lease");
  assert.deepEqual([acquisitions, selections, parks], [6, 4, 5],
    "a settled turn must park exactly once before the next turn acquires fresh Browser authority");
  assert.deepEqual(lifecycleEvents,
    ["acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park", "acquire"],
    "the next Provider turn must acquire only after the settled prior turn releases Browser");
  await lifecycle.settle(new Error("NEXT_PROVIDER_TURN_FAILED"));
  assert.deepEqual([acquisitions, selections, parks], [6, 4, 6],
    "failed product settlement must park the active lease without closing the system Tab");
  await lifecycle.browserFor("session:final", "research-final", "text-final");
  await lifecycle.settle(null);
  assert.deepEqual([acquisitions, selections, parks], [7, 4, 7],
    "successful product settlement must park the active lease without closing the system Tab");
  assert.deepEqual(lifecycleEvents,
    ["acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park", "acquire", "park"],
    "every Product terminal handoff must preserve the same reusable system Tab");
  await lifecycle.browserFor("session:unresolved", "research-unresolved", "text-unresolved");
  pendingMutations = 1;
  await lifecycle.settle(new Error("UNRESOLVED_BROWSER_EFFECT"));
  assert.deepEqual([acquisitions, parks], [8, 8],
    "historical DISPATCHED permits zero-input park and retains its facts independently of current acquisition");
  assert.equal(providerInputs, 0, "confirmed observations perform zero fill, file input or submit");
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
