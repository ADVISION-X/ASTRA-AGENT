import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { hashCanonical, sha256 } from "../../src/lib/local-runtime/production/contracts.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { task, claimTask, failureStatus, attemptFailureFirstFact, resultFor } from "./agent-production-runtime-fixtures.js";
import Database from "better-sqlite3";
import { readContinuationSources, recordSourceCheckpoint } from "../../src/lib/local-runtime/production/executor-source-checkpoint.js";
import { productionRoutePolicies } from "../../src/lib/local-runtime/production/route-policy.js";
import type { WorkbenchBrowserAuthority } from "../../src/lib/local-runtime/workbench-browser-authority-support.js";
import { buildProductionLeaseRelease } from "../../src/lib/local-runtime/production/cloud-client.js";
import { serializeTerminalFailure, type SerializedTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { ClaimedProductionTaskSchema, ControlIntentSchema } from "../../src/lib/local-runtime/production/transport-protocol.js";
import type { RemoteProductionDeviceJobStatus } from "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import { executionFailure } from "../../src/lib/execution-failure.js";
import { prepareSourceHandoffs } from "../../src/lib/local-runtime/production/runtime-source-handoff.js";
import { reconcileClaimAttemptFailure } from "../../src/lib/local-runtime/production/runtime-claim-recovery.js";
import { sourceReadbackProofs } from "../../src/lib/local-runtime/production/runtime-source-readback-proofs.js";
import { validSourceReadbackObservation } from "../../src/lib/local-runtime/production/store-source-settlement.js";

const verifyParentSourceAdmission = async (input: Parameters<typeof readContinuationSources>[0],
  result: ReturnType<typeof resultFor>, complete: (result: unknown) => void,
): Promise<void> => {
  await assert.rejects(readContinuationSources(input), /PRODUCTION_PARENT_RESULT_BINDING_INVALID/u);
  complete(result);
  const sources = await readContinuationSources(input);
  assert.equal(sources?.sources[0]?.productStepId, "original-parent-step");
  assert.equal(sources?.sources[0]?.sourceAttemptId, "original-parent-attempt");
  for (const wrong of [{ parent_task_ref: "absent" }, { parent_result_ref: "wrong" }, { parent_result_hash: hashCanonical("wrong") }])
    await assert.rejects(readContinuationSources({ ...input, task: { ...input.task, ...wrong } }), /PRODUCTION_PARENT_RESULT_BINDING/u);
  for (const route of productionRoutePolicies.filter(value => value.relation_kind !== "provider_continuation"))
    assert.equal(await readContinuationSources({ ...input, task: {}, relationKind: route.relation_kind }), null);
};

export const verifyContinuationSourceBinding = async (dataDir: string): Promise<void> => {
  const store = new ProductionRuntimeStore(dataDir), database = Reflect.get(store, "database") as Database.Database;
  const parent = task({ jobId: "completed-parent", productId: "localization_static_catalog", actionId: "produce_locale_catalog" });
  const attempt = "original-parent-attempt", url = "https://chatgpt.com/c/parent-source", user = "parent-user";
  store.acceptTask(parent, attempt);
  const h = hashCanonical("effect"), wal = hashCanonical("wal"), artifact = "forensics:parent-text";
  const effect = { attemptId: attempt, resultRevision: 0, productStepId: "original-parent-step", callId: "turn-submit",
    childCapabilityId: "submit_exact_gpt_turn_once", effectIdentityHash: h, sourceEffectSetHash: h, authorityRef: "browser:parent",
    walAuthorityHash: wal, rawWalAuthorityHash: wal, rawAnchorProofHash: h, anchorProofHash: h, anchorState: "trusted" as const,
    canonicalConversationHash: sha256(Buffer.from(url)), userTurnHash: sha256(Buffer.from(user)),
    state: "CONFIRMED" as const, mutationOutcome: "confirmed" as const, physicalInputCount: 1 };
  const history = { historyHash: h, rowCount: 1, walHistoryVerified: true, unresolvedCommandSetHash: hashCanonical([]),
    unresolvedCommandCount: 0, replayCalls: [], replayEffects: [effect] };
  const authority = { readJobBrowserHistoryEvidence: () => history };
  recordSourceCheckpoint({ store, browserAuthority: authority as never, jobId: parent.job_id, attemptId: attempt,
    checkpoint: { providerEffectIdentityHash: h, browserAuthorityHash: wal, browserAuthorityRef: `browser-source:${h}`,
      sourceAttemptId: attempt, sourceResultRevision: 0, checkpointExactCallIdentityHash: h, artifactRef: artifact,
      artifactContentHash: h, submitPromptHash: h, canonicalConversationUrl: url, userTurnId: user } });
  const result = { ...resultFor(parent), evidence_refs: [artifact] };
  const complete = (value: unknown, status = "completed") => database.prepare("update production_tasks set status=?,result_json=?,staged_result_json=null,current_reason=null where job_id=?")
    .run(status, JSON.stringify(value), parent.job_id);
  const relation = { parent_task_ref: parent.job_id, parent_result_ref: result.result_payload_ref, parent_result_hash: result.result_payload_hash };
  let metadataReads = 0;
  const input = { store, browserAuthority: authority as never, task: relation, relationKind: "provider_continuation" as const,
    signal: new AbortController().signal, readAdoptedImageReference: async () => { metadataReads++; return "forensics:original-image"; } };
  try {
    await verifyParentSourceAdmission(input, result, complete); assert.equal(metadataReads, 0);
    const observations = store.readSourceReadbackObservations(parent.job_id, attempt), observation = observations[0]!;
    const writeObservations = (value: unknown) => database.prepare("update production_attempt_handoffs set readback_observations_json=? where job_id=? and source_attempt_id=?")
      .run(JSON.stringify(value), parent.job_id, attempt);
    writeObservations([observation, { ...observation, observed_at: "2030-01-01T00:00:00.000Z" }]);
    assert.equal((await readContinuationSources(input))?.sources.length, 1);
    writeObservations([]); await assert.rejects(readContinuationSources(input), /PRODUCTION_PARENT_SOURCE_EVIDENCE_MISSING/u);
    for (const key of ["proof_hash", "source_attempt_id", "source_result_revision", "effect_identity_hash", "wal_authority_hash",
      "source_effect_set_hash", "canonical_conversation_hash", "user_turn_hash", "artifact_content_hash", "checkpoint_exact_call_identity_hash"]) {
      writeObservations([{ ...observation, [key]: key === "source_result_revision" ? 9 : hashCanonical("wrong") }]);
      await assert.rejects(readContinuationSources(input), /PRODUCTION_SOURCE_/u);
    }
    writeObservations(observations); complete({ ...result, evidence_refs: [artifact, "missing-adoption"] });
    await assert.rejects(readContinuationSources(input), /PRODUCTION_PARENT_SOURCE_EVIDENCE_MISSING/u);
    complete({ ...result, evidence_refs: ["forensics:original-image"] });
    assert.equal((await readContinuationSources(input))?.sources.length, 1); assert.equal(metadataReads, 1);
    const cancelled = new AbortController(); cancelled.abort("PRODUCTION_EXECUTION_ABORTED");
    await assert.rejects(readContinuationSources({ ...input, signal: cancelled.signal }), /PRODUCTION_EXECUTION_ABORTED/u);
    complete(result); const originalRead = authority.readJobBrowserHistoryEvidence;
    const ioFailure = new Error("WAL_IO_FAILURE"); authority.readJobBrowserHistoryEvidence = () => { throw ioFailure; };
    await assert.rejects(readContinuationSources(input), error => error === ioFailure); authority.readJobBrowserHistoryEvidence = originalRead;
    assert.equal((await readContinuationSources({ ...input, readAdoptedImageReference: async () => {
      throw new Error("MUST_NOT_READ_PARENT_TEXT"); } }))?.sources.length, 1);
    await verifyMixedParentAdoption(input, result, history, url, user);
  } finally { store.close(); }
};

const verifyMixedParentAdoption = async (input: Parameters<typeof readContinuationSources>[0],
  result: ReturnType<typeof resultFor>,
  history: ReturnType<WorkbenchBrowserAuthority["readJobBrowserHistoryEvidence"]>, url: string, user: string,
): Promise<void> => {
  const jobId = result.job_id, attempt = history.replayEffects[0]!.attemptId;
  const database = Reflect.get(input.store, "database") as Database.Database;
  database.prepare("update production_tasks set status='failed',result_json=null,current_reason='EXECUTING' where job_id=?").run(jobId);
  const additions = [1, 2].map(index => ({ ...history.replayEffects[0]!, productStepId: `parent-step-${index}`,
    effectIdentityHash: hashCanonical(`effect-${index}`), sourceEffectSetHash: hashCanonical(`effect-${index}`),
    userTurnHash: sha256(Buffer.from(`${user}:${index}`)) }));
  const mixedHistory = { ...history, replayEffects: [...history.replayEffects, ...additions] };
  const authority = { ...input.browserAuthority, readJobBrowserHistoryEvidence: () => mixedHistory };
  for (const [index, effect] of additions.entries()) recordSourceCheckpoint({ store: input.store, browserAuthority: authority,
    jobId, attemptId: attempt, checkpoint: { providerEffectIdentityHash: effect.effectIdentityHash,
      browserAuthorityRef: `browser-source:${effect.effectIdentityHash}`, browserAuthorityHash: effect.walAuthorityHash,
      sourceAttemptId: attempt, sourceResultRevision: 0, checkpointExactCallIdentityHash: effect.effectIdentityHash,
      artifactRef: index === 0 ? "forensics:article-text" : "forensics:image-descriptor",
      artifactContentHash: effect.effectIdentityHash, submitPromptHash: effect.effectIdentityHash,
      canonicalConversationUrl: url, userTurnId: `${user}:${index + 1}` } });
  const complete = (refs: readonly string[]) => database.prepare("update production_tasks set status='completed',result_json=?,current_reason=null where job_id=?")
    .run(JSON.stringify({ ...result, evidence_refs: refs }), jobId);
  const refs = [...result.evidence_refs, "forensics:article-text", "forensics:image-original"];
  complete(refs); let metadataReads = 0;
  const mixed = { ...input, browserAuthority: authority, readAdoptedImageReference: async (query: Parameters<typeof input.readAdoptedImageReference>[0]) => {
    metadataReads++; assert.deepEqual(query, { jobId, sourceAttemptId: attempt,
      checkpointExactCallIdentityHash: additions[1]!.effectIdentityHash, artifactRef: "forensics:image-descriptor",
      artifactContentHash: additions[1]!.effectIdentityHash, canonicalConversationHash: additions[1]!.canonicalConversationHash,
      userTurnHash: additions[1]!.userTurnHash }); return "forensics:image-original"; } };
  assert.equal((await readContinuationSources(mixed))?.sources.length, 3); assert.equal(metadataReads, 1);
  complete(refs.slice(0, 2)); await assert.rejects(readContinuationSources(mixed), /PRODUCTION_PARENT_RESULT_BINDING_INVALID/u);
  complete(refs);
  await assert.rejects(readContinuationSources({ ...mixed, readAdoptedImageReference: async () => "wrong-original-ref" }), /PRODUCTION_PARENT_RESULT_BINDING_INVALID/u);
  const ioFailure = new Error("FORENSICS_IO_FAILURE");
  await assert.rejects(readContinuationSources({ ...mixed, readAdoptedImageReference: async () => { throw ioFailure; } }), error => error === ioFailure);
  const cancelled = new AbortController();
  await assert.rejects(readContinuationSources({ ...mixed, signal: cancelled.signal,
    readAdoptedImageReference: async () => { cancelled.abort("PRODUCTION_EXECUTION_ABORTED"); return "forensics:image-original"; } }), /PRODUCTION_EXECUTION_ABORTED/u);
  await assert.rejects(readContinuationSources({ ...mixed, readAdoptedImageReference: async () => {
    database.prepare("delete from production_tasks where job_id=?").run(jobId); return "forensics:image-original";
  } }), /PRODUCTION_PARENT_RESULT_BINDING_INVALID/u);
};

export const riskRecoveryFixture = () => {
  const base = task({ jobId: "job:zero-risk-regrant", productId: "payment_screenshot_observation", actionId: "observe" });
  const job = claimTask(base);
  const seal = hashCanonical("signed-source");
  const callIdentity = { product_step_id: "observe", call_id: "turn-submit", child_capability_id: "submit_exact_gpt_turn_once",
    source_effect_set_hash: hashCanonical("effect-set") };
  const replayIdentity = { source_seal_hash: seal, source_attempt_id: "attempt:prior", result_revision: 6 };
  const call = { ...callIdentity, call_grant_hash: hashCanonical({ job_id: job.job_id,
    attempt_id: job.grant.attempt_id, ...replayIdentity, ...callIdentity }) };
  const replayBody = { ...replayIdentity, calls: [call] };
  const grant = { ...job.grant, result_revision: 6, source_handoff_seal_hash: seal,
    same_accepted_attempt: true, delivery_priority_replay_grant: { ...replayBody,
      grant_hash: hashCanonical({ job_id: job.job_id, attempt_id: job.grant.attempt_id, ...replayBody }) } };
  const claimed = ClaimedProductionTaskSchema.parse({ ...job, grant });
  const session = { workerSessionId: job.grant.worker_session_id, workerSessionEpoch: job.grant.worker_session_epoch };
  const core: SerializedTerminalFailure = { ...serializeTerminalFailure(executionFailure("failed", "BROWSER_TARGET_INVALID")),
    provider_effect_identity_hash: null, settled_result_payload_hash: null };
  const failure = { failure_core: core, release_descriptor: buildProductionLeaseRelease(session, claimed, {
    reasonCode: "ATTEMPT_FAILED", attemptFailure: core }).descriptor };
  const effects = Array.from({ length: 6 }, (_, index) => ({ attemptId: `attempt:old-${index}`, resultRevision: index,
    state: "REJECTED" as const, mutationOutcome: "confirmed" as const, physicalInputCount: 1,
    productStepId: call.product_step_id, callId: call.call_id, childCapabilityId: call.child_capability_id,
    sourceEffectSetHash: call.source_effect_set_hash, effectIdentityHash: hashCanonical(`effect:${index}`),
    authorityRef: `browser:${index}`, walAuthorityHash: hashCanonical(`wal:${index}`),
    rawWalAuthorityHash: hashCanonical(`wal:${index}`), anchorState: "absent" as const,
    rawAnchorProofHash: hashCanonical(`anchor:${index}`), canonicalConversationHash: null, userTurnHash: null,
    anchorProofHash: hashCanonical(`anchor:${index}`) }));
  const history = { historyHash: hashCanonical(effects), rowCount: 42, walHistoryVerified: true,
    unresolvedCommandCount: 0, unresolvedCommandSetHash: hashCanonical([]), replayCalls: [], replayEffects: effects };
  const settlements = effects.map(effect => ({ kind: "risk_authorized" as const,
    effectIdentityHash: effect.effectIdentityHash, sourceEffectSetHash: effect.sourceEffectSetHash,
    productStepId: effect.productStepId, callId: effect.callId, childCapabilityId: effect.childCapabilityId,
    sourceAnchorState: effect.anchorState, sourceWalAuthorityHash: effect.walAuthorityHash,
    sourceAnchorProofHash: effect.anchorProofHash, sourceHandoffSealHash: seal }));
  const remoteFor = (current: SerializedTerminalFailure): RemoteProductionDeviceJobStatus => {
    const attempt_failure = { ...current, attempt_id: grant.attempt_id,
      lease_version: grant.lease_version, from_status: "failed", to_status: "failed" };
    const raw = failureStatus(job.job_id, attempt_failure, []);
    return { ...raw, attempt_failure, control_intent: ControlIntentSchema.parse(raw.control_intent),
      next_action_code: "ACTIVE_ATTEMPT", write_receipts: [] };
  };
  return { base, claimed, session, failure, history, settlements, remote: remoteFor(core), remoteFor, seal };
};

const verifyChangedRiskSourceReadback = async (): Promise<void> => {
  const fixture = riskRecoveryFixture(), { claimed, history, settlements, seal } = fixture;
  const authorized = claimed.grant.delivery_priority_replay_grant!.calls[0]!;
  const call = { productStepId: authorized.product_step_id, callId: authorized.call_id,
    childCapabilityId: authorized.child_capability_id, sourceEffectSetHash: authorized.source_effect_set_hash };
  const old = { ...history, replayCalls: [call] };
  const proofs = sourceReadbackProofs(old as never, [], settlements)!;
  const effect = { ...old.replayEffects[0]!, state: "CONFIRMED", anchorState: "trusted",
    walAuthorityHash: hashCanonical("late-confirmed-wal"), canonicalConversationHash: hashCanonical("conversation"),
    userTurnHash: hashCanonical("turn") };
  let input: "zero" | "possible" = "zero", verified = true, observed = [] as unknown[];
  const current = { ...old, historyHash: hashCanonical(effect), replayEffects: [effect],
    unresolvedCommandCount: 1, unresolvedCommandSetHash: hashCanonical(["historical-local-command"]) };
  const state = { session: fixture.session, store: {
    readTask: () => ({ task: fixture.base, status: "failed", current_attempt_id: claimed.grant.attempt_id,
      attempt_failure: null }), readAttemptFailureRaw: () => null,
    readIssuedSourceHandoff: () => ({ kind: "delivery_priority_replay", source_attempt_id: "attempt:prior",
      browser_history_hash: old.historyHash, seal_hash: seal, readback_proofs: proofs }),
    readSourceReadbackObservations: () => observed, readAcceptedSourceSettlements: () => settlements,
  }, browserAuthority: { readAttemptPhysicalInputState: () => input,
    readJobBrowserHistoryEvidence: () => ({ ...current, walHistoryVerified: verified }) } } as never;
  const remote = { ...fixture.remote, attempt_failure: null };
  const run = () => reconcileClaimAttemptFailure(state, claimed, remote, "parent", async () => {
    throw new Error("READBACK_MUST_NOT_RELEASE_OR_RESUBMIT");
  });
  const result = await run();
  assert.deepEqual(result.readbackOnlyCalls, [{ productStepId: call.productStepId, callId: call.callId,
    childCapabilityId: "submit_exact_gpt_turn_once", source: { sourceAttemptId: effect.attemptId,
      sourceResultRevision: effect.resultRevision, effectIdentityHash: effect.effectIdentityHash,
      walAuthorityHash: effect.walAuthorityHash } }]);
  input = "possible"; assert.equal((await run()).readbackOnlyCalls, null);
  input = "zero"; verified = false; assert.equal((await run()).readbackOnlyCalls, null);
  verified = true;
  const negative = { kind: "negative_exact", path: "exact_conversation", effect_identity_hash: effect.effectIdentityHash,
    wal_authority_hash: effect.walAuthorityHash, source_effect_set_hash: effect.sourceEffectSetHash,
    canonical_conversation_hash: effect.canonicalConversationHash, user_turn_hash: effect.userTurnHash,
    provider_input_delta: 0, first_observed_at: "2026-10-10T00:00:00.000Z", observed_at: "2026-10-10T00:01:00.000Z",
    observation_count: 2, pending_cause: "exact-user-turn-unavailable",
    observation_revision_hash: hashCanonical("fresh-negative") } as const;
  assert.equal(validSourceReadbackObservation(negative), true);
  observed = [negative];
  assert.equal((await run()).readbackOnlyCalls, null, "a proved old effect is not selected repeatedly");
};

const verifyCurrentSourceKinds = async (store: ProductionRuntimeStore): Promise<void> => {
  const fixture = riskRecoveryFixture();
  const jobs = ["zero", "unknown", "unverified"].map(kind => task({ jobId: `job:source-kind-${kind}`,
    productId: "payment_screenshot_observation", actionId: "observe" }));
  for (const job of jobs) {
    store.acceptTask(job, "attempt:source-kind");
    store.recordAttemptFailure(job.job_id, "attempt:source-kind", attemptFailureFirstFact("attempt:source-kind",
      serializeTerminalFailure(executionFailure("failed", "PRODUCT_EXECUTION_FAILED"))));
  }
  const effect = fixture.history.replayEffects[0]!, call = { productStepId: effect.productStepId,
    callId: effect.callId, childCapabilityId: effect.childCapabilityId, sourceEffectSetHash: effect.sourceEffectSetHash };
  const history = (job: string) => job === jobs[0]!.job_id ? { ...fixture.history,
    historyHash: hashCanonical("full-zero-with-old-local-unknown"), rowCount: 1, replayCalls: [], replayEffects: [],
    unresolvedCommandCount: 1, unresolvedCommandSetHash: hashCanonical(["old-local-unknown"]) }
    : { ...fixture.history, walHistoryVerified: job !== jobs[2]!.job_id, replayCalls: [call], replayEffects: [effect],
      unresolvedCommandCount: 1, unresolvedCommandSetHash: hashCanonical(["old-provider-unknown"]) };
  const state = { store, active: new Map(), browserAuthority: {
    readAttemptPhysicalInputState: (job: string) => job === jobs[0]!.job_id ? "zero" : "unknown",
    readJobPhysicalInputState: (job: string) => job === jobs[0]!.job_id ? "zero" : "unknown",
    readJobBrowserHistoryEvidence: history } } as never;
  const sealed = await prepareSourceHandoffs(state);
  assert.equal(sealed.length, 2, "unverified history may not create a source");
  const zero = sealed.find(source => source.job_id === jobs[0]!.job_id)!;
  assert.deepEqual([zero.kind, zero.browser_input_state, zero.replay_calls, zero.input_quiescence_proof],
    ["attempt_handoff", "zero", [], null]);
  const unknown = sealed.find(source => source.job_id === jobs[1]!.job_id)!;
  assert.deepEqual([unknown.kind, unknown.browser_input_state, unknown.input_quiescence_proof],
    ["delivery_priority_replay", "unknown", null]);
  assert.equal(unknown.readback_proofs[0]!.disposition, "replay_exhausted");
  assert.ok(unknown.readback_proofs[0]!.effects[0]!.unaddressable);
  for (const job of jobs) await store.purgeJob(job.job_id);
};

/** A received payload plus a rejected new payload keeps the original Website receipt. */
export const verifyPayloadSlotConflict = async (
  store: ProductionRuntimeStore, providerEffectHash: `sha256:${string}`,
): Promise<void> => {
  await verifyChangedRiskSourceReadback();
  await verifyCurrentSourceKinds(store);
  const partial = task({ jobId: "job:payload-only-source",
    productId: "payment_screenshot_observation", actionId: "observe" });
  store.acceptTask(partial, "attempt:payload-only");
  const partialAttemptHash = hashCanonical({ attempt_id: "attempt:payload-only" }).slice(7, 23);
  const emptyOutbox = store.readResultOutboxHistoryEvidence(partial.job_id, "attempt:payload-only");
  store.enqueue({ idempotency_key: "aipresult_payload_only", kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(partial.job_id)}/artifacts/result_payload/airesult_${partialAttemptHash}_result_payload_payload`,
    method: "PUT", headers: {}, body: Buffer.from("{\"answer\":1}") });
  const payloadOnly = store.readResultOutboxHistoryEvidence(partial.job_id, "attempt:payload-only");
  assert.equal(payloadOnly.rowCount, 1);
  assert.equal(payloadOnly.candidateCount, 0,
    "partial payload upload must preserve history without claiming a complete result");
  assert.notEqual(payloadOnly.historyHash, emptyOutbox.historyHash);
  store.enqueue({ idempotency_key: "aipresult_envelope_ready", kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(partial.job_id)}/artifacts/result_envelope/airesult_${partialAttemptHash}_result_envelope_envelope`,
    method: "PUT", headers: {}, body: Buffer.from("{\"answer\":1}") });
  assert.equal(store.readResultOutboxHistoryEvidence(partial.job_id, "attempt:payload-only").candidateCount, 1,
    "a complete result envelope must block source handoff");
  const oldPayloadBody = Buffer.from("{\"answer\":2}");
  const oldPayloadHash = sha256(oldPayloadBody);
  const oldPayloadRequest = `aipresult_${hashCanonical({ job_id: partial.job_id,
    attempt_id: "attempt:payload-only", role: "result_payload",
    content_hash: oldPayloadHash }).slice(7, 47)}`;
  const oldArtifactId = `airesult_${partial.job_id.replace(/[^A-Za-z0-9_-]/gu, "_").slice(-64)}_${partialAttemptHash}_result_payload_${oldPayloadHash.slice(-16)}`;
  const oldPayloadReceipt = { role: "result_payload", receipt_hash: providerEffectHash,
    sha256: oldPayloadHash, artifact_id: oldArtifactId, object_ref: "object:old-payload",
    media_type: "application/json", byte_length: oldPayloadBody.byteLength };
  store.enqueue({ idempotency_key: oldPayloadRequest, kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(partial.job_id)}/artifacts/result_payload/${encodeURIComponent(oldArtifactId)}`,
    method: "PUT", headers: { "x-ai-content-sha256": oldPayloadHash },
    body: oldPayloadBody });
  assert.equal(store.hydrateRemoteOutboxReceipts(partial.job_id, [{
    request_id: oldPayloadRequest, write_kind: "artifact",
    payload_hash: sha256(oldPayloadBody), response_json: oldPayloadReceipt,
  }]), 1);
  assert.deepEqual(await store.deliverOutbox(oldPayloadRequest, async () => {
    throw new Error("OLD_PAYLOAD_MUST_NOT_BE_UPLOADED_AGAIN");
  }), oldPayloadReceipt,
  "a prior session's exact Website receipt must settle the original payload Outbox intent");
  const changedPayloadBody = Buffer.from("{\"answer\":3}");
  const changedPayloadHash = sha256(changedPayloadBody);
  const changedPayloadRequest = `aipresult_${hashCanonical({ job_id: partial.job_id,
    attempt_id: "attempt:payload-only", role: "result_payload",
    content_hash: changedPayloadHash }).slice(7, 47)}`;
  const changedArtifactId = `airesult_${partial.job_id.replace(/[^A-Za-z0-9_-]/gu, "_").slice(-64)}_${partialAttemptHash}_result_payload_${changedPayloadHash.slice(-16)}`;
  store.enqueue({ idempotency_key: changedPayloadRequest, kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(partial.job_id)}/artifacts/result_payload/${encodeURIComponent(changedArtifactId)}`,
    method: "PUT", headers: { "x-ai-content-sha256": changedPayloadHash },
    body: changedPayloadBody });
  await assert.rejects(store.deliverOutbox(changedPayloadRequest, async () => {
    throw runtimeTransportFailure("AI_PRODUCTION_RESULT_OBJECT_CONFLICT", 409);
  }), /AI_PRODUCTION_RESULT_OBJECT_CONFLICT/u);
  assert.deepEqual(store.readResultPayloadSlotConflict(partial.job_id, "attempt:payload-only"), {
    old_request_id: oldPayloadRequest, old_payload_hash: oldPayloadHash,
    old_receipt_hash: providerEffectHash, new_request_id: changedPayloadRequest,
    new_payload_hash: changedPayloadHash,
  },
    "an exact old receipt plus different rejected bytes must open the zero-submit source path");
};

