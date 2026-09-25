import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { acceptClaim } from "../../src/lib/local-runtime/production/runtime-claim-operations.js";
import type { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { requireRuntimeLogWrite } from "../../src/lib/runtime-logs/index.js";
import { businessInFlightCount, claimReusesExistingBusinessSlot } from "../../src/lib/local-runtime/production/runtime-loops.js";
import { targetlessFirstFactHash, validV44SourceHandoff } from "../../src/lib/local-runtime/production/store-source-settlement.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { attemptFailureFirstFact, claimTask, resultFor, stageResultForAcceptance,
  task } from "./agent-production-runtime-fixtures.js";

type Job = ReturnType<typeof task>;
type FirstFailure = ReturnType<typeof attemptFailureFirstFact>;
type Hash = `sha256:${string}`;

const sourceBodyFor = (store: ProductionRuntimeStore, job: Job, providerEffectHash: Hash) => {
  const outbox = store.readResultOutboxHistoryEvidence(job.job_id, "attempt:1");
  return {
    kind: "attempt_handoff" as const,
    job_id: job.job_id,
    source_attempt_id: "attempt:1",
    source_task_hash: hashCanonical(job),
    first_fact_raw_hash: targetlessFirstFactHash(store.readAttemptFailureRaw(job.job_id)),
    outbox_history_hash: outbox.historyHash,
    outbox_candidate_count: outbox.candidateCount,
    payload_slot_conflict: null,
    browser_history_hash: providerEffectHash,
    browser_row_count: 0,
    browser_input_state: "zero" as const,
    input_quiescence_proof: null,
    readback_exhaustion_hash: null,
    replay_calls: [],
    rejected_call: null,
    readback_proofs: [],
  };
};

type SourceSealContext = Readonly<{
  store: ProductionRuntimeStore; directory: string; job: Job; firstFailure: FirstFailure;
  sourceBody: ReturnType<typeof sourceBodyFor>; sourceSeal: Hash; beforeHandoffSlots: number;
}>;

const rejectGrantWithoutTypedSeal = async (
  context: SourceSealContext, logger: ReturnType<typeof createRuntimeLogger>,
): Promise<void> => {
  const { store, directory, job, sourceSeal, beforeHandoffSlots } = context;
  store.setCurrentReason(job.job_id, `SOURCE_HANDOFF_SEALED|${sourceSeal}`);
  assert.equal(businessInFlightCount({ active: new Map(), store } as never), beforeHandoffSlots,
    "changing only diagnostic reason cannot remove an unfinished business slot");
  assert.equal(store.readSealedSourceHandoff(job.job_id, "attempt:1"), null,
    "forged diagnostic text must not create a typed source seal");
  await mkdir(path.join(directory, "missing-local"));
  const missingLocalStore = new ProductionRuntimeStore(path.join(directory, "missing-local"));
  const issuedClaim = claimTask(job);
  const sealClaim = { ...issuedClaim, grant: { ...issuedClaim.grant,
    source_handoff_seal_hash: sourceSeal } };
  let acceptedByExecutor = 0;
  for (const candidateStore of [store, missingLocalStore]) {
    const span = requireRuntimeLogWrite(logger.startSpan({ traceId: job.job_id,
      owner: "production-runtime", component: "production-runtime", operation: "job.execute",
      typedIdentity: { kind: "lease", jobId: job.job_id, attemptId: sealClaim.grant.attempt_id,
        leaseVersion: sealClaim.grant.lease_version,
        fenceHash: sealClaim.grant.execution_fence.fence_hash } }));
    assert.throws(() => acceptClaim({ store: candidateStore, runtimeLogger: logger,
      executor: { accept: () => { acceptedByExecutor++; },
        acceptAfterSourceHandoff: () => { acceptedByExecutor++; } } } as never,
    sealClaim, new AbortController(), span, null, null),
    /PRODUCTION_SOURCE_HANDOFF_REQUIRED/u,
    "a Website source hash and forged reason cannot authorize a missing typed seal");
    assert.equal(candidateStore.readTask(job.job_id)?.current_attempt_id,
      candidateStore === store ? "attempt:1" : undefined,
      "failed grant must not create or rotate local task authority");
  }
  assert.equal(acceptedByExecutor, 0, "missing typed seal must reach no executor accept path");
  missingLocalStore.close();
};

