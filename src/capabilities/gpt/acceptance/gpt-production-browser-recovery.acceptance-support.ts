import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import path from "node:path";
import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { HASH_A, HASH_B } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";
import { executionFailure, typedExecutionFailure } from "../../../lib/execution-failure.js";

const verifySecondConfirmedReadback = async (lifecycle: ProductionGptBrowserLifecycle,
  active: Awaited<ReturnType<ProductionGptBrowserLifecycle["browserForConfirmedReadback"]>>, urls: string[]): Promise<void> => {
  const original = urls[0]!;
  await assert.rejects(lifecycle.browserForConfirmedReadback("session:confirmed-recovery", "second-step", "turn-submit", HASH_B),
    (error: unknown) => typedExecutionFailure(error)?.code === "GPT_BROWSER_SESSION_TRANSITION_UNSETTLED");
  lifecycle.recordSettledResult(active, HASH_A);
  const second = await lifecycle.browserForConfirmedReadback("session:confirmed-recovery", "second-step", "turn-submit", HASH_B);
  assert.equal(second, active, "a settled same-session effect retains the live lease");
  await lifecycle.recordConfirmedProviderEffect(second, {
    exactCallIdentityHash: HASH_B, providerEffectIdentityHash: HASH_B, childCapabilityId: "submit_exact_gpt_turn_once",
    effectScope: "provider_effect", browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
    terminalAt: "2026-09-12T00:00:01.000Z", evidenceRef: "browser-mutation:second-submit", evidenceHash: HASH_A,
  }, { resultRevision: 0, productStepId: "second-step", callId: "turn-submit", childCapabilityId: "submit_exact_gpt_turn_once",
    inputHash: HASH_B, actionOrdinal: 2, replayPolicy: "provider-effect-once" }, original, "00000000-0000-4000-8000-000000000002");
  assert.equal(urls.length, 1, "recording a locator alone performs no page command");
  await second.facade.runAtomicStep(second.confirmedProviderEffect!.submitIdentity, () => lifecycle.selectSettledConversation(second));
  assert.deepEqual(urls, [original, original], "the next atomic page access selects the same original U");
  lifecycle.recordSettledResult(second, HASH_B);
  await lifecycle.recordConfirmedProviderEffect(second, { ...second.confirmedProviderEffect!, providerEffectIdentityHash: HASH_A },
    { ...second.confirmedProviderEffect!.submitIdentity, callId: "third-submit" }, original, "00000000-0000-4000-8000-000000000002");
  assert.equal(second.settledResultPayloadHash, null);
  assert.throws(() => lifecycle.recordSettledResult(second, HASH_A,
    { sessionKey: "session:confirmed-recovery", canonicalConversationUrl: "https://chatgpt.com/c/wrong-session" }),
  /GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH/u);
  assert.equal(second.settledResultPayloadHash, null, "a conflicting U cannot register a settled result hash");
  assert.throws(() => lifecycle.assertProviderTurnSettled(), /GPT_BROWSER_SESSION_TRANSITION_UNSETTLED/u);
  lifecycle.recordSettledResult(second, HASH_A);
  assert.doesNotThrow(() => lifecycle.assertProviderTurnSettled());
  await lifecycle.settle(null);
};
export const verifyConfirmedReadbackLease = async (temporary: string): Promise<void> => {
  let targetMode: string | undefined;
  let acquisitions = 0;
  const selectedUrls: string[] = [];
  const lifecycle = new ProductionGptBrowserLifecycle(
    {
      acquireJobBoundTargetLease: async (_binding: unknown, _ownerId: unknown, wait: Readonly<{
        targetMode: string;
      }>) => {
        targetMode = wait.targetMode;
        acquisitions += 1;
        return {
          target: { targetRef: "target:confirmed-recovery" },
          document: { documentRef: "document:confirmed-recovery" },
          executeDomIntent: async (intent: Readonly<{ canonicalConversationUrl?: string }>) => {
            selectedUrls.push(intent.canonicalConversationUrl ?? "");
          },
          pendingMutationCount: () => 0,
          runAtomicStep: async (_identity: unknown, action: () => Promise<unknown>) => action(),
          park: async () => undefined,
        };
      },
    } as never,
    createRuntimeLogger({
      producer: "agent-confirmed-recovery-acceptance", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
    }),
    HASH_A,
    {
      jobId: "job:confirmed-recovery", attemptId: "attempt:confirmed-recovery", resultRevision: 0,
      deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
      capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
      commandTtlMs: 1_000, abortSignal: new AbortController().signal,
    },
  );
  const active = await lifecycle.browserForConfirmedReadback(
    "session:confirmed-recovery", "observe", "turn-submit",
  );
  await lifecycle.recordConfirmedProviderEffect(active, {
    exactCallIdentityHash: `sha256:${"6".repeat(64)}`,
    providerEffectIdentityHash: `sha256:${"8".repeat(64)}`,
    childCapabilityId: "submit_exact_gpt_turn_once", effectScope: "provider_effect",
    browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
    terminalAt: "2026-09-12T00:00:00.000Z", evidenceRef: "browser-mutation:submit",
    evidenceHash: `sha256:${"5".repeat(64)}`,
  }, {
    resultRevision: 0, productStepId: "observe", callId: "turn-submit",
    childCapabilityId: "submit_exact_gpt_turn_once", inputHash: HASH_A,
    actionOrdinal: 1, replayPolicy: "provider-effect-once",
  }, "https://chatgpt.com/c/confirmed-recovery", "00000000-0000-4000-8000-000000000001");
  assert.equal(selectedUrls.length, 0, "locator registration cannot navigate outside the Child atomic closure");
  await active.facade.runAtomicStep(active.confirmedProviderEffect!.submitIdentity, () => lifecycle.selectSettledConversation(active));
  assert.deepEqual([targetMode, acquisitions, selectedUrls.length],
    ["confirmed-readback", 1, 1],
    "confirmed-effect recovery may acquire once and select the exact canonical URL once");
  await verifySecondConfirmedReadback(lifecycle, active, selectedUrls);
  await verifyLeaseFailureLifecycle(temporary);
};

