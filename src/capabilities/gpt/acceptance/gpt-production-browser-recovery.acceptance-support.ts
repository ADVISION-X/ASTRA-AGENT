import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import path from "node:path";
import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { HASH_A, HASH_B } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";
import { typedExecutionFailure } from "../../../lib/execution-failure.js";

export const verifyConfirmedReadbackLease = async (temporary: string): Promise<void> => {
  let targetMode: string | undefined;
  let acquisitions = 0;
  let selections = 0;
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
            selections += 1;
            selectedUrls.push(intent.canonicalConversationUrl ?? "");
          },
          pendingMutationCount: () => 0,
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
  }, "https://chatgpt.com/c/confirmed-recovery", "conversation-turn-1");
  assert.deepEqual([targetMode, acquisitions, selections],
    ["confirmed-readback", 1, 1],
    "confirmed-effect recovery may acquire once and select the exact canonical URL once");
  const firstUrl = selectedUrls[0]!;
  assert.equal(firstUrl.endsWith("/c/confirmed-recovery"), true);
  const secondUrl = firstUrl.replace("/c/confirmed-recovery", "/c/second-recovery");
  await assert.rejects(lifecycle.browserForConfirmedReadback(
    "session:confirmed-recovery", "second-step", "turn-submit",
  ), (error: unknown) => typedExecutionFailure(error)?.code
    === "GPT_BROWSER_SESSION_TRANSITION_UNSETTLED");
  lifecycle.recordSettledResult(active, HASH_A);
  const second = await lifecycle.browserForConfirmedReadback(
    "session:confirmed-recovery", "second-step", "turn-submit",
  );
  assert.equal(second, active, "same-session readback keeps the one Browser lease");
  await lifecycle.recordConfirmedProviderEffect(second, {
    exactCallIdentityHash: `sha256:${"7".repeat(64)}`,
    providerEffectIdentityHash: `sha256:${"9".repeat(64)}`,
    childCapabilityId: "submit_exact_gpt_turn_once", effectScope: "provider_effect",
    browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
    terminalAt: "2026-09-12T00:00:01.000Z", evidenceRef: "browser-mutation:second-submit",
    evidenceHash: `sha256:${"4".repeat(64)}`,
  }, {
    resultRevision: 0, productStepId: "second-step", callId: "turn-submit",
    childCapabilityId: "submit_exact_gpt_turn_once", inputHash: HASH_B,
    actionOrdinal: 2, replayPolicy: "provider-effect-once",
  }, secondUrl, "conversation-turn-2");
  assert.equal(selections, 2,
    "a second confirmed effect in the same Product session must select its own WAL URL");
  assert.deepEqual(selectedUrls, [firstUrl, secondUrl]);
  lifecycle.recordSettledResult(second, HASH_B);
  await lifecycle.settle(null);
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
