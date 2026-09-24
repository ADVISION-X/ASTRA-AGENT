import type { SourceAttemptHandoff, SourceReadbackEffectProof, SourceReadbackObservation } from "./source-readback-contract.js";
import { executionFailure } from "../../execution-failure.js";
import type { AttemptFailureFirstFact } from "./terminal-failure.js";
import { hashCanonical, sha256, type WebsiteAgentResult, type WebsiteAgentTask } from "./contracts.js";
import { WebsiteAgentResultSchema } from "./contracts.js";
import { ProductionStoreFoundation } from "./store-foundation.js";
import { productionTaskRowValid } from "./store-authority-validation.js";
import {
  isAttemptFailureFirstFact,
  json,
  now,
  storedTaskFromRow,
  type StoredProductionTask,
  type TaskRow,
} from "./store-foundation.js";

const jobPathMarker = (jobId: string): string => `/jobs/${encodeURIComponent(jobId)}/`;

const assertResultIdentity = (
  accepted: StoredProductionTask | null,
  result: WebsiteAgentResult,
): void => {
  if (!accepted || result.job_id !== accepted.task.job_id
    || result.source_task_id !== accepted.task.source_task_id
    || result.product_id !== accepted.task.product_id
    || result.action_id !== accepted.task.action_id) {
    throw executionFailure("failed", "PRODUCTION_RESULT_DURABLE_IDENTITY_MISMATCH");
  }
};

const sameCompletion = (
  existing: StoredProductionTask | null,
  result: WebsiteAgentResult,
): boolean => Boolean(existing?.status === "completed" && json(existing.result) === json(result));
const taskAuthorityFromRow = (row: TaskRow): StoredProductionTask => {
  const record = storedTaskFromRow(row);
  if (!productionTaskRowValid(row, record)) {
    throw executionFailure("failed", "PRODUCTION_TASK_AUTHORITY_CORRUPT");
  }
  return record;
};

