import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { createGptAbilityGroup } from "../ability-group.js";
import { typedGptExecutionFailure } from "../execution-fault.js";
import { executionFailure } from "../../../lib/execution-failure.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { serializeTerminalFailureTransport } from "../../../lib/local-runtime/production/terminal-failure.js";
import { browserExactCallIdentityHash, type BrowserAtomicStepIdentity } from "../../../lib/browser/browser-authority-api.js";
import { HASH_A, HASH_B } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";
import { detectedKnownGptRateLimitExactFact, detectedKnownGptRateLimitMismatchFact } from
  "../../../../scripts/acceptance/local-browser-rate-limit-detector.acceptance-support.js";
import { verifyConfirmedReadbackLease, verifyHistoricalReadbackOnlyCall, verifyNoPriorProviderEffect } from
  "./gpt-production-browser-recovery.acceptance-support.js";

const effectHash = `sha256:${"8".repeat(64)}` as const;
const inputHash = `sha256:${"7".repeat(64)}` as const;
const originalIdentity: BrowserAtomicStepIdentity = { resultRevision: 0, productStepId: "observe", callId: "turn-submit",
  childCapabilityId: "submit_exact_gpt_turn_once", inputHash, actionOrdinal: 1, replayPolicy: "provider-effect-once" };
const originalMutation = { effectScope: "provider_effect" as const, providerEffectIdentityHash: effectHash, outcome: "CONFIRMED" as const,
  mutationOutcome: "confirmed" as const, terminalAt: "2026-09-12T00:00:00.000Z", failureCode: null, nativeFailureCode: null,
  authorityRef: "browser-mutation:submit", authorityHash: HASH_B, targetRef: "target:old", documentRef: "document:old",
  productStepId: "observe", callId: "turn-submit", childCapabilityId: "submit_exact_gpt_turn_once", actionOrdinal: 1,
  physicalInputCount: 1 as const, downloadGuidHash: null, downloadCompleted: false, identityRevalidated: false };
const originalHash = (jobId: string) => browserExactCallIdentityHash({ jobId, attemptId: "attempt:original",
  writerFenceHash: HASH_A, ...originalIdentity });
const execution = (jobId: string) => ({ jobId, attemptId: `attempt:${jobId}`, resultRevision: 0,
  productId: "public_knowledge_article_pipeline", ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
  deviceId: "device:1", leaseVersion: 1, executionFenceHash: HASH_B, capabilityManifestHash: HASH_B,
  expiresAtMonotonic: performance.now() + 60_000, commandTtlMs: 1_000, abortSignal: new AbortController().signal,
  parentSpanId: "parent", maxProviderTurns: 1 });
const historicalCall = { sessionKey: "session:readback", productStepId: "observe", callId: "turn-submit",
  child: "submit_exact_gpt_turn_once" as const, actionOrdinal: 1, input: { files: [], promptHash: HASH_B } };
const prepareCall = { sessionKey: "session:prepare", productStepId: "prepare", callId: "prepare:1",
  child: "prepare_clean_gpt_chat" as const, actionOrdinal: 1, input: { timeoutMs: 60_000 } };
const captureFailure = async (action: () => Promise<unknown>): Promise<unknown> => {
  try { await action(); } catch (error) { return error; }
  assert.fail("expected the original failure to close the call");
};
const temporary = await mkdtemp(path.join(tmpdir(), "agent-browser-recovery-rebuild-"));
const logger = (name: string) => createRuntimeLogger({ producer: name, owner: "production-runtime", component: "gpt-child",
  terminalEnabled: false, fileSink: { directoryPath: path.join(temporary, name) } });
const noArtifacts = { appendArtifact: async () => { throw new Error("FORBIDDEN_ARTIFACT_WRITE"); },
  readArtifact: async () => { throw new Error("FORBIDDEN_ARTIFACT_READ"); } };
const noControl = { assertProviderSubmitAllowed: () => {}, pendingIncidents: () => [],
  beginIncident: async (): Promise<never> => { throw new Error("FORBIDDEN_COOLDOWN_INCIDENT"); } };
