import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { acceptClaim } from "../../src/lib/local-runtime/production/runtime-claim-operations.js";
import { ClaimedProductionTaskSchema } from "../../src/lib/local-runtime/production/transport-protocol.js";
import { createRuntimeLogger, requireRuntimeLogWrite } from "../../src/lib/runtime-logs/index.js";
import { historicalEffectsSettled } from "../../src/lib/local-runtime/production/runtime-source-readback-proofs.js";
import { acceptedSourceSettlements, targetlessFirstFactHash } from
  "../../src/lib/local-runtime/production/store-source-settlement.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import {
  serializeTerminalFailure,
  serializeTerminalFailureTransport,
} from "../../src/lib/local-runtime/production/terminal-failure.js";
import { attemptFailureFirstFact, claimTask, task } from "./agent-production-runtime-fixtures.js";
import { verifyPayloadSlotConflict } from "./agent-production-runtime-payload-slot.acceptance-support.js";
import { verifyRecoveryFailureTransport } from "./agent-production-runtime-failure-transport.acceptance-support.js";
import { verifyOutboxRegrantFenceAndReadbackProof, verifyTypedSourceSealAuthority } from
  "./agent-production-runtime-recovery-contract.acceptance-support.js";

const directory = await mkdtemp(path.join(tmpdir(), "agent-fresh-attempt-"));
const terminalQuiescence = (historyHash: `sha256:${string}`,
  calls: readonly { source_effect_set_hash: `sha256:${string}` }[]) => {
  const body = { kind: "terminal_wal" as const, browser_history_hash: historyHash,
    source_effect_set_hash: hashCanonical(calls.map((call) => call.source_effect_set_hash).sort()),
    unresolved_command_set_hash: hashCanonical([]) };
  return { ...body, proof_hash: hashCanonical(body) };
};
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
  const logger = createRuntimeLogger({ producer: "agent-source-seal-negative",
    owner: "production-runtime", component: "production-runtime", terminalEnabled: false,
    fileSink: { directoryPath: path.join(directory, "source-seal-logs") } });
  await verifyTypedSourceSealAuthority({ store, directory, job, firstFailure,
    providerEffectHash, logger });
  assert.equal(store.readOutboxAuthority(artifactKey)?.lastError, "WEBSITE_ATTEMPT_REPLACED");
  await assert.rejects(
    store.deliverOutbox(artifactKey, async () => {
      throw new Error("A_SUPERSEDED_WRITE_MUST_NOT_BE_SENT");
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "WEBSITE_ATTEMPT_REPLACED",
  );
  await verifyOutboxRegrantFenceAndReadbackProof(store, providerEffectHash);

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
    first_fact_raw_hash: targetlessFirstFactHash(store.readAttemptFailureRaw(inherited.job_id)),
    outbox_history_hash: oldOutbox.historyHash,
    outbox_candidate_count: oldOutbox.candidateCount,
    payload_slot_conflict: null,
    browser_history_hash: providerEffectHash, browser_row_count: 1,
    browser_input_state: "possible" as const, replay_calls: [oldCall],
    rejected_call: { ...oldCall, effect_identity_hash: oldEffect },
    readback_proofs: [], input_quiescence_proof: terminalQuiescence(providerEffectHash, [oldCall]),
    readback_exhaustion_hash: null };
  const oldSeal = hashCanonical(oldBody);
  const unquietOldBody = { ...oldBody, input_quiescence_proof: null };
  assert.throws(() => store.sealSourceHandoff({ ...unquietOldBody,
    seal_hash: hashCanonical(unquietOldBody) } as never), /PRODUCTION_SOURCE_HANDOFF_CONFLICT/u,
  "a possible-input V44 source requires terminal WAL quiescence");
  store.sealSourceHandoff({ ...oldBody, seal_hash: oldSeal } as never);
  const oldManifest = JSON.stringify({ ...oldBody, seal_hash: oldSeal });
  const v43Body = { ...oldBody, old_path: "instance_unavailable" };
  const v43Seal = hashCanonical(v43Body);
  const v43Manifest = JSON.stringify({ ...v43Body, seal_hash: v43Seal });
  const sourceDatabase = new Database(path.join(directory, "production-runtime.sqlite"));
  const setSourceManifest = (seal: string, manifest: string, reason: string): void => {
    sourceDatabase.transaction(() => {
      sourceDatabase.prepare(`update production_attempt_handoffs
        set seal_hash=?,source_manifest_json=? where job_id=? and source_attempt_id=?`).run(
        seal, manifest, inherited.job_id, "attempt:old");
      sourceDatabase.prepare("update production_tasks set current_reason=? where job_id=?").run(
        reason, inherited.job_id);
    })();
  };
  try {
    setSourceManifest(v43Seal, v43Manifest, `SOURCE_HANDOFF_SEALED|${v43Seal}`);
    assert.throws(() => store.acceptTaskAfterSourceHandoff(inherited, "attempt:new", v43Seal),
      /PRODUCTION_SOURCE_HANDOFF_CONFLICT/u,
      "an exact-seal V43 source must not issue a V44 attempt");
  } finally {
    setSourceManifest(oldSeal, oldManifest, `SOURCE_HANDOFF_SEALED|${oldSeal}`);
  }
  store.acceptTaskAfterSourceHandoff(inherited, "attempt:new", oldSeal);
  try {
    setSourceManifest(v43Seal, v43Manifest, "LEASE_GRANTED");
    assert.throws(() => store.readIssuedSourceHandoff(
      inherited.job_id, "attempt:new", v43Seal), /PRODUCTION_SOURCE_HANDOFF_CONFLICT/u,
    "an exact-seal V43 source must not enter V44 claim recovery");
  } finally {
    setSourceManifest(oldSeal, oldManifest, "LEASE_GRANTED");
    sourceDatabase.close();
  }
  assert.deepEqual(store.readAcceptedSourceSettlements(inherited.job_id).map((item) =>
    [item.kind, item.effectIdentityHash, item.sourceHandoffSealHash]),
  [["rejection_settled", oldEffect, oldSeal]],
  "an accepted single-call rejection remains readable");

  store.recordAttemptFailure(inherited.job_id, "attempt:new",
    rejectedFailure("attempt:new", nextEffect));
  const newerOutbox = store.readResultOutboxHistoryEvidence(inherited.job_id, "attempt:new");
  const newerCall = { ...oldCall, source_effect_set_hash: nextEffect };
  const newerBody = { ...oldBody, source_attempt_id: "attempt:new",
    first_fact_raw_hash: targetlessFirstFactHash(store.readAttemptFailureRaw(inherited.job_id)),
    outbox_history_hash: newerOutbox.historyHash,
    replay_calls: [newerCall], rejected_call: { ...newerCall,
      effect_identity_hash: nextEffect },
    input_quiescence_proof: terminalQuiescence(providerEffectHash, [newerCall]),
    readback_proofs: [{ ...newerCall, disposition: "historical_settled" as const,
      effects: [{ effect_identity_hash: oldEffect, source_effect_set_hash: oldEffect,
        wal_authority_hash: providerEffectHash, anchor_state: "trusted" as const,
        anchor_proof_hash: oldEffect,
        rejection_settled: { source_attempt_id: "attempt:old",
          source_handoff_seal_hash: oldSeal } }] }] };
  const newerSeal = hashCanonical(newerBody);
  store.sealSourceHandoff({ ...newerBody, seal_hash: newerSeal } as never);
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
    wal_authority_hash: providerEffectHash, provider_input_delta: 0 as const,
    source_attempt_id: "attempt:zero-old", source_result_revision: 0,
    checkpoint_exact_call_identity_hash: oldEffect,
    artifact_ref: "forensics:zero-old", artifact_content_hash: oldEffect,
    submit_prompt_hash: oldEffect, canonical_conversation_hash: oldEffect,
    user_turn_hash: oldEffect,
  };
  const zeroEffect = { effect_identity_hash: oldEffect, source_effect_set_hash: oldEffect,
    wal_authority_hash: providerEffectHash, anchor_state: "trusted" as const,
    anchor_proof_hash: oldEffect,
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
    input_quiescence_proof: terminalQuiescence(oldEffect, [oldCall]),
    readback_exhaustion_hash: hashCanonical([]),
  };
  const zeroSeal = hashCanonical(zeroBody);
  store.sealSourceHandoff({ ...zeroBody, seal_hash: zeroSeal } as never);
  store.acceptTaskAfterSourceHandoff(zeroReuse, "attempt:zero-new", zeroSeal);
  const firstZeroSettlements = store.readAcceptedSourceSettlements(zeroReuse.job_id);
  assert.deepEqual(firstZeroSettlements.map((item) => item.kind), ["reused_checkpoint"]);
  assert.equal(historicalEffectsSettled([{ attemptId: "attempt:zero-old",
    effectIdentityHash: oldEffect, sourceEffectSetHash: oldEffect,
    productStepId: oldCall.product_step_id, callId: oldCall.call_id,
    childCapabilityId: oldCall.child_capability_id, authorityRef: "browser:old",
    walAuthorityHash: providerEffectHash, rawWalAuthorityHash: providerEffectHash,
    anchorProofHash: oldEffect,
    anchorState: "trusted" }], firstZeroSettlements, "attempt:zero-new"), true,
  "a signed zero-submit grant keeps the old Provider effect settled after a new crash");
  const secondZeroBody = { ...zeroBody, source_attempt_id: "attempt:zero-new",
    browser_input_state: "zero" as const, browser_row_count: 2,
    input_quiescence_proof: null,
    payload_slot_conflict: { ...zeroConflict, old_request_id: "second-old",
      new_request_id: "second-new" } };
  const secondZeroSeal = hashCanonical(secondZeroBody);
  store.sealSourceHandoff({ ...secondZeroBody, seal_hash: secondZeroSeal } as never);
  store.acceptTaskAfterSourceHandoff(zeroReuse, "attempt:zero-third", secondZeroSeal);
  assert.equal(historicalEffectsSettled([{ attemptId: "attempt:zero-old",
    effectIdentityHash: oldEffect, sourceEffectSetHash: oldEffect,
    productStepId: oldCall.product_step_id, callId: oldCall.call_id,
    childCapabilityId: oldCall.child_capability_id, authorityRef: "browser:old",
    walAuthorityHash: providerEffectHash, rawWalAuthorityHash: providerEffectHash,
    anchorProofHash: oldEffect,
    anchorState: "trusted" }], store.readAcceptedSourceSettlements(zeroReuse.job_id),
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
    browser_row_count: 3, replay_calls: articleCalls, readback_proofs: articleProofs,
    input_quiescence_proof: terminalQuiescence(oldEffect, articleCalls) };
  const articleSeal = hashCanonical(articleBody);
  store.sealSourceHandoff({ ...articleBody, seal_hash: articleSeal } as never);
  store.acceptTaskAfterSourceHandoff(article, "attempt:article-new", articleSeal);
  const articleSettlements = store.readAcceptedSourceSettlements(article.job_id);
  assert.deepEqual(articleSettlements.map((item) => item.effectIdentityHash).sort(),
    [...articleHashes].sort(), "all three article source effects must survive the handoff");
  assert.equal(historicalEffectsSettled(articleCalls.map((call, index) => ({
    attemptId: "attempt:article-old", effectIdentityHash: articleHashes[index]!,
    sourceEffectSetHash: call.source_effect_set_hash, productStepId: call.product_step_id,
    callId: call.call_id, childCapabilityId: call.child_capability_id,
    authorityRef: `browser:${articleSteps[index]}`, walAuthorityHash: providerEffectHash,
    rawWalAuthorityHash: providerEffectHash, anchorProofHash: oldEffect,
    rawAnchorProofHash: oldEffect, anchorState: "trusted" as const,
  })), articleSettlements, "attempt:article-new"), true,
  "the article handoff must settle research, article and image without replaying a Provider call");

  const rejectedArticleFailure = JSON.stringify(rejectedFailure(
    "attempt:article-old", articleHashes[2]!));
  const rejectedArticleBody = { ...articleBody, kind: "attempt_handoff" as const,
    first_fact_raw_hash: targetlessFirstFactHash(rejectedArticleFailure),
    payload_slot_conflict: null, readback_exhaustion_hash: null,
    rejected_call: { ...articleCalls[2]!, effect_identity_hash: articleHashes[2]! },
    readback_proofs: articleProofs.slice(0, 2) };
  const rejectedArticleSeal = hashCanonical(rejectedArticleBody);
  const rejectedArticleSettlements = acceptedSourceSettlements([{
    source_attempt_id: "attempt:article-old", issued_attempt_id: "attempt:article-new",
    seal_hash: rejectedArticleSeal,
    source_manifest_json: JSON.stringify({ ...rejectedArticleBody, seal_hash: rejectedArticleSeal }),
    first_fact_raw: rejectedArticleFailure,
  }], "attempt:article-new", article.job_id);
  assert.deepEqual(rejectedArticleSettlements.map((item) =>
    [item.kind, item.effectIdentityHash]).sort((a, b) => a[1]!.localeCompare(b[1]!)),
  articleHashes.map((effect, index) => [index === 2 ? "rejection_settled" : "reused_checkpoint",
    effect]).sort((a, b) => a[1]!.localeCompare(b[1]!)),
  "a signed rejected image handoff keeps its two accepted text checkpoints settled");

  const priorRisk = task({ jobId: "job:historical-risk",
    productId: "payment_screenshot_observation", actionId: "observe" });
  store.acceptTask(priorRisk, "attempt:risk-old");
  store.recordAttemptFailure(priorRisk.job_id, "attempt:risk-old",
    attemptFailureFirstFact("attempt:risk-old", serializeTerminalFailure(
      executionFailure("failed", "SOURCE_RESULT_RECONCILIATION_PENDING"))));
  const riskOutbox = store.readResultOutboxHistoryEvidence(priorRisk.job_id, "attempt:risk-old");
  const riskEffect = { effect_identity_hash: oldEffect, source_effect_set_hash: oldEffect,
    wal_authority_hash: providerEffectHash, anchor_state: "absent" as const,
    anchor_proof_hash: oldEffect, unaddressable: {
      proof_hash: hashCanonical({ effect_identity_hash: oldEffect,
        source_effect_set_hash: oldEffect, wal_authority_hash: providerEffectHash,
        anchor_state: "absent", anchor_proof_hash: oldEffect,
        observed_at: "2020-01-01T00:00:00.000Z", provider_input_delta: 0 }),
      observed_at: "2020-01-01T00:00:00.000Z", provider_input_delta: 0 as const } };
  const riskProof = { ...oldCall, disposition: "replay_exhausted" as const,
    effects: [riskEffect] };
  const riskBody = { ...oldBody, kind: "delivery_priority_replay" as const,
    job_id: priorRisk.job_id, source_attempt_id: "attempt:risk-old",
    source_task_hash: hashCanonical(priorRisk),
    first_fact_raw_hash: targetlessFirstFactHash(store.readAttemptFailureRaw(priorRisk.job_id)),
    outbox_history_hash: riskOutbox.historyHash,
    rejected_call: null, readback_proofs: [riskProof],
    input_quiescence_proof: terminalQuiescence(providerEffectHash, [oldCall]),
    readback_exhaustion_hash: hashCanonical([riskProof]) };
  const riskSeal = hashCanonical(riskBody);
  store.sealSourceHandoff({ ...riskBody, seal_hash: riskSeal } as never);
  store.acceptTaskAfterSourceHandoff(priorRisk, "attempt:risk-new", riskSeal);
  assert.equal(store.readIssuedSourceHandoff(
    priorRisk.job_id, "attempt:risk-new", riskSeal)?.seal_hash, riskSeal);
  const replayGrantBase = { source_seal_hash: riskSeal, source_attempt_id: "attempt:risk-old",
    result_revision: 1 };
  const replayCall = { ...oldCall, call_grant_hash: hashCanonical({ job_id: priorRisk.job_id,
    attempt_id: "attempt:risk-new", ...replayGrantBase, ...oldCall }) };
  const replayGrantBody = { ...replayGrantBase, calls: [replayCall] };
  const replayGrant = { ...replayGrantBody, grant_hash: hashCanonical({
    job_id: priorRisk.job_id, attempt_id: "attempt:risk-new", ...replayGrantBody }) };
  const replayClaimBase = claimTask(priorRisk);
  const replayClaim = ClaimedProductionTaskSchema.parse({ ...replayClaimBase,
    grant: { ...replayClaimBase.grant, attempt_id: "attempt:risk-new",
      same_accepted_attempt: true, source_handoff_seal_hash: riskSeal,
      result_revision: 1, delivery_priority_replay_grant: replayGrant,
      execution_fence: { ...replayClaimBase.grant.execution_fence,
        attempt_id: "attempt:risk-new" } } });
  const replaySpan = requireRuntimeLogWrite(logger.startSpan({ traceId: priorRisk.job_id,
    owner: "production-runtime", component: "production-runtime", operation: "job.execute",
    typedIdentity: { kind: "lease", jobId: priorRisk.job_id,
      attemptId: "attempt:risk-new", leaseVersion: replayClaim.grant.lease_version,
      fenceHash: replayClaim.grant.execution_fence.fence_hash } }));
  let replayAccepts = 0;
  const replayAccepted = acceptClaim({ store, runtimeLogger: logger,
    executor: { accept: () => { replayAccepts++;
      return store.acceptTask(priorRisk, "attempt:risk-new"); },
      acceptAfterSourceHandoff: () => { throw new Error("ISSUED_ATTEMPT_REGRANT_MUST_NOT_ROTATE"); } },
  } as never, replayClaim, new AbortController(), replaySpan, null, null);
  assert.equal(replayAccepted.record.current_attempt_id, "attempt:risk-new");
  assert.equal(replayAccepts, 1,
    "same accepted replay attempt must regrant against the issued typed seal without rotation");
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
    first_fact_raw_hash: targetlessFirstFactHash(store.readAttemptFailureRaw(priorRisk.job_id)),
    outbox_history_hash: riskNewOutbox.historyHash,
    replay_calls: [riskNewCall], rejected_call: { ...riskNewCall,
      effect_identity_hash: nextEffect },
    input_quiescence_proof: terminalQuiescence(providerEffectHash, [riskNewCall]),
    readback_proofs: [{ ...riskNewCall, disposition: "historical_settled" as const,
      effects: [{ effect_identity_hash: oldEffect, source_effect_set_hash: oldEffect,
        wal_authority_hash: providerEffectHash, anchor_state: "absent" as const,
        anchor_proof_hash: oldEffect,
        risk_authorized: { source_handoff_seal_hash: riskSeal } }] }] };
  const rejectedAfterRiskSeal = hashCanonical(rejectedAfterRisk);
  store.sealSourceHandoff({ ...rejectedAfterRisk, seal_hash: rejectedAfterRiskSeal } as never);
  store.acceptTaskAfterSourceHandoff(priorRisk, "attempt:zero-current", rejectedAfterRiskSeal);
  const riskThenRejection = store.readAcceptedSourceSettlements(priorRisk.job_id);
  assert.deepEqual(riskThenRejection.map((item) => item.kind).sort(),
    ["rejection_settled", "risk_authorized"],
    "the accepted lineage keeps both the original risk grant and later rejection");
  const historicalEffects = [{ attemptId: "attempt:risk-old",
    effectIdentityHash: oldEffect, sourceEffectSetHash: oldEffect,
    productStepId: oldCall.product_step_id, callId: oldCall.call_id,
    childCapabilityId: oldCall.child_capability_id,
    authorityRef: "browser-mutation:attempt:risk-old", walAuthorityHash: providerEffectHash,
    rawWalAuthorityHash: providerEffectHash, anchorProofHash: oldEffect,
    rawAnchorProofHash: oldEffect, anchorState: "absent" as const },
  { attemptId: "attempt:risk-new", effectIdentityHash: nextEffect,
    sourceEffectSetHash: nextEffect, productStepId: oldCall.product_step_id,
    callId: oldCall.call_id, childCapabilityId: oldCall.child_capability_id,
    authorityRef: "browser-mutation:attempt:risk-new", walAuthorityHash: providerEffectHash,
    rawWalAuthorityHash: providerEffectHash, anchorProofHash: oldEffect,
    rawAnchorProofHash: oldEffect, anchorState: "trusted" as const }];
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