export abstract class ProductionStoreTaskState extends ProductionStoreFoundation {
  public recordSourceReadbackObservation(
    jobId: string, attemptId: string, observation: SourceReadbackObservation,
  ): void {
    const validHash = (value: string): boolean => /^sha256:[a-f0-9]{64}$/u.test(value);
    if (![observation.effect_identity_hash, observation.source_effect_set_hash,
      observation.old_target_ref_hash, observation.old_document_ref_hash,
      observation.wal_authority_hash].every(validHash)
      || observation.provider_input_delta !== 0
      || !Number.isFinite(Date.parse(observation.observed_at))
      || observation.kind === "settled_checkpoint" && (
        observation.path !== "source_checkpoint" || !observation.source_attempt_id
        || !Number.isSafeInteger(observation.source_result_revision)
        || observation.source_result_revision < 0 || !observation.artifact_ref
        || ![observation.artifact_content_hash,
          observation.checkpoint_exact_call_identity_hash, observation.submit_prompt_hash,
          observation.canonical_conversation_hash, observation.user_turn_hash,
          observation.proof_hash].every(validHash))
      || observation.kind === "negative_exact" && (
        observation.path !== "old_target" && observation.path !== "exact_conversation"
        || !Number.isSafeInteger(observation.observation_count)
        || observation.observation_count < 2
        || !Number.isFinite(Date.parse(observation.first_observed_at))
        || Date.parse(observation.observed_at) <= Date.parse(observation.first_observed_at)
        || ![observation.target_ref_hash, observation.document_ref_hash,
          observation.observation_revision_hash, observation.canonical_conversation_hash,
          observation.user_turn_hash].every(validHash)
        || observation.pending_cause !== "exact-user-turn-unavailable"
          && observation.pending_cause !== "adjacent-assistant-missing")
      || observation.kind === "old_instance_unavailable" && (
        observation.path !== "old_target" || !validHash(observation.proof_hash))) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_PROOF_INVALID");
    }
    this.database.transaction(() => {
      const current = this.readTask(jobId);
      if (!current || current.current_attempt_id !== attemptId
        || observation.kind !== "settled_checkpoint" && current.status !== "failed"
        || observation.kind === "settled_checkpoint" && current.status === "completed"
        || current.staged_result !== null
        || current.current_reason?.startsWith("SOURCE_HANDOFF_SEALED|")) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_CONFLICT");
      }
      const existing = this.database.prepare(`select readback_observations_json
        from production_attempt_handoffs where job_id=? and source_attempt_id=?`).get(
        jobId, attemptId,
      ) as { readback_observations_json: string } | undefined;
      const observations = existing
        ? JSON.parse(existing.readback_observations_json) as SourceReadbackObservation[] : [];
      if (!Array.isArray(observations)) throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_CORRUPT");
      const prior = observations.findIndex((item) => item.effect_identity_hash === observation.effect_identity_hash
        && item.path === observation.path);
      if (prior >= 0) {
        const previous = observations[prior]!;
        if (observation.kind === "settled_checkpoint") {
          if (previous.kind !== "settled_checkpoint"
            || previous.proof_hash !== observation.proof_hash) {
            throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_CONFLICT");
          }
          return;
        }
        observations.splice(prior, 1);
      }
      observations.push(observation);
      if (existing) this.database.prepare(`update production_attempt_handoffs
        set readback_observations_json=? where job_id=? and source_attempt_id=?`).run(
        json(observations), jobId, attemptId,
      );
      else this.database.prepare(`insert into production_attempt_handoffs(
        job_id,source_attempt_id,issued_attempt_id,seal_hash,source_manifest_json,
        first_fact_raw,sealed_at,accepted_at,readback_observations_json
      ) values(?,?,null,null,null,null,null,null,?)`).run(
        jobId, attemptId, json(observations),
      );
    })();
  }

  public readSourceReadbackObservations(
    jobId: string, attemptId: string,
  ): readonly SourceReadbackObservation[] {
    const row = this.database.prepare(`select readback_observations_json
      from production_attempt_handoffs where job_id=? and source_attempt_id=?`).get(
      jobId, attemptId,
    ) as { readback_observations_json: string } | undefined;
    if (!row) return [];
    const parsed: unknown = JSON.parse(row.readback_observations_json);
    if (!Array.isArray(parsed)) throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_CORRUPT");
    return parsed as SourceReadbackObservation[];
  }

  public sealSourceHandoff(manifest: SourceAttemptHandoff): void {
    const { seal_hash: sealHash, ...body } = manifest;
    const jobId = manifest.job_id;
    const attemptId = manifest.source_attempt_id;
    const current = this.readTask(jobId);
    const firstRaw = this.readAttemptFailureRaw(jobId);
    if (!current || current.status !== "failed" || current.current_attempt_id !== attemptId
      || current.staged_result !== null
      || manifest.source_task_hash !== hashCanonical(current.task)
      || manifest.first_fact_raw_hash !== (firstRaw === null ? null : sha256(Buffer.from(firstRaw, "utf8")))
      || hashCanonical(body) !== sealHash) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    }
    const reason = `SOURCE_HANDOFF_SEALED|${sealHash}`;
    this.database.transaction(() => {
      const existing = this.database.prepare(`select seal_hash,source_manifest_json,first_fact_raw
        from production_attempt_handoffs where job_id=? and source_attempt_id=?`).get(
        jobId, attemptId,
      ) as { seal_hash: string | null; source_manifest_json: string | null;
        first_fact_raw: string | null } | undefined;
      if (existing && existing.seal_hash !== null
        && (existing.seal_hash !== sealHash
          || existing.source_manifest_json !== json(manifest)
          || existing.first_fact_raw !== firstRaw)) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      if (current.current_reason === reason && existing?.seal_hash === sealHash) return;
      if (current.current_reason?.startsWith("SOURCE_HANDOFF_SEALED|")) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      const changed = this.database.prepare(`update production_tasks
        set current_reason=?,updated_at=?
        where job_id=? and status='failed' and current_attempt_id=?
          and current_reason is ? and staged_result_json is null`).run(
        reason, now(), jobId, attemptId, current.current_reason,
      );
      if (changed.changes !== 1) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      if (!existing) this.database.prepare(`insert into production_attempt_handoffs(
        job_id,source_attempt_id,issued_attempt_id,seal_hash,source_manifest_json,
        first_fact_raw,sealed_at,accepted_at,readback_observations_json
      ) values(?,?,null,?,?,?,?,null,'[]')`).run(
        jobId, attemptId, sealHash, json(manifest), firstRaw, now(),
      );
      else this.database.prepare(`update production_attempt_handoffs
        set seal_hash=?,source_manifest_json=?,first_fact_raw=?,sealed_at=?
        where job_id=? and source_attempt_id=? and seal_hash is null`).run(
        sealHash, json(manifest), firstRaw, now(), jobId, attemptId,
      );
    })();
  }

  public readSealedSourceHandoff(jobId: string, attemptId: string): SourceAttemptHandoff | null {
    const current = this.readTask(jobId);
    if (!current || current.current_attempt_id !== attemptId
      || !current.current_reason?.startsWith("SOURCE_HANDOFF_SEALED|")) return null;
    const row = this.database.prepare(`select seal_hash,source_manifest_json,first_fact_raw
      from production_attempt_handoffs where job_id=? and source_attempt_id=?`).get(
      jobId, attemptId,
    ) as { seal_hash: string | null; source_manifest_json: string | null;
      first_fact_raw: string | null } | undefined;
    if (!row?.seal_hash || !row.source_manifest_json
      || current.current_reason !== `SOURCE_HANDOFF_SEALED|${row.seal_hash}`
      || this.readAttemptFailureRaw(jobId) !== row.first_fact_raw) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    }
    const manifest = JSON.parse(row.source_manifest_json) as SourceAttemptHandoff;
    const { seal_hash: sealHash, ...body } = manifest;
    if (sealHash !== row.seal_hash || hashCanonical(body) !== sealHash
      || manifest.job_id !== jobId || manifest.source_attempt_id !== attemptId
      || manifest.source_task_hash !== hashCanonical(current.task)) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    }
    return manifest;
  }

  public readIssuedSourceHandoff(
    jobId: string, issuedAttemptId: string, sealHash: `sha256:${string}`,
  ): SourceAttemptHandoff | null {
    const current = this.readTask(jobId);
    const row = this.database.prepare(`select source_attempt_id,source_manifest_json,accepted_at
      from production_attempt_handoffs where job_id=? and issued_attempt_id=? and seal_hash=?`).get(
      jobId, issuedAttemptId, sealHash,
    ) as { source_attempt_id: string; source_manifest_json: string | null;
      accepted_at: string | null } | undefined;
    if (!current || current.current_attempt_id !== issuedAttemptId || !row?.source_manifest_json
      || !row.accepted_at) return null;
    const manifest = JSON.parse(row.source_manifest_json) as SourceAttemptHandoff;
    const { seal_hash: storedSeal, ...body } = manifest;
    if (storedSeal !== sealHash || hashCanonical(body) !== sealHash
      || manifest.job_id !== jobId || manifest.source_attempt_id !== row.source_attempt_id
      || manifest.source_task_hash !== hashCanonical(current.task)) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    }
    return manifest;
  }

  public readIssuedSourceHandoffForAttempt(
    jobId: string, issuedAttemptId: string,
  ): SourceAttemptHandoff | null {
    const rows = this.database.prepare(`select seal_hash from production_attempt_handoffs
      where job_id=? and issued_attempt_id=? and accepted_at is not null limit 2`).all(
      jobId, issuedAttemptId,
    ) as Array<{ seal_hash: `sha256:${string}` }>;
    if (rows.length > 1) throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    return rows[0] ? this.readIssuedSourceHandoff(
      jobId, issuedAttemptId, rows[0].seal_hash,
    ) : null;
  }

  public readAcceptedSourceSettlements(jobId: string): readonly (
    Readonly<{ kind: "rejection_settled"; sourceAttemptId: string;
      sourceHandoffSealHash: `sha256:${string}`;
      effectIdentityHash: `sha256:${string}`; evidenceRef: string;
      evidenceHash: `sha256:${string}`; sourceEffectSetHash: `sha256:${string}`;
      productStepId: string; callId: string; childCapabilityId: string }>
    | Readonly<{ kind: "risk_authorized";
      sourceHandoffSealHash: `sha256:${string}`;
      effectIdentityHash: `sha256:${string}`;
      sourceEffectSetHash: `sha256:${string}`;
      productStepId: string; callId: string; childCapabilityId: string }>
    | Readonly<{ kind: "reused_checkpoint"; sourceAttemptId: string;
      sourceHandoffSealHash: `sha256:${string}`;
      effect: Extract<SourceReadbackEffectProof, { settled_checkpoint: object }>;
      effectIdentityHash: `sha256:${string}`; sourceEffectSetHash: `sha256:${string}`;
      productStepId: string; callId: string; childCapabilityId: string }>
  )[] {
    const rows = this.database.prepare(`select source_attempt_id,issued_attempt_id,seal_hash,
        source_manifest_json,first_fact_raw from production_attempt_handoffs
      where job_id=? and accepted_at is not null and issued_attempt_id is not null
      order by source_attempt_id`).all(jobId) as Array<{
        source_attempt_id: string; issued_attempt_id: string;
        seal_hash: `sha256:${string}`;
        source_manifest_json: string | null; first_fact_raw: string | null;
      }>;
    const currentAttempt = this.readTask(jobId)?.current_attempt_id;
    if (!currentAttempt) throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    const byIssued = new Map<string, typeof rows[number]>();
    for (const row of rows) {
      if (byIssued.has(row.issued_attempt_id)) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      byIssued.set(row.issued_attempt_id, row);
    }
    const settled: Array<
      Readonly<{ kind: "rejection_settled"; sourceAttemptId: string;
        sourceHandoffSealHash: `sha256:${string}`;
        effectIdentityHash: `sha256:${string}`; evidenceRef: string;
        evidenceHash: `sha256:${string}`; sourceEffectSetHash: `sha256:${string}`;
        productStepId: string; callId: string; childCapabilityId: string }>
      | Readonly<{ kind: "risk_authorized";
        sourceHandoffSealHash: `sha256:${string}`;
        effectIdentityHash: `sha256:${string}`;
        sourceEffectSetHash: `sha256:${string}`;
        productStepId: string; callId: string; childCapabilityId: string }>
      | Readonly<{ kind: "reused_checkpoint"; sourceAttemptId: string;
        sourceHandoffSealHash: `sha256:${string}`;
        effect: Extract<SourceReadbackEffectProof, { settled_checkpoint: object }>;
        effectIdentityHash: `sha256:${string}`; sourceEffectSetHash: `sha256:${string}`;
        productStepId: string; callId: string; childCapabilityId: string }>
    > = [];
    const seen = new Set<string>();
    let cursor: string | undefined = currentAttempt;
    while (cursor && byIssued.has(cursor)) {
      if (seen.has(cursor)) throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      seen.add(cursor);
      const row: (typeof rows)[number] = byIssued.get(cursor)!;
      cursor = row.source_attempt_id;
      if (!row.source_manifest_json) throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      const manifest = JSON.parse(row.source_manifest_json) as SourceAttemptHandoff;
      const { seal_hash: sealHash, ...body } = manifest;
      if (sealHash !== row.seal_hash || hashCanonical(body) !== sealHash
        || manifest.job_id !== jobId || manifest.source_attempt_id !== row.source_attempt_id) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      if (manifest.kind === "delivery_priority_replay") {
        const exhausted = manifest.readback_proofs.filter((proof) =>
          proof.disposition === "replay_exhausted");
        if (manifest.readback_exhaustion_hash !== hashCanonical(exhausted)) {
          throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
        }
        if (exhausted.length === 0) {
          if (!manifest.payload_slot_conflict || manifest.replay_calls.length === 0
            || manifest.readback_proofs.length !== manifest.replay_calls.length
            || manifest.readback_proofs.some((proof) => proof.disposition !== "settled_reusable")) {
            throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
          }
          for (const proof of manifest.readback_proofs) {
            const call = manifest.replay_calls.find((item) =>
              item.product_step_id === proof.product_step_id && item.call_id === proof.call_id
              && item.child_capability_id === proof.child_capability_id
              && item.source_effect_set_hash === proof.source_effect_set_hash);
            const checkpoints = proof.effects.filter((effect): effect is Extract<
              SourceReadbackEffectProof, { settled_checkpoint: object }
            > => effect.settled_checkpoint !== undefined);
            if (!call || checkpoints.length !== proof.effects.length || checkpoints.length === 0) {
              throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
            }
            for (const effect of checkpoints) {
              if (effect.source_effect_set_hash !== call.source_effect_set_hash) {
                throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
              }
              settled.push(Object.freeze({ kind: "reused_checkpoint" as const,
                sourceAttemptId: effect.settled_checkpoint.source_attempt_id,
                sourceHandoffSealHash: row.seal_hash,
                effect, effectIdentityHash: effect.effect_identity_hash,
                sourceEffectSetHash: effect.source_effect_set_hash,
                productStepId: proof.product_step_id, callId: proof.call_id,
                childCapabilityId: proof.child_capability_id }));
            }
          }
          continue;
        }
        for (const proof of exhausted) {
          if (!manifest.replay_calls.some((call) =>
            call.product_step_id === proof.product_step_id
            && call.call_id === proof.call_id
            && call.child_capability_id === proof.child_capability_id
            && call.source_effect_set_hash === proof.source_effect_set_hash)) {
            throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
          }
          let exhaustedEffects = 0;
          for (const effect of proof.effects) {
            if (effect.old_path === null) {
              if (!("rejection_settled" in effect)
                && !("risk_authorized" in effect)
                && !("settled_checkpoint" in effect)) {
                throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
              }
              continue;
            }
            exhaustedEffects += 1;
            settled.push(Object.freeze({ kind: "risk_authorized" as const,
              sourceHandoffSealHash: row.seal_hash,
              effectIdentityHash: effect.effect_identity_hash,
              sourceEffectSetHash: effect.source_effect_set_hash,
              productStepId: proof.product_step_id,
              callId: proof.call_id,
              childCapabilityId: proof.child_capability_id }));
          }
          if (exhaustedEffects === 0) {
            throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
          }
        }
        continue;
      }
      if (manifest.kind !== "attempt_handoff" || manifest.browser_input_state !== "possible") continue;
      const historical = !Object.hasOwn(manifest, "rejected_call");
      const rejectedCall = historical
        && manifest.replay_calls.length === 1
        && Array.isArray(manifest.readback_proofs)
        && manifest.readback_proofs.length === 0
        ? manifest.replay_calls[0] : manifest.rejected_call;
      const raw = row.first_fact_raw;
      const first = raw === null ? null : JSON.parse(raw) as unknown;
      if (!first || !isAttemptFailureFirstFact(first)
        || manifest.first_fact_raw_hash !== sha256(Buffer.from(raw!, "utf8"))
        || first.failure_core.code !== "RESULT_SETTLED_UNUSABLE"
          && first.failure_core.code !== "GPT_RESPONSE_STOPPED_EMPTY"
        || first.failure_core.effect_scope !== "provider_effect"
        || first.failure_core.browser_outcome !== "CONFIRMED"
        || first.failure_core.mutation_outcome !== "confirmed"
        || first.failure_core.provider_effect_identity_hash === null
        || first.failure_core.evidence_ref === null
        || first.failure_core.evidence_hash === null
        || !rejectedCall
        || !manifest.replay_calls.some((call) =>
          call.product_step_id === rejectedCall.product_step_id
          && call.call_id === rejectedCall.call_id
          && call.child_capability_id === rejectedCall.child_capability_id
          && call.source_effect_set_hash === rejectedCall.source_effect_set_hash)
        || !historical && manifest.rejected_call?.effect_identity_hash
          !== first.failure_core.provider_effect_identity_hash) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_REJECTION_INVALID");
      }
      settled.push(Object.freeze({ kind: "rejection_settled" as const,
        sourceAttemptId: row.source_attempt_id,
        sourceHandoffSealHash: row.seal_hash,
        effectIdentityHash: first.failure_core.provider_effect_identity_hash,
        evidenceRef: first.failure_core.evidence_ref,
        evidenceHash: first.failure_core.evidence_hash,
        sourceEffectSetHash: rejectedCall.source_effect_set_hash,
        productStepId: rejectedCall.product_step_id,
        callId: rejectedCall.call_id,
        childCapabilityId: rejectedCall.child_capability_id }));
    }
    return Object.freeze(settled);
  }

  public earliestTaskCreatedAt(): string | null {
    const row = this.database.prepare(`select created_at from production_tasks
      order by created_at,job_id limit 1`).get() as { created_at: string } | undefined;
    return row?.created_at ?? null;
  }

  public readAttemptFailureRaw(jobId: string): string | null {
    const row = this.database.prepare(`select attempt_failure_json from production_tasks where job_id=?`)
      .get(jobId) as { attempt_failure_json: string | null } | undefined;
    return row?.attempt_failure_json ?? null;
  }
  private supersedeUnsentWritesForWebsiteAttempt(jobId: string): number {
    const changed = this.database.prepare(`update production_outbox
      set last_error='WEBSITE_ATTEMPT_REPLACED'
      where instr(path,?)>0 and sent_at is null`
    ).run(jobPathMarker(jobId));
    this.notifyOutbox(null);
    return changed.changes;
  }

  public acceptTaskAfterSourceHandoff(
    task: WebsiteAgentTask,
    attemptId: string,
    sealHash: `sha256:${string}`,
  ): StoredProductionTask {
    this.database.transaction(() => {
      const current = this.readTask(task.job_id);
      const archived = this.database.prepare(`select source_attempt_id,issued_attempt_id,
          seal_hash,source_manifest_json,first_fact_raw
        from production_attempt_handoffs where job_id=? and seal_hash=?`).get(
        task.job_id, sealHash,
      ) as { source_attempt_id: string; issued_attempt_id: string | null;
        seal_hash: string | null; source_manifest_json: string | null;
        first_fact_raw: string | null } | undefined;
      if (!current || current.status !== "failed" || !archived
        || archived.source_manifest_json === null || archived.seal_hash !== sealHash
        || current.task.request_hash !== task.request_hash
        || current.current_attempt_id !== archived.source_attempt_id
        || current.current_reason !== `SOURCE_HANDOFF_SEALED|${sealHash}`
        || current.staged_result !== null
        || this.readAttemptFailureRaw(task.job_id) !== archived.first_fact_raw
        || (archived.issued_attempt_id !== null && archived.issued_attempt_id !== attemptId)) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      const manifest = JSON.parse(archived.source_manifest_json) as SourceAttemptHandoff;
      if (manifest.seal_hash !== sealHash
        || manifest.source_task_hash !== hashCanonical(task)
        || manifest.source_attempt_id !== archived.source_attempt_id
        || attemptId === archived.source_attempt_id) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      const changed = this.database.prepare(`update production_tasks
        set current_attempt_id=?,current_reason='LEASE_GRANTED',
          staged_result_json=null,attempt_failure_json=null,updated_at=?
        where job_id=? and status='failed' and current_attempt_id=?
          and current_reason=? and staged_result_json is null`).run(
        attemptId, now(), task.job_id, archived.source_attempt_id,
        `SOURCE_HANDOFF_SEALED|${sealHash}`,
      );
      if (changed.changes !== 1) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      this.supersedeUnsentWritesForWebsiteAttempt(task.job_id);
      this.database.prepare(`update production_attempt_handoffs
        set issued_attempt_id=?,accepted_at=?
        where job_id=? and source_attempt_id=? and seal_hash=?`).run(
        attemptId, now(), task.job_id, archived.source_attempt_id, sealHash,
      );
    })();
    return this.readTask(task.job_id)!;
  }

  public acceptTask(
    task: WebsiteAgentTask,
    attemptId: string,
  ): StoredProductionTask {
    const existing = this.readTask(task.job_id);
    if (existing) {
      if (existing.task.request_hash !== task.request_hash) {
        throw executionFailure("failed", "PRODUCTION_TASK_REQUEST_HASH_CONFLICT");
      }
      if (existing.current_attempt_id === attemptId) {
        if (existing.status !== "failed") {
          throw executionFailure("failed", "PRODUCTION_ACCEPTED_ATTEMPT_IDENTITY_CONFLICT");
        }
        if (existing.attempt_failure) {
          throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_REQUIRED");
        }
        this.database.prepare(`update production_tasks
          set current_reason='LEASE_REGRANTED',updated_at=?
          where job_id=? and status='failed' and current_attempt_id=?`).run(
          now(), task.job_id, attemptId,
        );
        return this.readTask(task.job_id)!;
      }
      if (existing.status === "failed") {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_REQUIRED");
      }
      throw executionFailure("failed", "PRODUCTION_TASK_IDENTITY_CONFLICT");
    }
    const timestamp = now();
    this.database.prepare(`insert into production_tasks(
      job_id,request_hash,task_json,status,current_attempt_id,current_reason,created_at,updated_at
    ) values(?,?,?,?,?,?,?,?)`).run(
      task.job_id, task.request_hash, json(task), "failed", attemptId,
      "LEASE_GRANTED", timestamp, timestamp,
    );
    return this.readTask(task.job_id)!;
  }

  public acceptTaskAfterFailureReconciled(
    task: WebsiteAgentTask,
    attemptId: string,
    expected: AttemptFailureFirstFact,
  ): StoredProductionTask {
    if (!isAttemptFailureFirstFact(expected)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_INVALID");
    }
    const transaction = this.database.transaction(() => {
      const current = this.readTask(task.job_id);
      if (!current || current.status !== "failed"
        || current.task.request_hash !== task.request_hash
        || json(current.attempt_failure) !== json(expected)) {
        throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_CONFLICT");
      }
      if (current.current_attempt_id !== attemptId) {
        throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_CONFLICT");
      }
      this.database.prepare(`update production_tasks
        set current_reason='LEASE_REGRANTED',updated_at=?
        where job_id=? and status='failed' and current_attempt_id=? and attempt_failure_json=?`).run(
        now(), task.job_id, attemptId, json(expected),
      );
    });
    transaction();
    return this.readTask(task.job_id)!;
  }

  public readTask(jobId: string): StoredProductionTask | null {
    const row = this.database.prepare(
      `select t.job_id,t.request_hash,t.task_json,t.status,t.result_json,t.staged_result_json,
        t.attempt_failure_json,t.current_attempt_id,t.current_reason,t.updated_at
       from production_tasks t where t.job_id=?`,
    ).get(jobId) as TaskRow | undefined;
    return row ? taskAuthorityFromRow(row) : null;
  }

  public taskAuthorities(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(
      `select t.job_id,t.request_hash,t.task_json,t.status,t.result_json,t.staged_result_json,
        t.attempt_failure_json,t.current_attempt_id,t.current_reason,t.updated_at
       from production_tasks t order by t.updated_at,t.job_id`,
    ).all() as TaskRow[];
    return rows.map(taskAuthorityFromRow);
  }

  public markExecuting(jobId: string): void {
    this.database.prepare(
      `update production_tasks set current_reason='EXECUTING',updated_at=?
        where job_id=? and status='failed'
          and current_reason not like 'SOURCE_HANDOFF_SEALED|%'`,
    ).run(now(), jobId);
  }


  public stageResult(jobId: string, attemptId: string, result: WebsiteAgentResult): void {
    WebsiteAgentResultSchema.parse(result);
    const accepted = this.readTask(jobId);
    assertResultIdentity(accepted, result);
    if (accepted!.current_attempt_id !== attemptId
      || accepted!.current_reason !== "EXECUTING") {
      throw executionFailure("failed", "PRODUCTION_RESULT_ATTEMPT_FENCED");
    }
    if (accepted!.staged_result && json(accepted!.staged_result) !== json(result)) {
      throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_CONFLICT");
    }
    const changed = this.database.prepare(`update production_tasks
      set staged_result_json=?,current_reason='BUSINESS_ADMISSION_PENDING',updated_at=?
      where job_id=? and status='failed' and current_attempt_id=?
        and current_reason='EXECUTING'`).run(json(result), now(), jobId, attemptId);
    if (changed.changes !== 1) {
      throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_TERMINAL_CONFLICT");
    }
  }

  public completeTask(jobId: string, result: WebsiteAgentResult): void {
    WebsiteAgentResultSchema.parse(result);
    assertResultIdentity(this.readTask(jobId), result);
    this.database.transaction(() => {
      const changed = this.database.prepare(`update production_tasks set status='completed',current_reason=null,
        result_json=?,staged_result_json=null,attempt_failure_json=null,updated_at=?
        where job_id=? and status='failed' and staged_result_json=?`).run(
        json(result), now(), jobId, json(result),
      );
      if (changed.changes === 0 && !sameCompletion(this.readTask(jobId), result)) {
        throw executionFailure("failed", "PRODUCTION_TASK_COMPLETION_CONFLICT");
      }
      if (changed.changes === 1) {
        this.database.prepare(`update production_outbox set last_error='BUSINESS_ADMITTED'
          where instr(path,?)>0 and sent_at is null`
        ).run(jobPathMarker(jobId));
        this.database.prepare(`update production_outbox
          set last_error='BROWSER_CLEANUP_PENDING'
          where kind='terminal' and instr(path,?)>0
            and json_extract(cast(body_blob as text),'$.payload_hash')=?`
        ).run(jobPathMarker(jobId), hashCanonical(result));
      }
    })();
  }

  public pendingBrowserCleanupJobIds(): readonly string[] {
    const rows = this.database.prepare(`select distinct t.job_id from production_tasks t
      join production_outbox o on o.kind='terminal'
        and instr(o.path,'/jobs/' || t.job_id || '/')>0
        and o.last_error='BROWSER_CLEANUP_PENDING'
      where t.status='completed' order by t.job_id`).all() as Array<{ job_id: string }>;
    return Object.freeze(rows.map((row) => row.job_id));
  }

  public settleBrowserCleanup(jobId: string): void {
    if (this.readTask(jobId)?.status !== "completed") {
      throw executionFailure("failed", "PRODUCTION_BROWSER_CLEANUP_TASK_NOT_COMPLETED");
    }
    const changed = this.database.prepare(`update production_outbox
      set last_error='BROWSER_CLEANUP_SETTLED'
      where kind='terminal' and instr(path,?)>0
        and last_error='BROWSER_CLEANUP_PENDING'`
    ).run(jobPathMarker(jobId));
    if (changed.changes === 0 && this.pendingBrowserCleanupJobIds().includes(jobId)) {
      throw executionFailure("failed", "PRODUCTION_BROWSER_CLEANUP_SETTLE_CONFLICT");
    }
  }

  public pendingBusinessAdmissions(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(`select job_id,request_hash,task_json,status,result_json,
      staged_result_json,attempt_failure_json,current_attempt_id,current_reason,updated_at from production_tasks
      where status='failed' and staged_result_json is not null
      order by updated_at,job_id`).all() as TaskRow[];
    return rows.map(taskAuthorityFromRow);
  }

  public pendingAttemptFailures(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(`select job_id,request_hash,task_json,status,result_json,
      staged_result_json,attempt_failure_json,current_attempt_id,current_reason,updated_at from production_tasks
      where status='failed' and attempt_failure_json is not null
      order by updated_at,job_id`).all() as TaskRow[];
    return rows.map(taskAuthorityFromRow);
  }

  public unfinishedExecutionsWithoutReceipt(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(`select job_id,request_hash,task_json,status,result_json,
      staged_result_json,attempt_failure_json,current_attempt_id,current_reason,updated_at from production_tasks
      where status='failed' and staged_result_json is null and attempt_failure_json is null
        and current_attempt_id is not null
      order by updated_at,job_id`).all() as TaskRow[];
    return rows.map(taskAuthorityFromRow);
  }

  public async purgeJob(jobId: string): Promise<void> {
    if (!jobId || /[\0]/u.test(jobId)) {
      throw executionFailure("failed", "PRODUCTION_STORAGE_JOB_ID_INVALID");
    }
    await this.outboxDeliveryTail;
    const transaction = this.database.transaction(() => {
      this.database.prepare("delete from production_outbox where instr(path,?)>0")
        .run(jobPathMarker(jobId));
      this.database.prepare("delete from production_tasks where job_id=?").run(jobId);
    });
    transaction();
    if (this.readTask(jobId) || this.database.prepare(
      "select 1 from production_outbox where instr(path,?)>0 limit 1",
    ).get(jobPathMarker(jobId))) {
      throw executionFailure("failed", "PRODUCTION_JOB_PURGE_INCOMPLETE");
    }
  }

  public setCurrentReason(jobId: string, reason: string): void {
    this.database.prepare(
      `update production_tasks set current_reason=?,updated_at=? where job_id=? and status='failed'
        and (current_reason is null or current_reason not like 'SOURCE_HANDOFF_SEALED|%')`,
    ).run(reason.slice(0, 1_000), now(), jobId);
  }

  public recordAttemptFailure(
    jobId: string,
    attemptId: string,
    failure: AttemptFailureFirstFact,
  ): StoredProductionTask {
    if (!isAttemptFailureFirstFact(failure)
      || failure.release_descriptor.attempt_id !== attemptId) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_INVALID");
    }
    const existing = this.database.prepare(
      "select current_attempt_id from production_tasks where job_id=? and status='failed'",
    ).get(jobId) as { current_attempt_id: string } | undefined;
    if (!existing || existing.current_attempt_id !== attemptId) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IDENTITY_MISMATCH");
    }
    const serialized = json(failure);
    const first = this.database.prepare("select attempt_failure_json from production_tasks where job_id=?")
      .get(jobId) as { attempt_failure_json: string | null } | undefined;
    if (first?.attempt_failure_json && first.attempt_failure_json !== serialized) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE");
    }
    this.database.prepare(`update production_tasks
      set attempt_failure_json=coalesce(attempt_failure_json,?),current_reason=?,updated_at=?
      where job_id=? and status='failed' and current_attempt_id=?
        and current_reason not like 'SOURCE_HANDOFF_SEALED|%'`).run(
      serialized, failure.failure_core.code.slice(0, 1_000), now(), jobId, attemptId,
    );
    const persisted = this.readTask(jobId);
    if (!persisted || json(persisted.attempt_failure) !== serialized) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH");
    }
    return persisted;
  }

  public rebindAttemptFailureReleaseDescriptor(
    jobId: string,
    expected: AttemptFailureFirstFact,
    replacement: AttemptFailureFirstFact,
  ): StoredProductionTask {
    if (!isAttemptFailureFirstFact(expected) || !isAttemptFailureFirstFact(replacement)
      || json(expected.failure_core) !== json(replacement.failure_core)
      || expected.release_descriptor.attempt_id !== replacement.release_descriptor.attempt_id
      || replacement.release_descriptor.lease_version <= expected.release_descriptor.lease_version) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_REBIND_INVALID");
    }
    const changed = this.database.prepare(`update production_tasks
      set attempt_failure_json=?,current_reason=?,updated_at=?
      where job_id=? and status='failed' and current_attempt_id=? and attempt_failure_json=?`).run(
      json(replacement), replacement.failure_core.code.slice(0, 1_000), now(), jobId,
      replacement.release_descriptor.attempt_id, json(expected),
    );
    if (changed.changes !== 1) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_REBIND_CONFLICT");
    }
    const persisted = this.readTask(jobId);
    if (!persisted || json(persisted.attempt_failure) !== json(replacement)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH");
    }
    return persisted;
  }
}