/** Seal the source attempt, then prove every late write to it is rejected; returns the original sealed_at. */
const exerciseSealedAttemptClosure = (context: SourceSealContext): string => {
  const { store, directory, job, firstFailure, sourceBody, sourceSeal, beforeHandoffSlots } = context;
  store.sealSourceHandoff({ ...sourceBody, seal_hash: sourceSeal });
  const damagedSealDb = new Database(path.join(directory, "production-runtime.sqlite"));
  const sealedAt = damagedSealDb.prepare(`select sealed_at from production_attempt_handoffs
    where job_id=? and source_attempt_id=?`).get(job.job_id, "attempt:1") as { sealed_at: string };
  damagedSealDb.prepare(`update production_attempt_handoffs set sealed_at=null
    where job_id=? and source_attempt_id=?`).run(job.job_id, "attempt:1");
  assert.throws(() => store.sealSourceHandoff({ ...sourceBody, seal_hash: sourceSeal }),
    /PRODUCTION_SOURCE_HANDOFF_CONFLICT/u,
  "a half-sealed row cannot be reported as a successful idempotent seal");
  damagedSealDb.prepare(`update production_attempt_handoffs set sealed_at=?
    where job_id=? and source_attempt_id=?`).run(sealedAt.sealed_at, job.job_id, "attempt:1");
  damagedSealDb.close();
  store.setCurrentReason(job.job_id, "DIAGNOSTIC_CHANGED_AFTER_SEAL");
  assert.equal(store.readSealedSourceHandoff(job.job_id, "attempt:1")?.seal_hash, sourceSeal,
    "typed source seal survives any legal diagnostic reason change");
  store.setCurrentReason(job.job_id, "EXECUTING");
  assert.throws(() => stageResultForAcceptance(
    store, job.job_id, "attempt:1", resultFor(job)), /PRODUCTION_RESULT_ATTEMPT_FENCED/u,
  "EXECUTING diagnostic text cannot reopen a typed sealed source attempt");
  assert.equal(store.readOutboxAuthority(`terminal:acceptance:${job.job_id}:attempt:1`), null,
    "failed late stage must leave the matching terminal intent absent");
  assert.throws(() => store.recordAttemptFailure(job.job_id, "attempt:1", firstFailure),
    /PRODUCTION_ATTEMPT_FAILURE_IDENTITY_MISMATCH/u,
  "late first-failure cannot reopen a sealed source attempt");
  assert.throws(() => store.rebindAttemptFailureReleaseDescriptor(
    job.job_id, firstFailure, { ...firstFailure,
      release_descriptor: { ...firstFailure.release_descriptor,
        lease_version: firstFailure.release_descriptor.lease_version + 1 } },
  ), /PRODUCTION_ATTEMPT_FAILURE_REBIND_CONFLICT/u,
  "late release-descriptor rebind cannot reopen a sealed source attempt");
  assert.throws(() => store.acceptTask(job, "attempt:1"),
    /PRODUCTION_SOURCE_HANDOFF_REQUIRED/u,
  "generic same-attempt regrant cannot reopen a sealed source attempt");
  assert.equal(businessInFlightCount({ active: new Map(), store } as never), beforeHandoffSlots,
    "a sealed source attempt must retain the same job's business slot until Website demand closes");
  return sealedAt.sealed_at;
};

