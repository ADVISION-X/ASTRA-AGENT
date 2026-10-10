import type { SourceAttemptHandoff, SourceReadbackObservation } from "./source-readback-contract.js";
import { acceptedSourceSettlements, targetlessFirstFactHash, validSourceReadbackObservation,
  validSourceHandoff, parseSourceHandoffJson,
  type AcceptedSourceSettlement } from "./store-source-settlement.js";
import { executionFailure } from "../../execution-failure.js";
import { hashCanonical } from "./contracts.js";
import { ProductionStoreFoundation, json, now,
  type StoredProductionTask } from "./store-foundation.js";

/** Canonical source attempt readback and handoff facts over the Runtime database. */
export abstract class ProductionStoreSourceReadback extends ProductionStoreFoundation {
  public abstract readTask(jobId: string): StoredProductionTask | null;
  public abstract readAttemptFailureRaw(jobId: string): string | null;
  protected sourceAttemptClosed(jobId: string, attemptId: string): boolean {
    return Boolean(this.database.prepare(`select 1 from production_attempt_handoffs
      where job_id=? and source_attempt_id=?
        and (seal_hash is not null or sealed_at is not null)`).get(jobId, attemptId));
  }
  private assertSourceReadbackWriter(jobId: string, attemptId: string, observation: SourceReadbackObservation): void {
      const current = this.readTask(jobId);
      if (!current || current.current_attempt_id !== attemptId
        || observation.kind !== "settled_checkpoint" && current.status !== "failed"
        || observation.kind === "settled_checkpoint" && current.status === "completed"
        || current.staged_result !== null || this.sourceAttemptClosed(jobId, attemptId)) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_CONFLICT");
      }
  }
  public recordSourceReadbackObservation(
    jobId: string, attemptId: string, observation: SourceReadbackObservation,
  ): void {
    if (!validSourceReadbackObservation(observation)) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_PROOF_INVALID");
    }
    this.database.transaction(() => {
      this.assertSourceReadbackWriter(jobId, attemptId, observation);
      const existing = this.database.prepare(`select readback_observations_json
        from production_attempt_handoffs where job_id=? and source_attempt_id=?`).get(
        jobId, attemptId,
      ) as { readback_observations_json: string } | undefined;
      const observations = existing
        ? this.parseSourceObservations(existing.readback_observations_json) : [];
      if (!Array.isArray(observations)) throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_CORRUPT");
      const prior = observations.findIndex((item) => item.effect_identity_hash === observation.effect_identity_hash
        && item.path === observation.path);
      if (prior >= 0) {
        const previous = observations[prior]!;
        if (observation.kind === "settled_checkpoint") {
          if (previous.kind !== "settled_checkpoint") throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_CONFLICT");
          if (previous.proof_hash === observation.proof_hash) return;
          if (previous.source_attempt_id !== observation.source_attempt_id
            || previous.source_result_revision !== observation.source_result_revision
            || previous.wal_authority_hash === observation.wal_authority_hash
              && previous.source_effect_set_hash === observation.source_effect_set_hash) {
            throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_CONFLICT");
          }
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
    return this.parseSourceObservations(row.readback_observations_json);
  }

  private parseSourceObservations(json: string): SourceReadbackObservation[] {
    let parsed: unknown;
    try { parsed = JSON.parse(json); }
    catch (error) { throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_CORRUPT", { cause: error }); }
    if (!Array.isArray(parsed) || !parsed.every(item => item && typeof item === "object"
      && !Array.isArray(item) && validSourceReadbackObservation(item))) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_CORRUPT");
    }
    return parsed as SourceReadbackObservation[];
  }

  public sealSourceHandoff(manifest: SourceAttemptHandoff): void {
    const { seal_hash: sealHash, ...body } = manifest;
    const jobId = manifest.job_id;
    const attemptId = manifest.source_attempt_id;
    const reason = `SOURCE_HANDOFF_SEALED|${sealHash}`;
    this.database.transaction(() => {
      const current = this.readTask(jobId);
      const firstRaw = this.readAttemptFailureRaw(jobId);
      if (!current || current.status !== "failed" || current.current_attempt_id !== attemptId
        || current.staged_result !== null
        || manifest.source_task_hash !== hashCanonical(current.task)
        || manifest.first_fact_raw_hash !== targetlessFirstFactHash(firstRaw)
        || hashCanonical(body) !== sealHash || !validSourceHandoff(manifest)) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      const existing = this.database.prepare(`select seal_hash,source_manifest_json,first_fact_raw,sealed_at
        from production_attempt_handoffs where job_id=? and source_attempt_id=?`).get(
        jobId, attemptId,
      ) as { seal_hash: string | null; source_manifest_json: string | null;
        first_fact_raw: string | null; sealed_at: string | null } | undefined;
      if (this.sourceAttemptClosed(jobId, attemptId)) {
        if (existing?.seal_hash === sealHash && existing.sealed_at !== null
          && existing.source_manifest_json === json(manifest)
          && existing.first_fact_raw === firstRaw) return;
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      const changed = this.database.prepare(`update production_tasks
        set current_reason=?,updated_at=?
        where job_id=? and status='failed' and current_attempt_id=?
          and staged_result_json is null`).run(
        reason, now(), jobId, attemptId,
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
    if (!current || current.current_attempt_id !== attemptId) return null;
    const row = this.database.prepare(`select seal_hash,source_manifest_json,first_fact_raw,sealed_at
      from production_attempt_handoffs where job_id=? and source_attempt_id=?`).get(
      jobId, attemptId,
    ) as { seal_hash: string | null; source_manifest_json: string | null;
      first_fact_raw: string | null; sealed_at: string | null } | undefined;
    if (!row) return null;
    if (!row.seal_hash && !row.sealed_at) return null;
    if (!row.seal_hash || !row.sealed_at || !row.source_manifest_json
      || this.readAttemptFailureRaw(jobId) !== row.first_fact_raw) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    }
    const manifest = parseSourceHandoffJson(row.source_manifest_json);
    const { seal_hash: sealHash, ...body } = manifest;
    if (sealHash !== row.seal_hash || hashCanonical(body) !== sealHash
      || !validSourceHandoff(manifest)
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
    const row = this.database.prepare(`select source_attempt_id,source_manifest_json,accepted_at,sealed_at
      from production_attempt_handoffs where job_id=? and issued_attempt_id=? and seal_hash=?`).get(
      jobId, issuedAttemptId, sealHash,
    ) as { source_attempt_id: string; source_manifest_json: string | null;
      accepted_at: string | null; sealed_at: string | null } | undefined;
    if (!current || current.current_attempt_id !== issuedAttemptId || !row) return null;
    if (!row.source_manifest_json || !row.accepted_at || !row.sealed_at) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    }
    const manifest = parseSourceHandoffJson(row.source_manifest_json);
    const { seal_hash: storedSeal, ...body } = manifest;
    if (storedSeal !== sealHash || hashCanonical(body) !== sealHash
      || !validSourceHandoff(manifest)
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
    ) as Array<{ seal_hash: `sha256:${string}` | null }>;
    const sealHash = rows[0]?.seal_hash;
    if (rows.length > 1 || rows[0] && !sealHash) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    }
    return sealHash ? this.readIssuedSourceHandoff(
      jobId, issuedAttemptId, sealHash,
    ) : null;
  }

  public readAcceptedSourceSettlements(jobId: string): readonly AcceptedSourceSettlement[] {
    const rows = this.database.prepare(`select source_attempt_id,issued_attempt_id,seal_hash,
        source_manifest_json,first_fact_raw,sealed_at from production_attempt_handoffs
      where job_id=? and accepted_at is not null and issued_attempt_id is not null
      order by source_attempt_id`).all(jobId) as Array<{
        source_attempt_id: string; issued_attempt_id: string;
        seal_hash: `sha256:${string}`;
        source_manifest_json: string | null; first_fact_raw: string | null; sealed_at: string | null;
      }>;
    if (rows.some((row) => !row.seal_hash || !row.sealed_at)) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    }
    const currentAttempt = this.readTask(jobId)?.current_attempt_id;
    if (!currentAttempt) throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    return acceptedSourceSettlements(rows, currentAttempt, jobId);
  }

}