export const verifyNoPriorProviderEffect = async (temporary: string): Promise<void> => {
  const freshTools = new ProductionGptChildTools(
    temporary, HASH_A, {} as never, {} as never, {
      readProviderEffectStepCallFact: () => null,
      countProviderTurnDispatches: () => 0,
    } as never,
    createRuntimeLogger({
      producer: "agent-step-identity-fresh-acceptance", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: path.join(temporary, "runtime-logs-fresh") },
    }), {} as never,
  ).createExecution({
    jobId: "job:step-identity-fresh", attemptId: "attempt:step-identity-fresh", resultRevision: 0,
    productId: "public_knowledge_article_pipeline",
    ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
    capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent",
    maxProviderTurns: 1,
  });
  assert.equal(await freshTools.tools.readConfirmedSubmit({ sessionKey: "session:step-identity-fresh",
    productStepId: "observe", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
    actionOrdinal: 1, input: {} as never }), null,
  "an empty provider effect history must still return null so the first submit can prepare normally");
};

export const verifyHistoricalReadbackOnlyCall = async (temporary: string): Promise<void> => {
  let browserReads = 0;
  const execution = new ProductionGptChildTools(
    temporary, HASH_A, {} as never, {} as never, {
      readProviderEffectStepCallFact: () => { browserReads += 1; return null; },
      countProviderTurnDispatches: () => 0,
    } as never,
    createRuntimeLogger({
      producer: "agent-historical-readback-acceptance", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: path.join(temporary, "runtime-logs-historical-readback") },
    }), {} as never,
  ).createExecution({
    jobId: "job:historical-readback", attemptId: "attempt:historical-readback",
    resultRevision: 0, productId: "public_knowledge_article_pipeline",
    ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    readbackOnlyCalls: [{ productStepId: "original-step", callId: "turn-submit",
      childCapabilityId: "submit_exact_gpt_turn_once" }],
    deviceId: "device:1", leaseVersion: 2, executionFenceHash: HASH_A,
    capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent",
    maxProviderTurns: 1,
  });
  await assert.rejects(execution.tools.execute({
    sessionKey: "session:historical-readback", productStepId: "original-step",
    callId: "fresh-chat", child: "prepare_clean_gpt_chat", actionOrdinal: 1,
    input: { timeoutMs: 1_000 },
  }), (error: unknown) => typedExecutionFailure(error)?.code === "GPT_CONFIRMED_SUBMIT_READBACK_ONLY");
  await assert.rejects(execution.tools.readConfirmedSubmit({
    sessionKey: "session:historical-readback", productStepId: "drifted-step",
    callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 1,
    input: {} as never,
  }), (error: unknown) => typedExecutionFailure(error)?.code === "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  assert.equal(browserReads, 0, "a drifted call must fail before Browser acquisition");
  await assert.rejects(execution.tools.readConfirmedSubmit({
    sessionKey: "session:historical-readback", productStepId: "original-step",
    callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 1,
    input: {} as never,
  }), (error: unknown) => typedExecutionFailure(error)?.code === "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  assert.equal(browserReads, 1, "an absent original effect must not become a fresh submission");
};
const leaseFailureFixture = async (temporary: string) => {
  const controller = new AbortController();
  const control = { acquireError: null as Error | null, parkFailure: 0,
    selectError: null as Error | null, onAcquire: () => {}, onSelect: () => {} };
  const counts = { acquire: 0, park: 0, select: 0, occupied: 0, providerInputs: 0 };
  const identities: Array<Readonly<{ lease: number; identity: unknown }>> = [];
  const authority = { acquireJobBoundTargetLease: async () => {
    control.onAcquire();
    if (control.acquireError) throw control.acquireError;
    const lease = ++counts.acquire; counts.occupied = lease;
    let identity: unknown = null;
    return {
      get document() { return { documentRef: `document:failure:${lease}` }; },
      pendingMutationCount: () => 0,
      runAtomicStep: async <T>(current: unknown, action: () => Promise<T>) => {
        identity = current; try { return await action(); } finally { identity = null; }
      },
      readAtomicStepOutcome: () => ({ state: "confirmed", mutationOutcome: "confirmed",
        providerEffectIdentityHash: HASH_A, conversationLocator: { canonicalConversationUrl: "https://chatgpt.com/c/lease-failure" }, terminalPayload: {
          canonicalConversationUrl: "https://chatgpt.com/c/lease-failure",
          userTurnId: "00000000-0000-4000-8000-000000000001", promptHash: HASH_B,
        } }),
      executeDomIntent: async (intent: { kind: string; canonicalConversationUrl?: string }) => {
        if (intent.kind !== "selectExactGptConversation") counts.providerInputs += 1;
        assert.deepEqual(intent, { kind: "selectExactGptConversation", canonicalConversationUrl: "https://chatgpt.com/c/lease-failure" });
        identities.push({ lease, identity }); counts.select += 1; control.onSelect();
        if (control.selectError) throw control.selectError;
      },
      attachFile: async () => { counts.providerInputs += 1; throw new Error("UNEXPECTED_PROVIDER_FILE_INPUT"); },
      park: async () => {
        counts.park += 1;
        try { if (control.parkFailure === lease) throw executionFailure("failed", "BROWSER_TARGET_LIFECYCLE_UNSETTLED"); }
        finally { counts.occupied = 0; }
      },
    };
  } };
  const lifecycle = new ProductionGptBrowserLifecycle(authority as never,
    createRuntimeLogger({ producer: "lease-failure", owner: "production-runtime", component: "gpt-child",
      terminalEnabled: false, fileSink: { directoryPath: path.join(temporary, "lease-failure-logs") } }), HASH_A, {
      jobId: "job:lease-failure", attemptId: "attempt:lease-failure", resultRevision: 0,
      deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
      capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 300_000,
      commandTtlMs: 1_000, abortSignal: controller.signal,
    });
  const active = await lifecycle.browserFor("session:lease-failure", "observe", "turn-submit");
  await lifecycle.recordConfirmedProviderEffect(active, {
    exactCallIdentityHash: HASH_B, providerEffectIdentityHash: HASH_A,
    childCapabilityId: "submit_exact_gpt_turn_once", effectScope: "provider_effect",
    browserOutcome: "CONFIRMED", mutationOutcome: "confirmed", terminalAt: "2026-10-11T00:00:00.000Z",
    evidenceRef: "browser-mutation:lease-failure", evidenceHash: HASH_B,
  }, { resultRevision: 0, productStepId: "observe", callId: "turn-submit",
    childCapabilityId: "submit_exact_gpt_turn_once", inputHash: HASH_B,
    actionOrdinal: 1, replayPolicy: "provider-effect-once" },
  "https://chatgpt.com/c/lease-failure", "00000000-0000-4000-8000-000000000001");
  return { lifecycle, active, controller, control, counts, identities, authority };
};

const verifySelectionFailureLease = async (temporary: string): Promise<void> => {
  for (const child of ["checkpoint_gpt_text_response", "checkpoint_gpt_generated_image"] as const) {
    for (const code of ["BROWSER_COMMAND_RECEIPT_MISSING", "BROWSER_KNOWN_GPT_RATE_LIMIT", "BROWSER_WAIT_ABORTED"] as const) {
      const f = await leaseFailureFixture(temporary), confirmed = f.active.confirmedProviderEffect;
      const failure = executionFailure("failed", code), deadline = Date.now() + 200_000;
      f.control.selectError = failure;
      const now = Date.now;
      f.control.onSelect = () => { Date.now = () => deadline + 1; if (code === "BROWSER_WAIT_ABORTED") f.controller.abort(); };
      const identity = { resultRevision: 0, productStepId: "observe", callId: "checkpoint", childCapabilityId: child,
        inputHash: HASH_B, actionOrdinal: 2, replayPolicy: "observation-only" as const };
      try {
        await assert.rejects(f.active.facade.runAtomicStep(identity, () => f.lifecycle.waitForProviderObservation(
          f.active, "observe", "checkpoint", child, deadline,
          child === "checkpoint_gpt_text_response" ? "stop-present" : "generated-image-source-pending")),
        (error: unknown) => error === failure);
      } finally { Date.now = now; }
      assert.deepEqual(f.identities, [{ lease: 2, identity }]);
      assert.equal(f.active.confirmedProviderEffect, confirmed);
      assert.deepEqual(f.active.browser.readAtomicStepOutcome(confirmed!.submitIdentity)?.terminalPayload, {
        canonicalConversationUrl: "https://chatgpt.com/c/lease-failure",
        userTurnId: "00000000-0000-4000-8000-000000000001", promptHash: HASH_B,
      });
      assert.equal(f.counts.providerInputs, 0);
      assert.equal(f.counts.occupied, 2);
      f.control.parkFailure = code === "BROWSER_COMMAND_RECEIPT_MISSING" ? 2 : 0;
      if (f.control.parkFailure) await assert.rejects(f.lifecycle.settle(failure), /GPT_BROWSER_LIFECYCLE_FAILED/u);
      else await f.lifecycle.settle(failure);
      await f.lifecycle.settle(failure);
      assert.deepEqual([f.counts.acquire, f.counts.park, f.counts.select, f.counts.occupied], [2, 2, 1, 0]);
    }
  }
};

const verifyOldParkFailureLease = async (temporary: string): Promise<void> => {
  const old = await leaseFailureFixture(temporary); old.control.parkFailure = 1;
  await assert.rejects(old.lifecycle.waitForProviderObservation(old.active, "observe", "checkpoint",
    "checkpoint_gpt_text_response", Date.now() + 200_000, "stop-present"), /BROWSER_TARGET_LIFECYCLE_UNSETTLED/u);
  const sibling = await old.authority.acquireJobBoundTargetLease();
  await old.lifecycle.settle(null); await old.lifecycle.settle(null);
  assert.deepEqual([old.counts.park, old.counts.occupied], [1, 2], "old settlement cannot park the later owner's lease");
  await assert.rejects(old.lifecycle.waitForProviderObservation(old.active, "observe", "checkpoint",
    "checkpoint_gpt_text_response", Date.now() + 200_000, "stop-present"), /GPT_BROWSER_SESSION_TRANSITION_UNSETTLED/u);
  assert.equal(old.counts.providerInputs, 0);
  assert.equal(old.counts.park, 1); await sibling.park();
};

const verifyAcquireFailureLease = async (temporary: string): Promise<void> => {
  for (const mode of ["acquire-rejected", "abort", "execution-deadline", "observation-deadline"] as const) {
    const f = await leaseFailureFixture(temporary), deadline = Date.now() + 200_000, now = Date.now;
    const failure = executionFailure("failed", mode === "acquire-rejected" ? "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"
      : mode === "abort" ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED");
    f.control.acquireError = failure;
    f.control.onAcquire = () => {
      if (mode === "abort") { f.controller.abort(); Date.now = () => deadline + 1; }
      if (mode === "observation-deadline") Date.now = () => deadline + 1;
    };
    try {
      const wait = f.lifecycle.waitForProviderObservation(f.active, "observe", "checkpoint",
        "checkpoint_gpt_text_response", deadline, "stop-present");
      if (mode === "observation-deadline") assert.equal(await wait, "deadline");
      else await assert.rejects(wait, (error: unknown) => error === failure);
    } finally { Date.now = now; }
    await f.lifecycle.settle(failure);
    assert.deepEqual([f.counts.acquire, f.counts.park, f.counts.select], [1, 1, 0]);
    assert.equal(f.counts.providerInputs, 0);
  }
};

const verifyRecoverySelectionFailureLease = async (temporary: string): Promise<void> => {
  const recovery = await leaseFailureFixture(temporary);
  await recovery.lifecycle.settle(null);
  const active = await recovery.lifecycle.browserForConfirmedReadback("new-session", "observe", "turn-submit");
  recovery.control.selectError = executionFailure("failed", "BROWSER_COMMAND_RECEIPT_MISSING");
  const fact = recovery.active.confirmedProviderEffect!;
  await recovery.lifecycle.recordConfirmedProviderEffect(active, fact, fact.submitIdentity, fact.canonicalConversationUrl, fact.userTurnId);
  await assert.rejects(active.facade.runAtomicStep(fact.submitIdentity, () => recovery.lifecycle.selectSettledConversation(active)),
    /BROWSER_COMMAND_RECEIPT_MISSING/u);
  await recovery.lifecycle.settle(recovery.control.selectError); await recovery.lifecycle.settle(null);
  assert.equal(recovery.counts.providerInputs, 0);
  assert.deepEqual([recovery.counts.acquire, recovery.counts.park, recovery.counts.occupied], [2, 2, 0]);
};

const verifyLeaseFailureLifecycle = async (temporary: string): Promise<void> => {
  await verifySelectionFailureLease(temporary);
  await verifyOldParkFailureLease(temporary);
  await verifyAcquireFailureLease(temporary);
  await verifyRecoverySelectionFailureLease(temporary);
};