export const verifyRepeatedCheckpointSourceHandoff = async (store: ProductionRuntimeStore, jobId: string,
  history: Parameters<typeof sourceReadbackProofs>[0],
  conflict: NonNullable<ReturnType<ProductionRuntimeStore["readResultPayloadSlotConflict"]>>): Promise<void> => {
  const settlements = store.readAcceptedSourceSettlements(jobId);
  assert.equal(settlements.length, 2, "both immutable source seals retain the same checkpoint");
  const proofs = sourceReadbackProofs(history, [], settlements);
  assert.equal(proofs?.[0]?.disposition, "settled_reusable");
  assert.equal(proofs?.[0]?.effects.length, 1, "identical ancestors are one consumable effect fact");
  const duplicate = settlements[1]!;
  assert.equal(duplicate.kind, "reused_checkpoint");
  if (duplicate.kind !== "reused_checkpoint") throw new Error("FIXTURE_CHECKPOINT_REQUIRED");
  await verifyCompletedSourceAdoption(store, jobId, history, duplicate);
  for (const effect of [{ ...duplicate.effect, wal_authority_hash: hashCanonical("wrong-wal") },
    { ...duplicate.effect, settled_checkpoint: { ...duplicate.effect.settled_checkpoint, artifact_ref: "wrong-artifact" } }]) {
    assert.equal(sourceReadbackProofs(history, [], [settlements[0]!, { ...duplicate, effect }]), null);
  }
  const prior = store.taskAuthorities, readConflict = store.readResultPayloadSlotConflict;
  const before = store.readIssuedSourceHandoffForAttempt(jobId, store.readTask(jobId)!.current_attempt_id!);
  store.taskAuthorities = () => [store.readTask(jobId)!];
  store.readResultPayloadSlotConflict = () => conflict;
  let artifactChecks = 0;
  try {
    const sealed = await prepareSourceHandoffs({ store, active: new Map(), browserAuthority: {
      readJobBrowserHistoryEvidence: () => history, readAttemptPhysicalInputState: () => "zero",
      readJobPhysicalInputState: () => "possible" }, executor: { verifySourceCheckpointArtifact: async (input: {
        artifactRef: string; artifactContentHash: string }) => {
          artifactChecks++; assert.equal(input.artifactRef, duplicate.effect.settled_checkpoint.artifact_ref);
          assert.equal(input.artifactContentHash, duplicate.effect.settled_checkpoint.artifact_content_hash);
        } }, lastErrorCode: null, lastErrorReason: null } as never);
    assert.equal(sealed.length, 1); assert.equal(sealed[0]!.source_attempt_id, store.readTask(jobId)!.current_attempt_id);
    assert.equal(sealed[0]!.browser_input_state, "zero"); assert.equal(artifactChecks, 1);
    assert.deepEqual(store.readIssuedSourceHandoffForAttempt(jobId, store.readTask(jobId)!.current_attempt_id!), before);
    assert.deepEqual(store.readAcceptedSourceSettlements(jobId), settlements, "all ancestors remain unchanged");
  } finally { store.taskAuthorities = prior; store.readResultPayloadSlotConflict = readConflict; }
};

