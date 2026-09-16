import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { serializeTerminalFailureTransport } from
  "../../../lib/local-runtime/production/terminal-failure.js";
import { executionFailure, failureCode } from "../../../lib/execution-failure.js";
import { HASH_A, HASH_B } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-confirmed-recovery-"));
try {
  let targetMode: string | undefined;
  let acquisitions = 0;
  let selections = 0;
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
          executeDomIntent: async () => { selections += 1; },
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
  await lifecycle.settle(null);

  const providerEffectIdentityHash = `sha256:${"8".repeat(64)}` as const;
  const failingTools = new ProductionGptChildTools(
    temporary, HASH_A, {} as never, {} as never, {
      readProviderEffectStepCallIdentities: () => Object.freeze([]),
      readExactCallMutationFact: () => ({
        effectScope: "provider_effect", providerEffectIdentityHash, outcome: "CONFIRMED",
        mutationOutcome: "confirmed", terminalAt: "2026-09-12T00:00:00.000Z",
        failureCode: null, nativeFailureCode: null, authorityRef: "browser-mutation:submit",
        authorityHash: HASH_B, targetRef: "target:old", documentRef: "document:old",
        productStepId: "observe", callId: "turn-submit",
        childCapabilityId: "submit_exact_gpt_turn_once", actionOrdinal: 1,
        physicalInputCount: 0, downloadGuidHash: null, downloadCompleted: false,
        identityRevalidated: false,
      }),
      acquireJobBoundTargetLease: async () => {
        throw executionFailure("failed", "BROWSER_ORIGIN_REJECTED");
      },
    } as never, createRuntimeLogger({
      producer: "agent-confirmed-origin-rejection-acceptance", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: path.join(temporary, "runtime-logs-origin") },
    }), {} as never,
  ).createExecution({
    jobId: "job:confirmed-recovery", attemptId: "attempt:confirmed-recovery", resultRevision: 0,
    productId: "public_knowledge_article_pipeline",
    ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
    capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent",
    maxProviderTurns: 1,
  });
  let recoveryFailure: unknown = null;
  try {
    await failingTools.tools.readConfirmedSubmit({ sessionKey: "session:failed-origin",
      productStepId: "observe", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
      actionOrdinal: 1, input: {} as never });
  } catch (error) { recoveryFailure = error; }
  const serialized = serializeTerminalFailureTransport(recoveryFailure);
  assert.equal(serialized.code, "BROWSER_ORIGIN_REJECTED");
  assert.equal(serialized.mutation_outcome, "confirmed");
  assert.equal(serialized.provider_effect_identity_hash, providerEffectIdentityHash,
    "confirmed-effect Browser acquisition failure must retain the original effect identity");

  const driftedIdentity = `sha256:${"a".repeat(64)}` as const;
  const driftTools = new ProductionGptChildTools(
    temporary, HASH_A, {} as never, {} as never, {
      readProviderEffectStepCallIdentities: () => Object.freeze([driftedIdentity]),
      readExactCallMutationFact: () => null,
      countProviderTurnDispatches: () => 0,
      acquireJobBoundTargetLease: () => {
        throw new Error("PROVIDER_EFFECT_STEP_IDENTITY_GATE_MUST_PRECEDE_ANY_BROWSER_ACQUISITION");
      },
    } as never,
    createRuntimeLogger({
      producer: "agent-step-identity-drift-acceptance", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: path.join(temporary, "runtime-logs-drift") },
    }), {} as never,
  ).createExecution({
    jobId: "job:step-identity-drift", attemptId: "attempt:step-identity-drift", resultRevision: 0,
    productId: "public_knowledge_article_pipeline",
    ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
    capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent",
    maxProviderTurns: 1,
  });
  let driftFailure: unknown = null;
  try {
    await driftTools.tools.readConfirmedSubmit({ sessionKey: "session:step-identity-drift",
      productStepId: "observe", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
      actionOrdinal: 1, input: {} as never });
  } catch (error) { driftFailure = error; }
  assert.equal(failureCode(driftFailure), "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH",
    "a prior provider effect whose identity no longer matches must fail closed before any preparation");

  const freshTools = new ProductionGptChildTools(
    temporary, HASH_A, {} as never, {} as never, {
      readProviderEffectStepCallIdentities: () => Object.freeze([]),
      readExactCallMutationFact: () => null,
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
} finally {
  await rm(temporary, { recursive: true, force: true });
}
