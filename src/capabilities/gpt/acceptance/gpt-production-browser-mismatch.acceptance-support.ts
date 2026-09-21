import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptChildTools } from "../production-child-tools.js";
import { verifyConfirmedReadbackLease, verifyNoPriorProviderEffect } from
  "./gpt-production-browser-recovery.acceptance-support.js";
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
import type { BrowserAtomicStepIdentity } from
  "../../../lib/browser/browser-authority-api.js";

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
  await verifyConfirmedReadbackLease(temporary);

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

  await verifyNoPriorProviderEffect(temporary);

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

  await import("./gpt-production-browser-mismatch-atomic.acceptance-support.js");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