const verifyCompletedSourceAdoption = async (store: ProductionRuntimeStore, jobId: string,
  history: Parameters<typeof sourceReadbackProofs>[0],
  adopted: Extract<ReturnType<ProductionRuntimeStore["readAcceptedSourceSettlements"]>[number], { kind: "reused_checkpoint" }>,
): Promise<void> => {
  const parent = store.readTask(jobId)!, database = Reflect.get(store, "database") as Database.Database;
  const previousObservation = database.prepare("select readback_observations_json from production_attempt_handoffs where job_id=? and source_attempt_id=?")
    .get(jobId, parent.current_attempt_id) as { readback_observations_json: string } | undefined;
  const checkpoint = adopted.effect.settled_checkpoint;
  store.recordSourceReadbackObservation(jobId, parent.current_attempt_id, { ...checkpoint,
    kind: "settled_checkpoint", path: "source_checkpoint", effect_identity_hash: adopted.effectIdentityHash,
    source_effect_set_hash: adopted.sourceEffectSetHash, wal_authority_hash: adopted.effect.wal_authority_hash });
  const result = { ...resultFor(parent.task), evidence_refs: [checkpoint.artifact_ref] };
  database.prepare("update production_tasks set status='completed',result_json=?,staged_result_json=null,current_reason=null where job_id=?").run(JSON.stringify(result), jobId);
  const input = { store, task: { parent_task_ref: jobId, parent_result_ref: result.result_payload_ref,
    parent_result_hash: result.result_payload_hash }, relationKind: "provider_continuation" as const,
    browserAuthority: { readJobBrowserHistoryEvidence: () => history } as never,
    signal: new AbortController().signal, readAdoptedImageReference: async () => { throw new Error("PARENT_TEXT_READ_FORBIDDEN"); } };
  const readSettlements = store.readAcceptedSourceSettlements;
  try {
    const resolved = await readContinuationSources(input);
    assert.equal(resolved?.sources.length, 1, "repeated adopted ancestors are one exact source");
    assert.equal(resolved?.sources[0]?.sourceAttemptId, checkpoint.source_attempt_id);
    assert.notEqual(resolved?.sources[0]?.sourceAttemptId, parent.current_attempt_id);
    assert.equal(resolved?.sources[0]?.productStepId, adopted.productStepId);
    store.readAcceptedSourceSettlements = () => [];
    await assert.rejects(readContinuationSources(input), /PRODUCTION_SOURCE_REPLAY_INVALID/u);
    store.readAcceptedSourceSettlements = readSettlements;
    const row = database.prepare("select source_attempt_id,seal_hash from production_attempt_handoffs where job_id=? and issued_attempt_id=?")
      .get(jobId, parent.current_attempt_id) as { source_attempt_id: string; seal_hash: string };
    database.prepare("update production_attempt_handoffs set seal_hash=? where job_id=? and source_attempt_id=?")
      .run(hashCanonical("wrong-seal"), jobId, row.source_attempt_id);
    try { await assert.rejects(readContinuationSources(input), /PRODUCTION_SOURCE_HANDOFF_CONFLICT/u); }
    finally { database.prepare("update production_attempt_handoffs set seal_hash=? where job_id=? and source_attempt_id=?")
      .run(row.seal_hash, jobId, row.source_attempt_id); }
  } finally {
    store.readAcceptedSourceSettlements = readSettlements;
    database.prepare("update production_tasks set status=?,result_json=?,current_reason=? where job_id=?")
      .run(parent.status, parent.result === null ? null : JSON.stringify(parent.result), parent.current_reason, jobId);
    if (previousObservation) database.prepare("update production_attempt_handoffs set readback_observations_json=? where job_id=? and source_attempt_id=?")
      .run(previousObservation.readback_observations_json, jobId, parent.current_attempt_id);
    else database.prepare("delete from production_attempt_handoffs where job_id=? and source_attempt_id=? and seal_hash is null")
      .run(jobId, parent.current_attempt_id);
  }
};
