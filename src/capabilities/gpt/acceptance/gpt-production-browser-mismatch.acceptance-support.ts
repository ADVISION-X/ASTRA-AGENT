import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { serializeTerminalFailureTransport } from
  "../../../lib/local-runtime/production/terminal-failure.js";
import { executionFailure } from "../../../lib/execution-failure.js";
import { typedGptExecutionFailure } from "../execution-fault.js";
import { browserExactCallIdentityHash } from "../../../lib/browser/browser-authority-api.js";
import { createGptAbilityGroup } from "../ability-group.js";
import { HASH_A, HASH_B } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";
import {
  detectedKnownGptRateLimitExactFact,
  detectedKnownGptRateLimitMismatchFact,
} from
  "../../../../scripts/acceptance/local-browser-rate-limit-detector.acceptance-support.js";
import { ProductionRuntimeStore } from "../../../lib/local-runtime/production/store.js";
import { executeClaim } from "../../../lib/local-runtime/production/runtime-claim.js";
import { claimTask, deviceStatusWithoutAdmission, task } from
  "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";
import { BrowserMutationStore } from
  "../../../lib/browser/exact-target/browser-mutation-store.js";
import type { BrowserAtomicStepIdentity, BrowserExecutionBinding } from
  "../../../lib/browser/browser-authority-api.js";
import type { BrowserCommandPermit } from
  "../../../lib/browser/transport/command-permit.js";
import {
  absentPreflightEnvelope,
  createBrowserActorFactory,
  permit,
  rateLimitSpecialReceipt,
} from "../../../../scripts/acceptance/local-browser-terminal-fixture.js";

const mismatchPreflightFact = await detectedKnownGptRateLimitMismatchFact();
const mismatchAuthorityRef = ["browser-gpt-dialog-unrecognized",
  mismatchPreflightFact.observedAt, mismatchPreflightFact.exactCallIdentityHash,
  mismatchPreflightFact.targetRefHash, mismatchPreflightFact.documentRefHash].join("|");