type Preflight = Awaited<ReturnType<typeof detectedKnownGptRateLimitExactFact>>;
const dialogFailure = (fact: Preflight, code: "BROWSER_KNOWN_GPT_RATE_LIMIT" | "BROWSER_GPT_DIALOG_UNRECOGNIZED") =>
  executionFailure("failed", code, { metadata: { mutationOutcome: "no", knownGptRateLimitPreflightFact: fact,
    evidence: { evidenceRef: [code === "BROWSER_KNOWN_GPT_RATE_LIMIT" ? "browser-known-gpt-rate-limit" : "browser-gpt-dialog-unrecognized",
      fact.observedAt, fact.exactCallIdentityHash, fact.targetRefHash, fact.documentRefHash].join("|"), evidenceHash: fact.observationHash } } });

try {
  await verifyConfirmedReadbackLease(temporary);
  await verifyHistoricalReadbackOnlyCall(temporary);
  await verifyNoPriorProviderEffect(temporary);

  const original = (jobId: string) => ({ exactCallIdentityHash: originalHash(jobId), inputHash, mutation: originalMutation });
  const unavailable = new ProductionGptChildTools(temporary, HASH_A, createGptAbilityGroup(), noArtifacts, {
    readProviderEffectStepCallFact: () => original("job:unavailable"),
    acquireJobBoundTargetLease: async () => { throw executionFailure("failed", "BROWSER_ORIGIN_REJECTED"); },
  } as never, logger("origin-rejection"), noControl).createExecution(execution("job:unavailable"));
  const unavailableFailure = serializeTerminalFailureTransport(await captureFailure(() => unavailable.tools.readConfirmedSubmit(historicalCall)));
  assert.deepEqual([unavailableFailure.code, unavailableFailure.mutation_outcome, unavailableFailure.provider_effect_identity_hash],
    ["BROWSER_ORIGIN_REJECTED", "confirmed", effectHash]);

  let reads = 0, acquisitions = 0, releases = 0, canonicalSelections = 0;
  const driftJob = "job:prompt-drift";
  const payload = (jobId: string) => ({ canonicalConversationUrl: "https://chatgpt.com/c/historical-confirmed", promptHash: HASH_A,
    userTurnId: "00000000-0000-4000-8000-000000000001", exactCallIdentityHash: originalHash(jobId), observationRevisionHash: HASH_A,
    targetRefHash: HASH_A, documentRefHash: HASH_B, rawCount: 1, eligibleCount: 1 });
  const outcome = (jobId: string) => ({ ...originalMutation, state: "confirmed" as const, terminalPayload: payload(jobId) });
  const readOriginalOutcome = (identity: BrowserAtomicStepIdentity, jobId: string) =>
    Object.entries(originalIdentity).every(([field, value]) => identity[field as keyof BrowserAtomicStepIdentity] === value) ? outcome(jobId) : null;
  const foreignIdentities: readonly BrowserAtomicStepIdentity[] = [
    { ...originalIdentity, resultRevision: 1 }, { ...originalIdentity, productStepId: "other-step" },
    { ...originalIdentity, callId: "other-call" }, { ...originalIdentity, childCapabilityId: "prepare_clean_gpt_chat" },
    { ...originalIdentity, inputHash: HASH_B }, { ...originalIdentity, actionOrdinal: 2 },
    { ...originalIdentity, replayPolicy: "target-local-per-generation" },
  ];
  const verifyOriginalOutcome = (read: (identity: BrowserAtomicStepIdentity) => ReturnType<typeof outcome> | null): void => {
    assert.deepEqual(read(originalIdentity), outcome("job:confirmed-exact"));
    for (const foreign of foreignIdentities) assert.equal(read(foreign), null, "A historical receipt belongs to all seven original identity fields.");
    assert.deepEqual(read(originalIdentity), outcome("job:confirmed-exact"));
    assert.equal(read({ ...originalIdentity, inputHash: HASH_B }), null, "Reading A cannot make B receive A.");
  };
  const drift = new ProductionGptChildTools(temporary, HASH_A, createGptAbilityGroup(), noArtifacts, {
    readProviderEffectStepCallFact: () => original(driftJob), countProviderTurnDispatches: () => 0,
    releaseJobBoundTarget: async () => { releases += 1; },
    acquireJobBoundTargetLease: async () => { acquisitions += 1; return {
      target: { targetRef: "target:current" }, document: { documentRef: "document:current" }, writerFenceHash: HASH_B,
      pendingMutationCount: () => 0, readAtomicStepOutcome: (identity: BrowserAtomicStepIdentity) => {
        reads += 1; return readOriginalOutcome(identity, driftJob);
      }, executeDomIntent: async (intent: { kind: string; canonicalConversationUrl?: string }) => {
        assert.equal(intent.kind, "selectExactGptConversation"); assert.equal(intent.canonicalConversationUrl, payload(driftJob).canonicalConversationUrl);
        canonicalSelections += 1;
      }, runAtomicStep: async () => { throw new Error("FORBIDDEN_NEW_INPUT_AFTER_CONFIRMED_SUBMIT"); }, park: async () => {},
    }; },
  } as never, logger("historical-prompt-drift"), noControl).createExecution(execution(driftJob));
  const recovered = await drift.tools.readConfirmedSubmit(historicalCall);
  assert.equal(recovered?.value.promptHash, HASH_A);
  assert.equal(recovered?.effectReceipt?.mutationOutcome, "confirmed");
  assert.equal(recovered?.effectReceipt?.providerEffectIdentityHash, effectHash);
  assert.equal(outcome(driftJob).physicalInputCount, 1);
  assert.ok(reads > 1);
  assert.deepEqual([acquisitions, canonicalSelections, releases], [1, 1, 0]);

  const mismatchFact = await detectedKnownGptRateLimitMismatchFact();
  const mismatchJob = "job:confirmed-mismatch";
  const mismatch = new ProductionGptChildTools(temporary, HASH_A, createGptAbilityGroup(), noArtifacts, {
    readProviderEffectStepCallFact: () => original(mismatchJob), countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => { throw dialogFailure(mismatchFact, "BROWSER_GPT_DIALOG_UNRECOGNIZED"); },
  } as never, logger("confirmed-mismatch"), noControl).createExecution(execution(mismatchJob));
  const mismatchError = typedGptExecutionFailure(await captureFailure(() => mismatch.tools.readConfirmedSubmit(historicalCall)));
  assert.equal(mismatchError?.code, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
  assert.equal(mismatchError?.browserEffect?.providerEffectIdentityHash, effectHash);
  assert.deepEqual(mismatchError?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact, mismatchFact);

  let gateClosed = false, incidents = 0, clearances = 0, exactAcquisitions = 0, persistenceFails = false;
  const exactJob = "job:confirmed-exact";
  let exactFact = await detectedKnownGptRateLimitExactFact();
  const controls = {
    assertProviderSubmitAllowed: () => { if (gateClosed) throw executionFailure("failed", "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE"); },
    pendingIncidents: () => [], beginIncident: async () => {
      incidents += 1; if (persistenceFails) throw executionFailure("failed", "PROVIDER_COOLDOWN_OUTBOX_WRITE_FAILED");
      gateClosed = true; return { incidentRequestId: `aipcooldown_${"7".repeat(40)}`,
        deliver: async (receipt: { clearance: string }) => { assert.equal(receipt.clearance, "not_cleared"); clearances += 1; } };
    },
  };
  const exactRead = (identity: BrowserAtomicStepIdentity) => readOriginalOutcome(identity, exactJob);
  verifyOriginalOutcome(exactRead);
  const exactOwner = new ProductionGptChildTools(temporary, HASH_A, createGptAbilityGroup(), noArtifacts, {
    readProviderEffectStepCallFact: () => original(exactJob), countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => { exactAcquisitions += 1; assert.equal(exactAcquisitions, 1); return {
      target: { targetRef: "target:exact" }, document: { documentRef: "document:exact" }, pendingMutationCount: () => 0,
      readAtomicStepOutcome: exactRead,
      runAtomicStep: async <T>(_identity: BrowserAtomicStepIdentity, action: () => Promise<T>) => await action(),
      executeDomIntent: async () => { throw dialogFailure(exactFact, "BROWSER_KNOWN_GPT_RATE_LIMIT"); }, park: async () => {},
    }; },
  } as never, logger("confirmed-exact"), controls);
  const exactError = typedGptExecutionFailure(await captureFailure(() => exactOwner.createExecution(execution(exactJob)).tools.readConfirmedSubmit(historicalCall)));
  assert.equal(exactError?.code, "BROWSER_KNOWN_GPT_RATE_LIMIT");
  assert.equal(exactError?.browserEffect?.providerEffectIdentityHash, effectHash);
  assert.deepEqual(exactError?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact, exactFact);
  assert.deepEqual([incidents, clearances, gateClosed, exactAcquisitions], [1, 1, true, 1]);
  gateClosed = false; exactAcquisitions = 0; persistenceFails = true;
  exactFact = await detectedKnownGptRateLimitExactFact();
  const persistenceError = typedGptExecutionFailure(await captureFailure(() => exactOwner.createExecution(execution(exactJob)).tools.readConfirmedSubmit(historicalCall)));
  assert.deepEqual([persistenceError?.code, persistenceError?.mutationOutcome, persistenceError?.browserEffect?.providerEffectIdentityHash, gateClosed],
    ["PROVIDER_COOLDOWN_OUTBOX_WRITE_FAILED", "confirmed", effectHash, false]);

  let freshArtifacts = 0, freshIncidents = 0, freshClearances = 0, freshGate = false;
  const freshFact = await detectedKnownGptRateLimitExactFact();
  const fresh = new ProductionGptChildTools(temporary, HASH_A, createGptAbilityGroup(), {
    appendArtifact: async () => { freshArtifacts += 1; throw new Error("FORBIDDEN_ARTIFACT_WRITE"); },
    readArtifact: async () => { freshArtifacts += 1; throw new Error("FORBIDDEN_ARTIFACT_READ"); },
  }, {
    readProviderEffectStepCallFact: () => null, countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => ({ target: { targetRef: "target:fresh" }, document: { documentRef: "document:fresh" },
      pendingMutationCount: () => 0, readAtomicStepOutcome: () => null,
      runAtomicStep: async <T>(_identity: BrowserAtomicStepIdentity, action: () => Promise<T>) => await action(),
      executeDomIntent: async () => { throw dialogFailure(freshFact, "BROWSER_KNOWN_GPT_RATE_LIMIT"); }, park: async () => {} }),
  } as never, logger("fresh-exact"), {
    assertProviderSubmitAllowed: () => { if (freshGate) throw executionFailure("failed", "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE"); },
    pendingIncidents: () => [], beginIncident: async () => { freshIncidents += 1; freshGate = true;
      return { incidentRequestId: `aipcooldown_${"9".repeat(40)}`, deliver: async () => { freshClearances += 1; } }; },
  }).createExecution(execution("job:fresh-exact"));
  const freshError = typedGptExecutionFailure(await captureFailure(() => fresh.tools.execute(prepareCall)));
  assert.equal(freshError?.code, "BROWSER_KNOWN_GPT_RATE_LIMIT");
  assert.deepEqual(freshError?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact, freshFact);
  assert.deepEqual([freshArtifacts, freshIncidents, freshClearances, freshGate], [0, 1, 1, true]);
  const concurrent = typedGptExecutionFailure(await captureFailure(() => fresh.tools.execute({ ...prepareCall, callId: "prepare:concurrent", actionOrdinal: 2 })));
  assert.equal(concurrent?.code, "BROWSER_KNOWN_GPT_RATE_LIMIT");
  assert.deepEqual([freshArtifacts, freshIncidents, freshClearances], [0, 1, 1]);

  let mismatchArtifacts = 0, mismatchControl = 0;
  const freshMismatch = new ProductionGptChildTools(temporary, HASH_A, createGptAbilityGroup(), {
    appendArtifact: async () => { mismatchArtifacts += 1; throw new Error("FORBIDDEN_ARTIFACT_WRITE"); },
    readArtifact: async () => { mismatchArtifacts += 1; throw new Error("FORBIDDEN_ARTIFACT_READ"); },
  }, { readProviderEffectStepCallFact: () => null, countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => { throw dialogFailure(mismatchFact, "BROWSER_GPT_DIALOG_UNRECOGNIZED"); },
  } as never, logger("fresh-mismatch"), {
    assertProviderSubmitAllowed: () => { mismatchControl += 1; }, pendingIncidents: () => { mismatchControl += 1; return []; },
    beginIncident: async (): Promise<never> => { mismatchControl += 1; throw new Error("FORBIDDEN_INCIDENT"); },
  }).createExecution(execution("job:fresh-mismatch"));
  const freshMismatchError = typedGptExecutionFailure(await captureFailure(() => freshMismatch.tools.execute(prepareCall)));
  assert.equal(freshMismatchError?.code, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
  assert.equal(freshMismatchError?.proofFacts?.browserFact?.browserOutcome, "REJECTED");
  assert.equal(freshMismatchError?.proofFacts?.browserFact?.evidenceHash, mismatchFact.observationHash);
  assert.deepEqual(freshMismatchError?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact, mismatchFact);
  assert.deepEqual([mismatchArtifacts, mismatchControl], [0, 0]);
} finally { await rm(temporary, { recursive: true, force: true }); }
