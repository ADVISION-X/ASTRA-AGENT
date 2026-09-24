import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { businessInFlightCount } from "../../src/lib/local-runtime/production/runtime-loops.js";
import { historicalEffectsSettled } from "../../src/lib/local-runtime/production/runtime-source-readback-proofs.js";
import { hashCanonical, sha256 } from "../../src/lib/local-runtime/production/contracts.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import {
  serializeTerminalFailure,
  serializeTerminalFailureTransport,
} from "../../src/lib/local-runtime/production/terminal-failure.js";
import { attemptFailureFirstFact, task } from "./agent-production-runtime-fixtures.js";
import { verifyPayloadSlotConflict } from "./agent-production-runtime-payload-slot.acceptance-support.js";
import { verifyRecoveryFailureTransport } from "./agent-production-runtime-failure-transport.acceptance-support.js";

const directory = await mkdtemp(path.join(tmpdir(), "agent-fresh-attempt-"));
try {
  const providerEffectHash = `sha256:${"c".repeat(64)}` as const;
  await verifyRecoveryFailureTransport(providerEffectHash);
  const store = new ProductionRuntimeStore(directory);
  await verifyPayloadSlotConflict(store, providerEffectHash);
  const job = task({
    jobId: "job:fresh-attempt",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  store.acceptTask(job, "attempt:1");
  const firstFailure = attemptFailureFirstFact("attempt:1",
    serializeTerminalFailure(executionFailure("failed", "PRODUCT_EXECUTION_FAILED")));
  store.recordAttemptFailure(
    job.job_id,
    "attempt:1",
    firstFailure,
  );
  const artifactKey = "artifact:fresh-attempt";
  store.enqueue({
    idempotency_key: artifactKey,
    kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/artifacts/result`,
    method: "PUT",
    headers: {},
    body: Buffer.from("result"),
  });
  await assert.rejects(
    store.deliverOutbox(artifactKey, async () => {
      throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE");
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "CLOUD_TRANSPORT_UNAVAILABLE",
  );
  await assert.rejects(
    store.deliverOutbox(artifactKey, async () => {
      throw new Error("AN_ALREADY_RECORDED_FAILURE_MUST_NOT_BE_REPLAYED");
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "CLOUD_TRANSPORT_UNAVAILABLE",
  );
  assert.throws(() => store.acceptTask(job, "attempt:1"),
    /PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_REQUIRED/u);
  const regranted = store.acceptTaskAfterFailureReconciled(job, "attempt:1", firstFailure);
  assert.equal(regranted.current_reason, "LEASE_REGRANTED");
  assert.deepEqual(regranted.attempt_failure, firstFailure,
    "Website regrant of the same accepted attempt must retain the first failure fact");
  assert.throws(() => store.acceptTask(job, "attempt:2"),
    /PRODUCTION_SOURCE_HANDOFF_REQUIRED/u);
  assert.throws(() => store.acceptTaskAfterFailureReconciled(job, "attempt:2", firstFailure),
    /PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_CONFLICT/u);
  const outbox = store.readResultOutboxHistoryEvidence(job.job_id, "attempt:1");
  const sourceBody = {
    kind: "attempt_handoff" as const,
    job_id: job.job_id,
    source_attempt_id: "attempt:1",
    source_task_hash: hashCanonical(job),
    first_fact_raw_hash: sha256(Buffer.from(store.readAttemptFailureRaw(job.job_id)!, "utf8")),
    outbox_history_hash: outbox.historyHash,
    outbox_candidate_count: outbox.candidateCount,
    payload_slot_conflict: null,
    browser_history_hash: providerEffectHash,
    browser_row_count: 0,
    browser_input_state: "zero" as const,
    browser_target_settled: true,
    target_settlement_hash: providerEffectHash,
    readback_exhaustion_hash: null,
    replay_calls: [],
    rejected_call: null,
    readback_proofs: [],
  };
  const sourceSeal = hashCanonical(sourceBody);
  const beforeHandoffSlots = businessInFlightCount({ active: new Map(), store } as never);
  store.sealSourceHandoff({ ...sourceBody, seal_hash: sourceSeal });
  assert.equal(businessInFlightCount({ active: new Map(), store } as never), beforeHandoffSlots - 1,
    "a sealed old attempt must release its local slot so the same job can obtain a new grant at N=1");
  const fresh = store.acceptTaskAfterSourceHandoff(job, "attempt:2", sourceSeal);
  assert.equal(businessInFlightCount({ active: new Map(), store } as never), beforeHandoffSlots,
    "the Website-authorized new attempt occupies one local slot again");
  assert.equal(fresh.current_attempt_id, "attempt:2");
  assert.equal(fresh.attempt_failure, null);
  assert.equal(fresh.staged_result, null);
  assert.equal(fresh.current_reason, "LEASE_GRANTED");
  assert.equal(store.readOutboxAuthority(artifactKey)?.lastError, "WEBSITE_ATTEMPT_REPLACED");
  await assert.rejects(
    store.deliverOutbox(artifactKey, async () => {
      throw new Error("A_SUPERSEDED_WRITE_MUST_NOT_BE_SENT");
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "WEBSITE_ATTEMPT_REPLACED",
  );
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
    first_fact_raw_hash: sha256(Buffer.from(store.readAttemptFailureRaw(regrantJob.job_id)!, "utf8")),
    outbox_history_hash: replacedOutbox.historyHash,
    outbox_candidate_count: replacedOutbox.candidateCount,
    payload_slot_conflict: null,
    browser_history_hash: providerEffectHash,
    browser_row_count: 0,
    browser_input_state: "zero" as const,
    browser_target_settled: true,
    target_settlement_hash: providerEffectHash,
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
  const negativeObservation = {
    kind: "negative_exact" as const, path: "exact_conversation" as const,
    effect_identity_hash: providerEffectHash,
    source_effect_set_hash: providerEffectHash,
    old_target_ref_hash: providerEffectHash,
    old_document_ref_hash: providerEffectHash,
    wal_authority_hash: providerEffectHash,
    target_ref_hash: providerEffectHash,
    document_ref_hash: providerEffectHash,
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
  assert.throws(() => store.recordSourceReadbackObservation(
    regrantJob.job_id, "attempt:2", {
      ...negativeObservation, kind: "old_instance_unavailable",
      path: "old_target", proof_hash: "not-a-hash",
    } as never,
  ), /PRODUCTION_SOURCE_READBACK_PROOF_INVALID/u,
  "an unauthenticated old-instance fact cannot be persisted");
  assert.equal(store.readSourceReadbackObservations(regrantJob.job_id, "attempt:2").length, 0);

  const inherited = task({ jobId: "job:historical-rejection",
    productId: "payment_screenshot_observation", actionId: "observe" });
  const oldEffect = `sha256:${"a".repeat(64)}` as const;
  const nextEffect = `sha256:${"b".repeat(64)}` as const;
  const rejectedFailure = (attemptId: string, effectIdentityHash: typeof oldEffect) =>
    attemptFailureFirstFact(attemptId, serializeTerminalFailureTransport(executionFailure(
      "failed", "RESULT_SETTLED_UNUSABLE", { metadata: {
        mutationOutcome: "confirmed",
        evidence: { evidenceRef: `browser-mutation:${attemptId}`,
          evidenceHash: providerEffectHash },
        browserEffect: { effectScope: "provider_effect",
          childCapabilityId: "submit_exact_gpt_turn_once", browserOutcome: "CONFIRMED",
          providerEffectIdentityHash: effectIdentityHash },
        settledResultPayloadHash: providerEffectHash,
      } },
    )));
  store.acceptTask(inherited, "attempt:old");
  store.recordAttemptFailure(inherited.job_id, "attempt:old",
    rejectedFailure("attempt:old", oldEffect));
  const oldOutbox = store.readResultOutboxHistoryEvidence(inherited.job_id, "attempt:old");
  const oldCall = { product_step_id: "turn-submit", call_id: "submit-1",
    child_capability_id: "submit_exact_gpt_turn_once", source_effect_set_hash: oldEffect };
  const oldBody = { kind: "attempt_handoff" as const, job_id: inherited.job_id,
    source_attempt_id: "attempt:old", source_task_hash: hashCanonical(inherited),
    first_fact_raw_hash: sha256(Buffer.from(store.readAttemptFailureRaw(inherited.job_id)!, "utf8")),
    outbox_history_hash: oldOutbox.historyHash,
    outbox_candidate_count: oldOutbox.candidateCount,
    payload_slot_conflict: null,
    browser_history_hash: providerEffectHash, browser_row_count: 1,
    browser_input_state: "possible" as const, replay_calls: [oldCall],
    readback_proofs: [], browser_target_settled: true,
    target_settlement_hash: providerEffectHash, readback_exhaustion_hash: null };
  const oldSeal = hashCanonical(oldBody);
  store.sealSourceHandoff({ ...oldBody, seal_hash: oldSeal } as never);
  store.acceptTaskAfterSourceHandoff(inherited, "attempt:new", oldSeal);
  assert.deepEqual(store.readAcceptedSourceSettlements(inherited.job_id).map((item) =>
    [item.kind, item.effectIdentityHash, item.sourceHandoffSealHash]),
  [["rejection_settled", oldEffect, oldSeal]],
  "an accepted old single-call rejection without rejected_call remains readable");

  store.recordAttemptFailure(inherited.job_id, "attempt:new",
    rejectedFailure("attempt:new", nextEffect));
  const newerOutbox = store.readResultOutboxHistoryEvidence(inherited.job_id, "attempt:new");
  const newerCall = { ...oldCall, source_effect_set_hash: nextEffect };
  const newerBody = { ...oldBody, source_attempt_id: "attempt:new",
    first_fact_raw_hash: sha256(Buffer.from(store.readAttemptFailureRaw(inherited.job_id)!, "utf8")),
    outbox_history_hash: newerOutbox.historyHash,
    replay_calls: [newerCall], rejected_call: { ...newerCall,
      effect_identity_hash: nextEffect },
    readback_proofs: [{ ...newerCall, disposition: "historical_settled" as const,
      effects: [{ effect_identity_hash: oldEffect, source_effect_set_hash: oldEffect,
        old_target_ref_hash: oldEffect, old_document_ref_hash: oldEffect,
        wal_authority_hash: providerEffectHash, anchor_state: "trusted" as const,
        anchor_proof_hash: oldEffect, old_path: null, exact_path: null,
        rejection_settled: { source_attempt_id: "attempt:old",
          source_handoff_seal_hash: oldSeal } }] }] };
  const newerSeal = hashCanonical(newerBody);
  store.sealSourceHandoff({ ...newerBody, seal_hash: newerSeal });
  store.acceptTaskAfterSourceHandoff(inherited, "attempt:third", newerSeal);
  assert.deepEqual(store.readAcceptedSourceSettlements(inherited.job_id).map((item) =>
    item.effectIdentityHash).sort(), [oldEffect, nextEffect].sort(),
  "a second rejection of the same call keeps both original effect identities");

  const zeroReuse = task({ jobId: "job:zero-submit-lineage",
    productId: "payment_screenshot_observation", actionId: "observe" });
  store.acceptTask(zeroReuse, "attempt:zero-old");
  const zeroOutbox = store.readResultOutboxHistoryEvidence(zeroReuse.job_id, "attempt:zero-old");
  const checkpointBody = {
    kind: "settled_checkpoint" as const, path: "source_checkpoint" as const,
    effect_identity_hash: oldEffect, source_effect_set_hash: oldEffect,
    old_target_ref_hash: oldEffect, old_document_ref_hash: oldEffect,
    wal_authority_hash: providerEffectHash, provider_input_delta: 0 as const,
    source_attempt_id: "attempt:zero-old", source_result_revision: 0,
    checkpoint_exact_call_identity_hash: oldEffect,
    artifact_ref: "forensics:zero-old", artifact_content_hash: oldEffect,
    submit_prompt_hash: oldEffect, canonical_conversation_hash: oldEffect,
    user_turn_hash: oldEffect,
  };
  const zeroEffect = { effect_identity_hash: oldEffect, source_effect_set_hash: oldEffect,
    old_target_ref_hash: oldEffect, old_document_ref_hash: oldEffect,
    wal_authority_hash: providerEffectHash, anchor_state: "trusted" as const,
    anchor_proof_hash: oldEffect, old_path: null, exact_path: null,
    settled_checkpoint: {
      source_attempt_id: "attempt:zero-old", source_result_revision: 0,
      checkpoint_exact_call_identity_hash: oldEffect,
      artifact_ref: "forensics:zero-old", artifact_content_hash: oldEffect,
      submit_prompt_hash: oldEffect, canonical_conversation_hash: oldEffect,
      user_turn_hash: oldEffect, proof_hash: hashCanonical(checkpointBody),
      observed_at: "2030-01-01T00:00:00.000Z", provider_input_delta: 0 as const,
    } };
  const zeroProof = { ...oldCall, disposition: "settled_reusable" as const,
    effects: [zeroEffect] };
  const zeroConflict = { old_request_id: "old-request", old_payload_hash: oldEffect,
    old_receipt_hash: providerEffectHash, new_request_id: "new-request",
    new_payload_hash: nextEffect };
  const zeroBody = { kind: "delivery_priority_replay" as const,
    job_id: zeroReuse.job_id, source_attempt_id: "attempt:zero-old",
    source_task_hash: hashCanonical(zeroReuse), first_fact_raw_hash: null,
    outbox_history_hash: zeroOutbox.historyHash, outbox_candidate_count: 0,
    payload_slot_conflict: zeroConflict, browser_history_hash: oldEffect,
    browser_row_count: 1, browser_input_state: "possible" as const,
    replay_calls: [oldCall], rejected_call: null, readback_proofs: [zeroProof],
    browser_target_settled: true, target_settlement_hash: oldEffect,
    readback_exhaustion_hash: hashCanonical([]),
  };
  const zeroSeal = hashCanonical(zeroBody);
  store.sealSourceHandoff({ ...zeroBody, seal_hash: zeroSeal });
  store.acceptTaskAfterSourceHandoff(zeroReuse, "attempt:zero-new", zeroSeal);
  const firstZeroSettlements = store.readAcceptedSourceSettlements(zeroReuse.job_id);
  assert.deepEqual(firstZeroSettlements.map((item) => item.kind), ["reused_checkpoint"]);
  assert.equal(historicalEffectsSettled([{ attemptId: "attempt:zero-old",
    effectIdentityHash: oldEffect, sourceEffectSetHash: oldEffect,
    productStepId: oldCall.product_step_id, callId: oldCall.call_id,
    childCapabilityId: oldCall.child_capability_id, authorityRef: "browser:old",
    walAuthorityHash: providerEffectHash }], firstZeroSettlements, "attempt:zero-new"), true,
  "a signed zero-submit grant keeps the old Provider effect settled after a new crash");
  const secondZeroBody = { ...zeroBody, source_attempt_id: "attempt:zero-new",
    browser_input_state: "zero" as const, browser_row_count: 2,
    payload_slot_conflict: { ...zeroConflict, old_request_id: "second-old",
      new_request_id: "second-new" } };
  const secondZeroSeal = hashCanonical(secondZeroBody);
  store.sealSourceHandoff({ ...secondZeroBody, seal_hash: secondZeroSeal });
  store.acceptTaskAfterSourceHandoff(zeroReuse, "attempt:zero-third", secondZeroSeal);
  assert.equal(historicalEffectsSettled([{ attemptId: "attempt:zero-old",
    effectIdentityHash: oldEffect, sourceEffectSetHash: oldEffect,
    productStepId: oldCall.product_step_id, callId: oldCall.call_id,
    childCapabilityId: oldCall.child_capability_id, authorityRef: "browser:old",
    walAuthorityHash: providerEffectHash }], store.readAcceptedSourceSettlements(zeroReuse.job_id),
  "attempt:zero-third"), true, "a second object-slot conflict preserves the same zero-submit lineage");

  const article = task({ jobId: "job:article-three-step-reuse",
    productId: "public_knowledge_article_pipeline", actionId: "produce_article" });
  store.acceptTask(article, "attempt:article-old");
  const articleOutbox = store.readResultOutboxHistoryEvidence(article.job_id, "attempt:article-old");
  const articleSteps = ["corpus_research", "article_synthesis", "article_image_generation"] as const;
  const articleHashes = articleSteps.map((step) => hashCanonical(`provider-effect:${step}`));
  const articleCalls = articleSteps.map((step, index) => ({ product_step_id: step,
    call_id: "turn-submit", child_capability_id: "submit_exact_gpt_turn_once",
    source_effect_set_hash: articleHashes[index]! }));
  const articleProofs = articleCalls.map((call, index) => {
    const effectHash = articleHashes[index]!;
    const settledBody = { ...checkpointBody, effect_identity_hash: effectHash,
      source_effect_set_hash: effectHash, source_attempt_id: "attempt:article-old",
      checkpoint_exact_call_identity_hash: effectHash,
      artifact_ref: `forensics:${articleSteps[index]}` };
    return { ...call, disposition: "settled_reusable" as const, effects: [{
      ...zeroEffect, effect_identity_hash: effectHash, source_effect_set_hash: effectHash,
      settled_checkpoint: { ...zeroEffect.settled_checkpoint,
        source_attempt_id: "attempt:article-old",
        checkpoint_exact_call_identity_hash: effectHash,
        artifact_ref: settledBody.artifact_ref, proof_hash: hashCanonical(settledBody) },
    }] };
  });
  const articleBody = { ...zeroBody, job_id: article.job_id,
    source_attempt_id: "attempt:article-old", source_task_hash: hashCanonical(article),
    outbox_history_hash: articleOutbox.historyHash,
    outbox_candidate_count: articleOutbox.candidateCount,
    browser_row_count: 3, replay_calls: articleCalls, readback_proofs: articleProofs };
  const articleSeal = hashCanonical(articleBody);
  store.sealSourceHandoff({ ...articleBody, seal_hash: articleSeal });
  store.acceptTaskAfterSourceHandoff(article, "attempt:article-new", articleSeal);
  const articleSettlements = store.readAcceptedSourceSettlements(article.job_id);
  assert.deepEqual(articleSettlements.map((item) => item.effectIdentityHash).sort(),
    [...articleHashes].sort(), "all three article source effects must survive the handoff");
  assert.equal(historicalEffectsSettled(articleCalls.map((call, index) => ({
    attemptId: "attempt:article-old", effectIdentityHash: articleHashes[index]!,
    sourceEffectSetHash: call.source_effect_set_hash, productStepId: call.product_step_id,
    callId: call.call_id, childCapabilityId: call.child_capability_id,
    authorityRef: `browser:${articleSteps[index]}`, walAuthorityHash: providerEffectHash,
  })), articleSettlements, "attempt:article-new"), true,
  "the article handoff must settle research, article and image without replaying a Provider call");

  const priorRisk = task({ jobId: "job:historical-risk",
    productId: "payment_screenshot_observation", actionId: "observe" });
  store.acceptTask(priorRisk, "attempt:risk-old");
  store.recordAttemptFailure(priorRisk.job_id, "attempt:risk-old",
    attemptFailureFirstFact("attempt:risk-old", serializeTerminalFailure(
      executionFailure("failed", "SOURCE_RESULT_RECONCILIATION_PENDING"))));
  const riskOutbox = store.readResultOutboxHistoryEvidence(priorRisk.job_id, "attempt:risk-old");
  const riskEffect = { effect_identity_hash: oldEffect, source_effect_set_hash: oldEffect,
    old_target_ref_hash: oldEffect, old_document_ref_hash: oldEffect,
    wal_authority_hash: providerEffectHash, anchor_state: "absent" as const,
    anchor_proof_hash: oldEffect, old_path: { outcome: "instance_unavailable" as const,
      proof_hash: oldEffect, observed_at: "2020-01-01T00:00:00.000Z",
      provider_input_delta: 0 as const, target_ref_hash: oldEffect,
      document_ref_hash: oldEffect }, exact_path: null };
  const riskProof = { ...oldCall, disposition: "replay_exhausted" as const,
    effects: [riskEffect] };
  const riskBody = { ...oldBody, kind: "delivery_priority_replay" as const,
    job_id: priorRisk.job_id, source_attempt_id: "attempt:risk-old",
    source_task_hash: hashCanonical(priorRisk),
    first_fact_raw_hash: sha256(Buffer.from(store.readAttemptFailureRaw(priorRisk.job_id)!, "utf8")),
    outbox_history_hash: riskOutbox.historyHash,
    rejected_call: null, readback_proofs: [riskProof],
    readback_exhaustion_hash: hashCanonical([riskProof]) };
  const riskSeal = hashCanonical(riskBody);
  store.sealSourceHandoff({ ...riskBody, seal_hash: riskSeal });
  store.acceptTaskAfterSourceHandoff(priorRisk, "attempt:risk-new", riskSeal);
  assert.deepEqual(store.readAcceptedSourceSettlements(priorRisk.job_id).map((item) =>
    [item.kind, item.effectIdentityHash, item.sourceHandoffSealHash]),
  [["risk_authorized", oldEffect, riskSeal]],
  "an accepted risk decision remains durable beyond the original observation window");
  store.recordAttemptFailure(priorRisk.job_id, "attempt:risk-new",
    rejectedFailure("attempt:risk-new", nextEffect));
  const riskNewOutbox = store.readResultOutboxHistoryEvidence(
    priorRisk.job_id, "attempt:risk-new");
  const riskNewCall = { ...oldCall, source_effect_set_hash: nextEffect };
  const rejectedAfterRisk = { ...oldBody, job_id: priorRisk.job_id,
    source_attempt_id: "attempt:risk-new", source_task_hash: hashCanonical(priorRisk),
    first_fact_raw_hash: sha256(Buffer.from(store.readAttemptFailureRaw(priorRisk.job_id)!, "utf8")),
    outbox_history_hash: riskNewOutbox.historyHash,
    replay_calls: [riskNewCall], rejected_call: { ...riskNewCall,
      effect_identity_hash: nextEffect },
    readback_proofs: [{ ...riskNewCall, disposition: "historical_settled" as const,
      effects: [{ ...riskEffect, old_path: null, exact_path: null,
        risk_authorized: { source_handoff_seal_hash: riskSeal } }] }] };
  const rejectedAfterRiskSeal = hashCanonical(rejectedAfterRisk);
  store.sealSourceHandoff({ ...rejectedAfterRisk, seal_hash: rejectedAfterRiskSeal });
  store.acceptTaskAfterSourceHandoff(priorRisk, "attempt:zero-current", rejectedAfterRiskSeal);
  const riskThenRejection = store.readAcceptedSourceSettlements(priorRisk.job_id);
  assert.deepEqual(riskThenRejection.map((item) => item.kind).sort(),
    ["rejection_settled", "risk_authorized"],
    "the accepted lineage keeps both the original risk grant and later rejection");
  const historicalEffects = [{ attemptId: "attempt:risk-old",
    effectIdentityHash: oldEffect, sourceEffectSetHash: oldEffect,
    productStepId: oldCall.product_step_id, callId: oldCall.call_id,
    childCapabilityId: oldCall.child_capability_id,
    authorityRef: "browser-mutation:attempt:risk-old", walAuthorityHash: providerEffectHash },
  { attemptId: "attempt:risk-new", effectIdentityHash: nextEffect,
    sourceEffectSetHash: nextEffect, productStepId: oldCall.product_step_id,
    callId: oldCall.call_id, childCapabilityId: oldCall.child_capability_id,
    authorityRef: "browser-mutation:attempt:risk-new", walAuthorityHash: providerEffectHash }];
  assert.equal(historicalEffectsSettled(historicalEffects, riskThenRejection,
    "attempt:zero-current"), true,
  "a zero-input attempt must continue after signed risk and signed rejection");
  assert.equal(historicalEffectsSettled(historicalEffects, riskThenRejection.filter((item) =>
    item.kind !== "risk_authorized"), "attempt:zero-current"), false,
  "missing risk settlement must still block the zero-input handoff");
  store.close();
} finally {
  await rm(directory, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][agent-production-runtime-fresh-attempt] PASS\n");