/** The exact typed seal admits only the Website-issued attempt; a later stage plus terminal blocks any seal. */
const exerciseIssuedAttemptAndStageRace = (context: SourceSealContext, sealedAt: string): void => {
  const { store, directory, job, sourceBody, sourceSeal, beforeHandoffSlots } = context;
  assert.equal(claimReusesExistingBusinessSlot({ active: new Map(), store } as never, {
    job_id: job.job_id, grant: { attempt_id: "attempt:2", same_accepted_attempt: false,
      source_handoff_seal_hash: sourceSeal },
  }), true, "a Website-issued new attempt with the exact typed seal reuses that job slot");
  const fresh = store.acceptTaskAfterSourceHandoff(job, "attempt:2", sourceSeal);
  const damagedIssuedDb = new Database(path.join(directory, "production-runtime.sqlite"));
  damagedIssuedDb.prepare(`update production_attempt_handoffs set sealed_at=null
    where job_id=? and source_attempt_id=?`).run(job.job_id, "attempt:1");
  assert.throws(() => store.readIssuedSourceHandoff(job.job_id, "attempt:2", sourceSeal),
    /PRODUCTION_SOURCE_HANDOFF_CONFLICT/u,
  "an issued handoff cannot consume a half-sealed typed row");
  assert.throws(() => store.readAcceptedSourceSettlements(job.job_id),
    /PRODUCTION_SOURCE_HANDOFF_CONFLICT/u,
  "settlement readback cannot consume a half-sealed typed row");
  damagedIssuedDb.prepare(`update production_attempt_handoffs set sealed_at=?
    where job_id=? and source_attempt_id=?`).run(sealedAt, job.job_id, "attempt:1");
  damagedIssuedDb.close();
  assert.equal(businessInFlightCount({ active: new Map(), store } as never), beforeHandoffSlots,
    "the Website-authorized new attempt keeps the same local slot");
  assert.equal(fresh.current_attempt_id, "attempt:2");
  assert.equal(fresh.attempt_failure, null);
  assert.equal(fresh.staged_result, null);
  assert.equal(fresh.current_reason, "LEASE_GRANTED");
  const beforeStage = store.readResultOutboxHistoryEvidence(job.job_id, "attempt:2");
  const stageFirstBody = { ...sourceBody, source_attempt_id: "attempt:2",
    first_fact_raw_hash: null, outbox_history_hash: beforeStage.historyHash,
    outbox_candidate_count: beforeStage.candidateCount };
  const stageFirstManifest = { ...stageFirstBody, seal_hash: hashCanonical(stageFirstBody) };
  assert.equal(validV44SourceHandoff(stageFirstManifest), true);
  store.setCurrentReason(job.job_id, "DIAGNOSTIC_NOT_EXECUTING");
  stageResultForAcceptance(store, job.job_id, "attempt:2", resultFor(job));
  assert.deepEqual(store.readTask(job.job_id)?.staged_result, resultFor(job),
    "valid typed attempt can stage with any legal diagnostic reason");
  assert.equal(store.readOutboxAuthority(`terminal:acceptance:${job.job_id}:attempt:2`)?.kind,
    "terminal", "successful stage must atomically persist its terminal intent");
  assert.throws(() => store.sealSourceHandoff(stageFirstManifest),
    /PRODUCTION_SOURCE_HANDOFF_CONFLICT/u,
  "stage plus terminal wins the transaction and prevents a later source seal");
};

type SourceSealScenario = Readonly<{
  store: ProductionRuntimeStore; directory: string; job: Job; firstFailure: FirstFailure;
  providerEffectHash: Hash; logger: ReturnType<typeof createRuntimeLogger>;
}>;

/** The typed production_attempt_handoffs seal, not diagnostic current_reason text, closes a source attempt. */
export const verifyTypedSourceSealAuthority = async (scenario: SourceSealScenario): Promise<void> => {
  const { store, directory, job, firstFailure, providerEffectHash, logger } = scenario;
  const sourceBody = sourceBodyFor(store, job, providerEffectHash);
  const context: SourceSealContext = { store, directory, job, firstFailure, sourceBody,
    sourceSeal: hashCanonical(sourceBody),
    beforeHandoffSlots: businessInFlightCount({ active: new Map(), store } as never) };
  await rejectGrantWithoutTypedSeal(context, logger);
  const sealedAt = exerciseSealedAttemptClosure(context);
  exerciseIssuedAttemptAndStageRace(context, sealedAt);
};

