import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { serializeTerminalFailureTransport } from
  "../../../lib/local-runtime/production/terminal-failure.js";
import { executionFailure } from "../../../lib/execution-failure.js";
import { browserExactCallIdentityHash } from "../../../lib/browser/browser-authority-api.js";
import { createGptAbilityGroup } from "../ability-group.js";
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
  const historicalAtomicInputHash = `sha256:${"7".repeat(64)}` as const;
  const confirmedMutation = (productStepId = "observe") => ({
    effectScope: "provider_effect" as const, providerEffectIdentityHash, outcome: "CONFIRMED" as const,
    mutationOutcome: "confirmed" as const, terminalAt: "2026-09-12T00:00:00.000Z",
    failureCode: null, nativeFailureCode: null, authorityRef: "browser-mutation:submit",
    authorityHash: HASH_B, targetRef: "target:old", documentRef: "document:old",
    productStepId, callId: "turn-submit",
    childCapabilityId: "submit_exact_gpt_turn_once", actionOrdinal: 1,
    physicalInputCount: 1 as const, downloadGuidHash: null, downloadCompleted: false,
    identityRevalidated: false,
  });
  const historicalExactHash = (jobId: string, productStepId = "observe") =>
    browserExactCallIdentityHash({
      jobId, attemptId: "attempt:ignored", writerFenceHash: HASH_A, resultRevision: 0,
      productStepId, callId: "turn-submit", childCapabilityId: "submit_exact_gpt_turn_once",
      inputHash: historicalAtomicInputHash, replayPolicy: "provider-effect-once",
    });
  const failingTools = new ProductionGptChildTools(
    temporary, HASH_A, {} as never, {} as never, {
      readProviderEffectStepCallFact: () => ({
        exactCallIdentityHash: historicalExactHash("job:confirmed-recovery"),
        inputHash: historicalAtomicInputHash,
        mutation: confirmedMutation(),
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

  let recoveredSelections = 0;
  const historicalPromptHash = HASH_A;
  const currentPromptHash = HASH_B;
  const driftJobId = "job:step-identity-drift";
  const driftedIdentity = historicalExactHash(driftJobId);
  const driftTools = new ProductionGptChildTools(
    temporary, HASH_A, createGptAbilityGroup(), {} as never, {
      readProviderEffectStepCallFact: () => ({
        exactCallIdentityHash: driftedIdentity, inputHash: historicalAtomicInputHash,
        mutation: confirmedMutation(),
      }),
      countProviderTurnDispatches: () => 0,
      acquireJobBoundTargetLease: async () => ({
        target: { targetRef: "target:historical-confirmed" },
        document: { documentRef: "document:historical-confirmed" },
        pendingMutationCount: () => 0,
        readAtomicStepOutcome: (identity: Readonly<{ inputHash: string }>) => {
          assert.equal(identity.inputHash, historicalAtomicInputHash);
          return {
            state: "confirmed", mutationOutcome: "confirmed", providerEffectIdentityHash,
            terminalAt: "2026-09-12T00:00:00.000Z", failureCode: null, nativeFailureCode: null,
            authorityRef: "browser-mutation:submit", authorityHash: HASH_B,
            targetRef: "target:old", documentRef: "document:old", physicalInputCount: 1,
            downloadGuidHash: null, downloadCompleted: false, identityRevalidated: false,
            terminalPayload: {
              canonicalConversationUrl: "https://chatgpt.com/c/historical-confirmed",
              promptHash: historicalPromptHash, userTurnId: "conversation-turn-1",
              exactCallIdentityHash: driftedIdentity, observationRevisionHash: HASH_A,
              targetRefHash: HASH_A, documentRefHash: HASH_B, rawCount: 1, eligibleCount: 1,
            },
          };
        },
        executeDomIntent: async () => { recoveredSelections += 1; },
        park: async () => undefined,
      }),
    } as never,
    createRuntimeLogger({
      producer: "agent-step-identity-drift-acceptance", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: path.join(temporary, "runtime-logs-drift") },
    }), {} as never,
  ).createExecution({
    jobId: driftJobId, attemptId: "attempt:step-identity-drift", resultRevision: 0,
    productId: "public_knowledge_article_pipeline",
    ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
    capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent",
    maxProviderTurns: 1,
  });
  const recoveredHistoricalSubmit = await driftTools.tools.readConfirmedSubmit({
    sessionKey: "session:step-identity-drift", productStepId: "observe", callId: "turn-submit",
    child: "submit_exact_gpt_turn_once", actionOrdinal: 1,
    input: { files: [], promptHash: currentPromptHash },
  });
  assert.equal(recoveredHistoricalSubmit?.value.promptHash, historicalPromptHash,
    "a confirmed historical submit must return its persisted prompt fact after current prompt drift");
  assert.equal(recoveredSelections, 1,
    "historical confirmed recovery may only select its canonical conversation and must not submit again");

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
} finally {
  await rm(temporary, { recursive: true, force: true });
}