const exactPreflightFact = await detectedKnownGptRateLimitExactFact();
const exactAuthorityRef = ["browser-known-gpt-rate-limit",
  exactPreflightFact.observedAt, exactPreflightFact.exactCallIdentityHash,
  exactPreflightFact.targetRefHash, exactPreflightFact.documentRefHash].join("|");

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

  const confirmedMismatchJobId = "job:confirmed-dialog-mismatch";
  const confirmedMismatchEvidenceRef = mismatchAuthorityRef;
  const confirmedMismatchTools = new ProductionGptChildTools(
    temporary, HASH_A, createGptAbilityGroup(), {} as never, {
      readProviderEffectStepCallFact: () => ({
        exactCallIdentityHash: historicalExactHash(confirmedMismatchJobId),
        inputHash: historicalAtomicInputHash,
        mutation: confirmedMutation(),
      }),
      countProviderTurnDispatches: () => 0,
      acquireJobBoundTargetLease: async () => {
        throw executionFailure("failed", "BROWSER_GPT_DIALOG_UNRECOGNIZED", {
          metadata: { mutationOutcome: "no",
            knownGptRateLimitPreflightFact: mismatchPreflightFact, evidence: {
              evidenceRef: confirmedMismatchEvidenceRef,
              evidenceHash: mismatchPreflightFact.observationHash,
            } },
        });
      },
    } as never,
    createRuntimeLogger({
      producer: "agent-confirmed-dialog-mismatch-acceptance", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: path.join(temporary, "runtime-logs-confirmed-dialog-mismatch") },
    }), {} as never,
  ).createExecution({
    jobId: confirmedMismatchJobId, attemptId: "attempt:confirmed-dialog-mismatch",
    resultRevision: 0, productId: "public_knowledge_article_pipeline",
    ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
    capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent",
    maxProviderTurns: 1,
  });
  let confirmedMismatchFailure: unknown = null;
  try {
    await confirmedMismatchTools.tools.readConfirmedSubmit({
      sessionKey: "session:confirmed-dialog-mismatch", productStepId: "observe",
      callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 1,
      input: { files: [], promptHash: HASH_B },
    });
  } catch (error) { confirmedMismatchFailure = error; }
  const normalizedConfirmedMismatch = typedGptExecutionFailure(confirmedMismatchFailure);
  assert.equal(normalizedConfirmedMismatch?.code, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
  assert.equal(normalizedConfirmedMismatch?.browserEffect?.providerEffectIdentityHash,
    providerEffectIdentityHash,
    "confirmed readback mismatch must retain the historical provider-effect identity");
  assert.deepEqual(
    normalizedConfirmedMismatch?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact,
    mismatchPreflightFact,
    "confirmed readback acquisition mismatch must enter the same typed proof chain",
  );

  let exactAcquisitions = 0;
  let exactIncidents = 0;
  let exactClearances = 0;
  let exactGateClosed = false;
  let exactIncidentPersistenceFails = false;
  const confirmedExactJobId = "job:confirmed-known-rate-limit";
  const confirmedExactToolOwner = new ProductionGptChildTools(
    temporary, HASH_A, createGptAbilityGroup(), {} as never, {
      readProviderEffectStepCallFact: () => ({
        exactCallIdentityHash: historicalExactHash(confirmedExactJobId),
        inputHash: historicalAtomicInputHash,
        mutation: confirmedMutation(),
      }),
      countProviderTurnDispatches: () => 0,
      acquireJobBoundTargetLease: async () => {
        exactAcquisitions += 1;
        if (exactAcquisitions > 1) {
          throw executionFailure("failed", "ACK_BROWSER_UNAVAILABLE");
        }
        return {
          target: { targetRef: "target:confirmed-known-rate-limit" },
          document: { documentRef: "document:confirmed-known-rate-limit" },
          pendingMutationCount: () => 0,
          readAtomicStepOutcome: () => ({
            state: "confirmed", mutationOutcome: "confirmed", providerEffectIdentityHash,
            terminalAt: "2026-09-12T00:00:00.000Z", failureCode: null, nativeFailureCode: null,
            authorityRef: "browser-mutation:submit", authorityHash: HASH_B,
            targetRef: "target:old", documentRef: "document:old", physicalInputCount: 1,
            downloadGuidHash: null, downloadCompleted: false, identityRevalidated: false,
            terminalPayload: {
              canonicalConversationUrl: "https://chatgpt.com/c/confirmed-known-rate-limit",
              promptHash: historicalPromptHash, userTurnId: "conversation-turn-1",
              exactCallIdentityHash: historicalExactHash(confirmedExactJobId),
              observationRevisionHash: HASH_A, targetRefHash: HASH_A,
              documentRefHash: HASH_B, rawCount: 1, eligibleCount: 1,
            },
          }),
          executeDomIntent: async () => {
            throw executionFailure("failed", "BROWSER_KNOWN_GPT_RATE_LIMIT", {
              metadata: { mutationOutcome: "no",
                knownGptRateLimitPreflightFact: exactPreflightFact,
                evidence: { evidenceRef: exactAuthorityRef,
                  evidenceHash: exactPreflightFact.observationHash } },
            });
          },
          park: async () => undefined,
        };
      },
    } as never,
    createRuntimeLogger({
      producer: "agent-confirmed-known-rate-limit-acceptance", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: path.join(temporary, "runtime-logs-confirmed-known-rate-limit") },
    }), {
      assertProviderSubmitAllowed: () => {
        if (exactGateClosed) {
          throw executionFailure("failed", "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE");
        }
      },
      pendingIncidents: () => [],
      beginIncident: async () => {
        exactIncidents += 1;
        if (exactIncidentPersistenceFails) {
          throw executionFailure("failed", "PROVIDER_COOLDOWN_OUTBOX_WRITE_FAILED");
        }
        exactGateClosed = true;
        return {
          incidentRequestId: `aipcooldown_${"7".repeat(40)}`,
          deliver: async () => { exactClearances += 1; },
        };
      },
    },
  );
  const confirmedExactTools = confirmedExactToolOwner.createExecution({
    jobId: confirmedExactJobId, attemptId: "attempt:confirmed-known-rate-limit",
    resultRevision: 0, productId: "public_knowledge_article_pipeline",
    ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
    capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent",
    maxProviderTurns: 1,
  });
  let confirmedExactFailure: unknown = null;
  try {
    await confirmedExactTools.tools.readConfirmedSubmit({
      sessionKey: "session:confirmed-known-rate-limit", productStepId: "observe",
      callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 1,
      input: { files: [], promptHash: HASH_B },
    });
  } catch (error) { confirmedExactFailure = error; }
  const normalizedConfirmedExact = typedGptExecutionFailure(confirmedExactFailure);
  assert.equal(normalizedConfirmedExact?.code, "BROWSER_KNOWN_GPT_RATE_LIMIT");
  assert.equal(normalizedConfirmedExact?.browserEffect?.providerEffectIdentityHash,
    providerEffectIdentityHash,
    "post-atomic rate-limit closure must retain the confirmed provider-effect identity");
  assert.deepEqual(
    normalizedConfirmedExact?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact,
    exactPreflightFact,
    "post-atomic exact dialog must retain its complete Browser mechanical fact",
  );
  assert.deepEqual([exactIncidents, exactClearances, exactGateClosed], [1, 1, true],
    "post-atomic exact dialog must close the existing incident/clearance/cooldown gate once");
  assert.equal(exactAcquisitions, 1,
    "confirmed recovery and its acknowledgement must stay on the one bound Browser lease");

  exactAcquisitions = 0;
  exactGateClosed = false;
  exactIncidentPersistenceFails = true;
  const closureFailureTools = confirmedExactToolOwner.createExecution({
    jobId: confirmedExactJobId, attemptId: "attempt:confirmed-known-rate-limit",
    resultRevision: 0, productId: "public_knowledge_article_pipeline",
    ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
    capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent",
    maxProviderTurns: 1,
  });
  let closureFailure: unknown = null;
  try {
    await closureFailureTools.tools.readConfirmedSubmit({
      sessionKey: "session:confirmed-known-rate-limit", productStepId: "observe",
      callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 1,
      input: { files: [], promptHash: HASH_B },
    });
  } catch (error) { closureFailure = error; }
  const normalizedClosureFailure = typedGptExecutionFailure(closureFailure);
  assert.equal(normalizedClosureFailure?.code, "PROVIDER_COOLDOWN_OUTBOX_WRITE_FAILED");
  assert.equal(normalizedClosureFailure?.mutationOutcome, "confirmed");
  assert.equal(normalizedClosureFailure?.browserEffect?.providerEffectIdentityHash,
    providerEffectIdentityHash,
    "closure persistence failure must retain the already-confirmed provider effect");
  assert.equal(exactGateClosed, false,
    "a failed incident persistence must not claim that the submit gate was durably closed");

  let freshExactArtifactWrites = 0;
  let freshExactIncidents = 0;
  let freshExactClearances = 0;
  let freshExactGateClosed = false;
  const freshExactTools = new ProductionGptChildTools(
    temporary, HASH_A, createGptAbilityGroup(), {
      appendArtifact: async () => { freshExactArtifactWrites += 1;
        return { status: "failed", failureReason: "forbidden" }; },
      readArtifact: async () => { freshExactArtifactWrites += 1;
        return { status: "failed", failureReason: "forbidden" }; },
    }, {
      readProviderEffectStepCallFact: () => null,
      countProviderTurnDispatches: () => 0,
      acquireJobBoundTargetLease: async () => ({
        target: { targetRef: "target:fresh-known-rate-limit" },
        document: { documentRef: "document:fresh-known-rate-limit" },
        pendingMutationCount: () => 0,
        readAtomicStepOutcome: () => null,
        runAtomicStep: async <T>(_identity: BrowserAtomicStepIdentity, action: () => Promise<T>) =>
          await action(),
        executeDomIntent: async () => {
          throw executionFailure("failed", "BROWSER_KNOWN_GPT_RATE_LIMIT", {
            metadata: { mutationOutcome: "no",
              knownGptRateLimitPreflightFact: exactPreflightFact,
              evidence: { evidenceRef: exactAuthorityRef,
                evidenceHash: exactPreflightFact.observationHash } },
          });
        },
        park: async () => undefined,
      }),
    } as never,
    createRuntimeLogger({
      producer: "agent-fresh-known-rate-limit-acceptance", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: path.join(temporary, "runtime-logs-fresh-known-rate-limit") },
    }), {
      assertProviderSubmitAllowed: () => {
        if (freshExactGateClosed) {
          throw executionFailure("failed", "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE");
        }
      },
      pendingIncidents: () => [],
      beginIncident: async () => {
        freshExactIncidents += 1;
        freshExactGateClosed = true;
        return {
          incidentRequestId: `aipcooldown_${"9".repeat(40)}`,
          deliver: async () => { freshExactClearances += 1; },
        };
      },
    },
  ).createExecution({
    jobId: "job:fresh-known-rate-limit", attemptId: "attempt:fresh-known-rate-limit",
    resultRevision: 0, productId: "public_knowledge_article_pipeline",
    ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
    capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent",
    maxProviderTurns: 1,
  });
  let freshExactFailure: unknown = null;
  try {
    await freshExactTools.tools.execute({
      sessionKey: "session:fresh-known-rate-limit", productStepId: "prepare",
      callId: "prepare:known-rate-limit", child: "prepare_clean_gpt_chat", actionOrdinal: 1,
      input: { timeoutMs: 60_000 },
    });
  } catch (error) { freshExactFailure = error; }
  const normalizedFreshExact = typedGptExecutionFailure(freshExactFailure);
  assert.equal(normalizedFreshExact?.code, "BROWSER_KNOWN_GPT_RATE_LIMIT");
  assert.deepEqual(
    normalizedFreshExact?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact,
    exactPreflightFact,
  );
  assert.deepEqual([freshExactIncidents, freshExactClearances, freshExactGateClosed], [1, 1, true]);
  assert.equal(freshExactArtifactWrites, 0,
    "an exact dialog and its acknowledgement failure must not enter the Forensics artifact port");
  await assert.rejects(freshExactTools.tools.execute({
    sessionKey: "session:fresh-known-rate-limit", productStepId: "prepare",
    callId: "prepare:concurrent-known-rate-limit", child: "prepare_clean_gpt_chat",
    actionOrdinal: 2, input: { timeoutMs: 60_000 },
  }), (error: unknown) => typedGptExecutionFailure(error)?.code
    === "BROWSER_KNOWN_GPT_RATE_LIMIT");
  assert.deepEqual([freshExactIncidents, freshExactClearances], [1, 1],
    "a closed submit gate must absorb concurrent exact blockers without a second incident or ack");

  let artifactWrites = 0;
  let providerControlCalls = 0;
  const mismatchEvidenceRef = mismatchAuthorityRef;
  const mismatchEvidenceHash = mismatchPreflightFact.observationHash;
  const mismatchTools = new ProductionGptChildTools(
    temporary,
    HASH_A,
    createGptAbilityGroup(),
    {
      appendArtifact: async () => { artifactWrites += 1; return { status: "failed", failureReason: "forbidden" }; },
      readArtifact: async () => { artifactWrites += 1; return { status: "failed", failureReason: "forbidden" }; },
    },
    {
      readProviderEffectStepCallFact: () => null,
      countProviderTurnDispatches: () => 0,
      acquireJobBoundTargetLease: async () => {
        throw executionFailure("failed", "BROWSER_GPT_DIALOG_UNRECOGNIZED", {
          metadata: { mutationOutcome: "no",
            knownGptRateLimitPreflightFact: mismatchPreflightFact, evidence: {
            evidenceRef: mismatchEvidenceRef, evidenceHash: mismatchEvidenceHash,
          } },
        });
      },
    },
    createRuntimeLogger({
      producer: "agent-dialog-mismatch-acceptance", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: path.join(temporary, "runtime-logs-dialog-mismatch") },
    }),
    {
      assertProviderSubmitAllowed: () => { providerControlCalls += 1; },
      pendingIncidents: () => { providerControlCalls += 1; return []; },
      beginIncident: async () => { providerControlCalls += 1; throw new Error("forbidden"); },
    },
  ).createExecution({
    jobId: "job:dialog-mismatch", attemptId: "attempt:dialog-mismatch", resultRevision: 0,
    productId: "public_knowledge_article_pipeline",
    ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_A,
    capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent",
    maxProviderTurns: 1,
  });
  let mismatchFailure: unknown = null;
  try {
    await mismatchTools.tools.execute({
      sessionKey: "session:dialog-mismatch", productStepId: "prepare", callId: "prepare:1",
      child: "prepare_clean_gpt_chat", actionOrdinal: 1, input: { timeoutMs: 60_000 },
    });
  } catch (error) { mismatchFailure = error; }
  const normalizedMismatch = typedGptExecutionFailure(mismatchFailure);
  assert.equal(normalizedMismatch?.code, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
  assert.equal(normalizedMismatch?.proofFacts?.browserFact?.browserOutcome, "REJECTED");
  assert.equal(normalizedMismatch?.proofFacts?.browserFact?.evidenceRef, mismatchEvidenceRef);
  assert.equal(normalizedMismatch?.proofFacts?.browserFact?.evidenceHash, mismatchEvidenceHash);
  assert.deepEqual(normalizedMismatch?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact,
    mismatchPreflightFact,
    "the complete mismatch mechanical fact must survive acquisition normalization");
  assert.equal(artifactWrites, 0, "dialog mismatch must never enter the Forensics artifact port");
  assert.equal(providerControlCalls, 0, "dialog mismatch must never enter the cooldown control port");

  let atomicArtifactWrites = 0;
  let atomicProviderControlCalls = 0;
  const atomicTargetRef = "target:dialog-mismatch-atomic";
  const atomicDocumentRef = "document:dialog-mismatch-atomic";
  const sha256 = (value: string): `sha256:${string}` =>
    `sha256:${createHash("sha256").update(value).digest("hex")}`;
  const mutationStore = new BrowserMutationStore(
    path.join(temporary, "browser-dialog-mismatch-atomic"),
  );
  const atomicLogger = createRuntimeLogger({
    producer: "agent-dialog-mismatch-atomic-acceptance", owner: "production-runtime",
    component: "gpt-child", terminalEnabled: false,
    fileSink: { directoryPath: path.join(temporary, "runtime-logs-dialog-mismatch-atomic") },
  });
  let atomicBinding: BrowserExecutionBinding | null = null;
  let activeAtomicIdentity: BrowserAtomicStepIdentity | null = null;
  let rejectedAtomicIdentity: BrowserAtomicStepIdentity | null = null;
  let mismatchCommandId: string | null = null;
  let actorMismatchFact: Readonly<Record<string, unknown>> | null = null;
  let commandSequence = 0;
  const actor = createBrowserActorFactory(mutationStore, atomicLogger)(
    async (candidate, command, onDispatched) => {
      if (command.kind === "dom-intent"
        && command.intent.kind === "acknowledgeKnownGptRateLimit") {
        onDispatched?.();
        mismatchCommandId = candidate.commandId;
        const special = rateLimitSpecialReceipt(candidate, "mismatch");
        actorMismatchFact = special.knownGptRateLimitPreflightFact as Readonly<Record<string, unknown>>;
        return Object.freeze({
          replyChannelToken: candidate.replyChannelToken,
          transportSequence: candidate.sequence,
          permitSequence: candidate.sequence,
          result: special,
        });
      }
      return Object.freeze({
        replyChannelToken: candidate.replyChannelToken,
        transportSequence: candidate.sequence,
        permitSequence: candidate.sequence,
        result: absentPreflightEnvelope(candidate, Object.freeze({ waited: true })),
      });
    },
    false,
  );
  const atomicPermit = (
    identity: BrowserAtomicStepIdentity,
    capabilityId: "browser.dom.click.v1" | "browser.wait.v1",
    mutationClass: "mutation" | "observation",
    commandId: string,
  ): BrowserCommandPermit => {
    if (!atomicBinding) throw new Error("BROWSER_EXECUTION_BINDING_MISSING");
    commandSequence += 1;
    return Object.freeze({
      ...permit(commandId),
      jobId: atomicBinding.jobId,
      resultRevision: atomicBinding.resultRevision,
      attemptId: atomicBinding.attemptId,
      deviceId: atomicBinding.deviceId,
      leaseVersion: atomicBinding.leaseVersion,
      localOrderId: atomicBinding.localOrderId,
      targetRef: atomicTargetRef,
      documentRef: atomicDocumentRef,
      productStepId: identity.productStepId,
      callId: identity.callId,
      childCapabilityId: identity.childCapabilityId,
      inputHash: identity.inputHash,
      replayPolicy: identity.replayPolicy,
      actionOrdinal: identity.actionOrdinal,
      writerFenceHash: atomicBinding.writerFenceHash,
      candidateHash: atomicBinding.candidateHash,
      contractManifestHash: atomicBinding.contractManifestHash,
      commandTtlMs: atomicBinding.commandTtlMs,
      capabilityId,
      commandId,
      sequence: commandSequence,
      mutationClass,
      replyChannelToken: `reply:${commandId}`,
    });
  };
  let deliveredClearance: unknown = null;
  const atomicTools = new ProductionGptChildTools(
    temporary,
    HASH_A,
    createGptAbilityGroup(),
    {
      appendArtifact: async () => { atomicArtifactWrites += 1;
        return { status: "failed", failureReason: "forbidden" }; },
      readArtifact: async () => { atomicArtifactWrites += 1;
        return { status: "failed", failureReason: "forbidden" }; },
    },
    {
      readProviderEffectStepCallFact: () => null,
      countProviderTurnDispatches: () => 0,
      acquireJobBoundTargetLease: async (binding: BrowserExecutionBinding, ownerId: string) => {
        atomicBinding = binding;
        return {
          leaseRef: "lease:dialog-mismatch-atomic",
          authorityRef: "authority:dialog-mismatch-atomic",
          authorityEpoch: 1,
          executionBindingHash: HASH_A,
          ownerId,
          agentJobRefHash: binding.jobRefHash,
          agentExecutionRefHash: binding.executionRefHash,
          writerLeaseEpoch: binding.writerLeaseEpoch,
          writerFenceHash: binding.writerFenceHash,
          target: { targetRef: atomicTargetRef },
          document: { documentRef: atomicDocumentRef },
          pendingMutationCount: () => actor.pendingMutationCommandIds(binding).length,
          readAtomicStepOutcome: (identity: BrowserAtomicStepIdentity) =>
            actor.readAtomicStepOutcome(binding, atomicTargetRef, identity),
          runAtomicStep: async <T>(
            identity: BrowserAtomicStepIdentity,
            action: () => Promise<T>,
          ): Promise<T> => {
            if (activeAtomicIdentity) throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_INVALID");
            activeAtomicIdentity = identity;
            rejectedAtomicIdentity = identity;
            try { return await action(); } finally { activeAtomicIdentity = null; }
          },
          executeDomIntent: async (intent: Readonly<Record<string, unknown>>) => {
            if (!activeAtomicIdentity) throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_REQUIRED");
            const commandId = "command:dialog-mismatch-atomic";
            return actor.execute(
              atomicPermit(activeAtomicIdentity, "browser.dom.click.v1", "mutation", commandId),
              { kind: "dom-intent", intent } as never,
            );
          },
          park: async () => undefined,
        } as never;
      },
    } as never,
    atomicLogger,
    {
      assertProviderSubmitAllowed: () => { atomicProviderControlCalls += 1; },
      pendingIncidents: () => {
        atomicProviderControlCalls += 1;
        return [Object.freeze({
          jobId: "job:dialog-mismatch-atomic",
          attemptId: "attempt:dialog-mismatch-atomic",
          resultRevision: 0,
          deviceId: "device:1",
          leaseVersion: 1,
          fenceHash: HASH_A,
          capabilityManifestHash: HASH_B,
          dialogHash: mismatchPreflightFact.dialogHash as `sha256:${string}`,
          observationHash: HASH_A,
          targetRefHash: sha256(atomicTargetRef),
          documentRefHash: sha256(atomicDocumentRef),
          sessionKey: "session:dialog-mismatch-atomic",
          observedAt: "2026-09-21T00:00:00.000Z",
        })];
      },
      beginIncident: async () => {
        atomicProviderControlCalls += 1;
        return Object.freeze({
          incidentRequestId: "aipcooldown_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          deliver: async (clearance: unknown) => {
            atomicProviderControlCalls += 1;
            deliveredClearance = clearance;
          },
        });
      },
    },
  );
  let atomicMismatchFailure: unknown = null;
  try {
    await atomicTools.reconcilePendingProviderRateLimitIncidents(
      "parent:dialog-mismatch-atomic",
      new AbortController().signal,
    );
  } catch (error) { atomicMismatchFailure = error; }
  const normalizedAtomicMismatch = typedGptExecutionFailure(atomicMismatchFailure);
  assert.equal(normalizedAtomicMismatch?.code, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
  assert.ok(mismatchCommandId, "the real Browser actor must dispatch one mismatch command");
  assert.ok(rejectedAtomicIdentity, "the real GPT atomic call must bind its Browser identity");
  assert.equal(mutationStore.readCommand(mismatchCommandId!)?.state, "REJECTED");
  const rejectedWal = actor.readAtomicStepOutcome(
    atomicBinding!, atomicTargetRef, rejectedAtomicIdentity!,
  );
  assert.equal(rejectedWal?.state, "rejected");
  assert.equal(rejectedWal?.failureCode, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
  assert.equal(normalizedAtomicMismatch?.proofFacts?.browserFact?.evidenceRef,
    rejectedWal?.authorityRef);
  assert.equal(normalizedAtomicMismatch?.proofFacts?.browserFact?.evidenceHash,
    rejectedWal?.authorityHash);
  assert.deepEqual(normalizedAtomicMismatch?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact,
    actorMismatchFact,
    "the real detector fact from the Browser actor must survive GPT normalization");
  assert.equal(atomicArtifactWrites, 0);
  assert.equal(atomicProviderControlCalls, 3,
    "the Runtime cooldown port must read, bind, and fail-close the one incident");
  assert.equal((deliveredClearance as { clearance?: string } | null)?.clearance, "not_cleared");

  const runtimeDirectory = path.join(temporary, "runtime-mismatch-integration");
  await mkdir(runtimeDirectory, { recursive: true });
  const runtimeStore = new ProductionRuntimeStore(runtimeDirectory);
  try {
    const websiteTask = task({
      jobId: "job:dialog-mismatch-atomic",
      productId: "payment_screenshot_observation",
      actionId: "observe",
    });
    const job = claimTask(websiteTask);
    const status = deviceStatusWithoutAdmission(job.job_id);
    let releaseRequests = 0;
    await executeClaim({
      abort: new AbortController(), active: new Map(),
      activeAbort: new Map([[job.job_id, new AbortController()]]),
      store: runtimeStore,
      executor: {
        accept: (acceptedTask: typeof websiteTask, attemptId: string) =>
          runtimeStore.acceptTask(acceptedTask, attemptId),
        acceptAfterFailureReconciled: () => { throw new Error("UNEXPECTED_RECONCILIATION"); },
        execute: async () => { throw atomicMismatchFailure; },
      } as never,
      session: {
        workerSessionId: "worker:dialog-mismatch-integration", workerSessionEpoch: 1,
        device: { server_base_url: "http://127.0.0.1:4322" },
        request: async (requestPath: string) => {
          if (requestPath.endsWith("/lease-release")) releaseRequests += 1;
          return (status as unknown as { request(): Promise<unknown> }).request();
        },
      } as never,
      providerRateLimitControl: {} as never, browserAuthority: {} as never,
      gpt: {} as never, evidenceStore: {} as never, dataDir: runtimeDirectory,
      runtimeLogger: createRuntimeLogger({
        producer: "agent-dialog-mismatch-integration", owner: "production-runtime",
        component: "production-runtime", terminalEnabled: false,
        fileSink: { directoryPath: path.join(runtimeDirectory, "runtime-logs") },
      }),
      draining: false, lastHeartbeat: null, lastErrorCode: null, lastErrorReason: null,
      stopped: false, ledgerReconciled: true,
    }, job);
    const runtimeRecord = runtimeStore.readTask(job.job_id);
    assert.equal(runtimeRecord?.current_reason, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
    assert.equal(runtimeRecord?.attempt_failure, null,
      "the real detector-to-GPT mismatch must not become an attempt failure in Runtime");
    assert.equal(runtimeStore.outboxAuthorities().length, 0);
    assert.equal(releaseRequests, 0);
    const rejectedWalHash = rejectedWal!.authorityHash;
    const freshIdentity: BrowserAtomicStepIdentity = Object.freeze({
      resultRevision: 0,
      productStepId: "gpt-rate-limit-control",
      callId: "fresh-absence-after-mismatch",
      childCapabilityId: "fresh_known_gpt_rate_limit_absence",
      inputHash: HASH_B,
      actionOrdinal: 1,
      replayPolicy: "observation-only",
    });
    const freshCommandId = "command:fresh-absence-after-dialog-mismatch";
    const freshResult = await actor.execute(
      atomicPermit(freshIdentity, "browser.wait.v1", "observation", freshCommandId),
      { kind: "wait", durationMs: 1 },
    );
    assert.deepEqual(freshResult, { waited: true },
      "the same Browser authority must admit a fresh absent preflight after the mismatch");
    assert.equal(mutationStore.readCommand(freshCommandId), null,
      "the fresh absence proof must not create a mutation WAL row");
    assert.equal(mutationStore.authorityHash(mismatchCommandId!), rejectedWalHash,
      "the fresh absence must not rewrite the prior rejected WAL authority");
  } finally {
    runtimeStore.close();
    mutationStore.close();
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