const regrantFixture = (store: ProductionRuntimeStore) => {
  const regrantJob = task({ jobId: "job:regrant-fence", productId: "payment_screenshot_observation", actionId: "observe" });
  const regrantPath = (name: string) =>
    `/internal/ai-production/v6/jobs/${encodeURIComponent(regrantJob.job_id)}/artifacts/result_payload/${name}`;
  const fencedWrite = (key: string, fence: string, body = "same-result") => ({
    idempotency_key: key, kind: "artifact" as const, path: regrantPath(key), method: "PUT" as const,
    headers: { "x-ai-execution-fence-hash": fence, "content-type": "application/json", "x-ai-request-id": key },
    body: Buffer.from(body),
  });
  const receipt = { receipt_hash: `sha256:${"d".repeat(64)}` };
  const neverSend = async (): Promise<never> => { throw new Error("A_RECORDED_OR_REPLACED_WRITE_MUST_NOT_BE_SENT"); };
  assert.equal(store.acceptTask(regrantJob, "attempt:1").current_reason, "LEASE_GRANTED");
  return { regrantJob, fencedWrite, receipt, neverSend };
};
type RegrantFixture = ReturnType<typeof regrantFixture>;

/** A regrant only opens a recorded Outbox write under the new execution fence. */
const exerciseRegrantFenceForRecordedWrite = async (
  store: ProductionRuntimeStore, fixture: RegrantFixture,
): Promise<void> => {
  const { regrantJob, fencedWrite, receipt, neverSend } = fixture;
  store.enqueue(fencedWrite("regrant-result", "fence:A"));
  await assert.rejects(store.deliverOutbox("regrant-result", async () => {
    throw runtimeTransportFailure("INTERNAL_ERROR", 500);
  }), (error: unknown) => typedExecutionFailure(error)?.code === "INTERNAL_ERROR");
  store.enqueue(fencedWrite("regrant-result", "fence:A"));
  assert.equal(store.readOutboxAuthority("regrant-result")?.lastError, "INTERNAL_ERROR",
    "re-enqueue under the same fence must keep the recorded failure");
  await assert.rejects(store.deliverOutbox("regrant-result", neverSend),
    (error: unknown) => typedExecutionFailure(error)?.code === "INTERNAL_ERROR",
    "the same lease must not replay a recorded failure");
  assert.equal(store.acceptTask(regrantJob, "attempt:1").current_reason, "LEASE_REGRANTED");
  store.enqueue(fencedWrite("regrant-result", "fence:B"));
  assert.equal(store.readOutboxAuthority("regrant-result")?.lastError, null);
  const delivered = await store.deliverOutbox("regrant-result", async (write) => {
    assert.equal(write.headers["x-ai-execution-fence-hash"], "fence:B");
    return receipt;
  });
  assert.equal(store.readOutboxAuthority("regrant-result")?.state, "delivered");
  store.enqueue(fencedWrite("regrant-result", "fence:C"));
  assert.deepEqual(await store.deliverOutbox("regrant-result", neverSend), delivered,
    "a delivered write returns its stored receipt under a later fence");
  assert.throws(() => store.enqueue(fencedWrite("regrant-result", "fence:C", "different-result")),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT");
  assert.throws(() => store.enqueue({ ...fencedWrite("regrant-result", "fence:C"),
    headers: { ...fencedWrite("regrant-result", "fence:C").headers, "content-type": "application/octet-stream" } }),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT",
    "only the execution fence header may differ");
};

/** A stale or Website-replaced write is settled by its own typed error, never resent under a newer fence. */
const exerciseStaleAndReplacedWrites = async (
  store: ProductionRuntimeStore, fixture: RegrantFixture, providerEffectHash: Hash,
): Promise<void> => {
  const { regrantJob, fencedWrite, receipt, neverSend } = fixture;
  store.enqueue(fencedWrite("regrant-stale", "fence:A"));
  await assert.rejects(store.deliverOutbox("regrant-stale", async () => {
    throw runtimeTransportFailure("AI_LEASE_FENCE_STALE", 409);
  }));
  assert.equal(store.readOutboxAuthority("regrant-stale")?.lastError, "WEBSITE_HTTP_409:AI_LEASE_FENCE_STALE");
  store.acceptTask(regrantJob, "attempt:1");
  store.enqueue(fencedWrite("regrant-stale", "fence:B"));
  assert.equal(store.readOutboxAuthority("regrant-stale")?.lastError, null);
  await store.deliverOutbox("regrant-stale", async (write) => {
    assert.equal(write.headers["x-ai-execution-fence-hash"], "fence:B");
    return receipt;
  });
  assert.equal(store.readOutboxAuthority("regrant-stale")?.state, "delivered");
  store.enqueue(fencedWrite("regrant-replaced", "fence:A"));
  const replacedFailure = attemptFailureFirstFact("attempt:1",
    serializeTerminalFailure(executionFailure("failed", "PRODUCT_EXECUTION_FAILED")));
  store.recordAttemptFailure(regrantJob.job_id, "attempt:1", replacedFailure);
  const replacedOutbox = store.readResultOutboxHistoryEvidence(regrantJob.job_id, "attempt:1");
  const replacedSource = {
    kind: "attempt_handoff" as const,
    job_id: regrantJob.job_id,
    source_attempt_id: "attempt:1",
    source_task_hash: hashCanonical(regrantJob),
    first_fact_raw_hash: targetlessFirstFactHash(store.readAttemptFailureRaw(regrantJob.job_id)),
    outbox_history_hash: replacedOutbox.historyHash,
    outbox_candidate_count: replacedOutbox.candidateCount,
    payload_slot_conflict: null,
    browser_history_hash: providerEffectHash,
    browser_row_count: 0,
    browser_input_state: "zero" as const,
    input_quiescence_proof: null,
    readback_exhaustion_hash: null,
    replay_calls: [],
    rejected_call: null,
    readback_proofs: [],
  };
  const replacedSeal = hashCanonical(replacedSource);
  store.sealSourceHandoff({ ...replacedSource, seal_hash: replacedSeal });
  store.acceptTaskAfterSourceHandoff(regrantJob, "attempt:2", replacedSeal);
  assert.equal(store.readOutboxAuthority("regrant-replaced")?.lastError, "WEBSITE_ATTEMPT_REPLACED");
  store.enqueue(fencedWrite("regrant-replaced", "fence:B"));
  await assert.rejects(store.deliverOutbox("regrant-replaced", neverSend),
    (error: unknown) => typedExecutionFailure(error)?.code === "WEBSITE_ATTEMPT_REPLACED");
};

const exerciseNegativeReadbackProofInterval = (
  store: ProductionRuntimeStore, fixture: RegrantFixture, providerEffectHash: Hash,
): void => {
  const { regrantJob } = fixture;
  const negativeObservation = {
    kind: "negative_exact" as const, path: "exact_conversation" as const,
    effect_identity_hash: providerEffectHash,
    source_effect_set_hash: providerEffectHash,
    wal_authority_hash: providerEffectHash,
    observation_revision_hash: providerEffectHash,
    observed_at: "2030-01-01T00:01:00.000Z",
    first_observed_at: "2030-01-01T00:00:00.000Z",
    observation_count: 1,
    pending_cause: "exact-user-turn-unavailable" as const,
    canonical_conversation_hash: providerEffectHash,
    user_turn_hash: providerEffectHash,
    provider_input_delta: 0 as const,
  };
  assert.throws(() => store.recordSourceReadbackObservation(
    regrantJob.job_id, "attempt:2", negativeObservation,
  ), /PRODUCTION_SOURCE_READBACK_PROOF_INVALID/u,
  "one negative observation cannot become a persisted readback proof");
  assert.throws(() => store.recordSourceReadbackObservation(
    regrantJob.job_id, "attempt:2", {
      ...negativeObservation, observation_count: 2,
      first_observed_at: "2030-01-01T00:02:00.000Z",
    },
  ), /PRODUCTION_SOURCE_READBACK_PROOF_INVALID/u,
  "the proof interval must advance before persisting a negative readback");
  assert.equal(store.readSourceReadbackObservations(regrantJob.job_id, "attempt:2").length, 0);
};

export const verifyOutboxRegrantFenceAndReadbackProof = async (
  store: ProductionRuntimeStore, providerEffectHash: Hash,
): Promise<void> => {
  const fixture = regrantFixture(store);
  await exerciseRegrantFenceForRecordedWrite(store, fixture);
  await exerciseStaleAndReplacedWrites(store, fixture, providerEffectHash);
  exerciseNegativeReadbackProofInterval(store, fixture, providerEffectHash);
};
