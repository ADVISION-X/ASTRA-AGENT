import { executionFailure, type SerializedExecutionFailure } from "../../typed-failure.js";
import {
  gptContinuationIdentityHash,
  gptContinuationUsable,
  type GptContinuationCompletionInput,
  type GptContinuationCheckpoint,
  type GptContinuationOriginCheckpoint,
  type GptContinuationReservation,
  type GptContinuationReservationReadback,
  type GptProviderContinuation,
  type NewStoredGptContinuation,
  type StoredGptContinuation,
} from "../../../capabilities/gpt/index.js";
import type { DurablePluginIdentity, WebsiteAgentResult, WebsiteAgentTask } from "./contracts.js";
import { hashCanonical, WebsiteAgentResultSchema, type ProductionHash } from "./contracts.js";
import { isRejectedCheckpointSequenceFailure } from "./store-outbox-recovery-proof.js";
import {
  ProductionStoreFoundation,
  isSerializedTerminalFailure,
  json,
  now,
  storedTaskFromRow,
  type ProductionCheckpointAuthority,
  type ProductionLeaseAuthority,
  type StoredProductionTask,
  type TaskRow,
} from "./store-foundation.js";

const assertResultIdentity = (
  accepted: StoredProductionTask | null,
  result: WebsiteAgentResult,
): void => {
  if (!accepted || result.job_id !== accepted.task.job_id
    || result.source_task_id !== accepted.task.source_task_id
    || result.product_id !== accepted.task.product_id
    || result.action_id !== accepted.task.action_id
    || result.plugin_id !== accepted.identity.plugin_id
    || result.plugin_version !== accepted.identity.plugin_version) {
    throw executionFailure("failed", "PRODUCTION_RESULT_DURABLE_IDENTITY_MISMATCH");
  }
};

const sameCompletion = (
  existing: StoredProductionTask | null,
  result: WebsiteAgentResult,
): boolean => Boolean(existing?.status === "completed" && json(existing.result) === json(result));

type GptContinuationRow = Omit<
  StoredGptContinuation,
  "conversation_identity_hash" | "current_checkpoint" | "origin_checkpoint" | "origin_provider" | "provider"
    | "semantic_admission_receipt"
> & Readonly<{
  conversation_identity_hash: `sha256:${string}` | null;
  current_checkpoint_json: string | null;
  origin_checkpoint_json: string | null;
  origin_provider_json: string | null;
  provider_json: string | null;
  semantic_admission_receipt_json: string | null;
}>;

type GptContinuationRecord = Omit<
  StoredGptContinuation,
  "conversation_identity_hash" | "origin_provider" | "provider"
> & Readonly<{
  conversation_identity_hash: `sha256:${string}` | null;
  origin_provider: GptProviderContinuation | null;
  provider: GptProviderContinuation | null;
}>;

const continuationRecordFromRow = (row: GptContinuationRow): GptContinuationRecord => {
  const {
    current_checkpoint_json, origin_checkpoint_json, origin_provider_json, provider_json,
    semantic_admission_receipt_json, ...stored
  } = row;
  return {
    ...stored,
    origin_checkpoint: origin_checkpoint_json
      ? JSON.parse(origin_checkpoint_json) as GptContinuationOriginCheckpoint : null,
    origin_provider: origin_provider_json
      ? JSON.parse(origin_provider_json) as GptProviderContinuation : null,
    provider: provider_json ? JSON.parse(provider_json) as GptProviderContinuation : null,
    current_checkpoint: current_checkpoint_json
      ? JSON.parse(current_checkpoint_json) as GptContinuationCheckpoint : null,
    semantic_admission_receipt: semantic_admission_receipt_json
      ? JSON.parse(semantic_admission_receipt_json) as StoredGptContinuation["semantic_admission_receipt"] : null,
  };
};

const usableContinuationFromRecord = (record: GptContinuationRecord): StoredGptContinuation | null =>
  record.conversation_identity_hash && record.origin_provider && record.provider
    ? record as StoredGptContinuation : null;

const GPT_CONTINUATION_SELECT = `continuation_ref,reservation_kind,reservation_identity_hash,
  origin_job_id,origin_plugin_version,plugin_id,owner_ref,subject_ref,authorization_ref,
  conversation_identity_hash,frontier_ref,source_checkpoint_hash,reservation_fence_hash,
  reservation_effect_hash,origin_provenance_hash,semantic_contract_hash,artifact_ref,artifact_hash,
  semantic_admission_receipt_ref,semantic_admission_receipt_hash,semantic_admission_receipt_json,opaque_read_grant_hash,
  completion_receipt_hash,origin_provider_json,origin_checkpoint_json,provider_json,
  current_checkpoint_json,lane_version,lane_owner_job_id`;

const sameReservation = (stored: GptContinuationRecord, reservation: GptContinuationReservation): boolean =>
  stored.continuation_ref === reservation.continuation_ref
  && stored.reservation_kind === reservation.reservation_kind
  && stored.reservation_identity_hash === reservation.reservation_identity_hash
  && stored.origin_job_id === reservation.creator_job_id
  && stored.origin_plugin_version === reservation.creator_plugin_version
  && stored.plugin_id === reservation.creator_plugin_id
  && stored.owner_ref === reservation.owner_ref
  && stored.subject_ref === reservation.subject_ref
  && stored.authorization_ref === reservation.authorization_ref
  && stored.source_checkpoint_hash === reservation.source_checkpoint_hash
  && stored.reservation_fence_hash === reservation.reservation_fence_hash
  && stored.reservation_effect_hash === reservation.reservation_effect_hash
  && stored.origin_provenance_hash === reservation.origin_provenance_hash
  && stored.semantic_contract_hash === reservation.semantic_contract_hash
  && stored.lane_version === reservation.lane_version;

const sameReusableBoundary = (
  stored: GptContinuationRecord,
  reservation: GptContinuationReservation,
): boolean => stored.reservation_kind === "reusable_origin"
  && reservation.reservation_kind === "reusable_origin"
  && stored.reservation_identity_hash === reservation.reservation_identity_hash
  && stored.owner_ref === reservation.owner_ref
  && stored.subject_ref === reservation.subject_ref
  && stored.source_checkpoint_hash === null
  && reservation.source_checkpoint_hash === null
  && stored.reservation_fence_hash === reservation.reservation_fence_hash
  && stored.reservation_effect_hash === reservation.reservation_effect_hash
  && stored.semantic_contract_hash === reservation.semantic_contract_hash
  && stored.lane_version === reservation.lane_version;

const sameReservationCompletion = (
  stored: GptContinuationRecord,
  input: GptContinuationCompletionInput,
): boolean => stored.continuation_ref === input.continuation_ref
  && stored.reservation_identity_hash === input.reservation_identity_hash
  && stored.origin_job_id === input.creator_job_id
  && stored.lane_version === input.lane_version
  && stored.reservation_fence_hash === input.reservation_fence_hash
  && stored.conversation_identity_hash === gptContinuationIdentityHash(input.provider)
  && json(stored.origin_provider) === json(input.provider)
  && json(stored.provider) === json(input.provider)
  && json(stored.origin_checkpoint) === json(input.checkpoint)
  && json(stored.current_checkpoint) === json(input.checkpoint)
  && stored.artifact_ref === input.artifact_ref
  && stored.artifact_hash === input.artifact_hash
  && stored.semantic_admission_receipt_ref === input.semantic_admission_receipt_ref
  && stored.semantic_admission_receipt_hash === input.semantic_admission_receipt_hash
  && json(stored.semantic_admission_receipt) === json(input.semantic_admission_receipt)
  && stored.opaque_read_grant_hash === input.opaque_read_grant_hash
  && stored.completion_receipt_hash === input.completion_receipt_hash
  && stored.lane_owner_job_id === null;

export abstract class ProductionStoreTaskState extends ProductionStoreFoundation {
  private readGptContinuationRecordForReservation(
    reservationIdentityHash: `sha256:${string}`,
  ): GptContinuationRecord | null {
    const row = this.database.prepare(`select ${GPT_CONTINUATION_SELECT}
      from production_continuations where reservation_identity_hash=?`).get(reservationIdentityHash) as
      | GptContinuationRow | undefined;
    return row ? continuationRecordFromRow(row) : null;
  }

  public acceptTask(
    task: WebsiteAgentTask,
    identity: DurablePluginIdentity,
    attemptId: string,
  ): StoredProductionTask {
    const existing = this.readTask(task.job_id);
    if (existing) {
      if (existing.task.request_hash !== task.request_hash) {
        throw executionFailure("failed", "PRODUCTION_TASK_REQUEST_HASH_CONFLICT");
      }
      if (json(existing.identity) !== json(identity)) {
        throw executionFailure("failed", "PRODUCTION_TASK_IDENTITY_CONFLICT");
      }
      if (existing.status === "failed" && existing.current_attempt_id !== attemptId) {
        if (existing.staged_result) throw executionFailure("failed", "PRODUCTION_NEW_ATTEMPT_AFTER_STAGED_RESULT");
        this.database.transaction(() => {
          this.database.prepare(
            "update production_continuations set lane_owner_job_id=null where lane_owner_job_id=?",
          ).run(task.job_id);
          this.database.prepare(`update production_tasks
            set current_attempt_id=?,current_reason='LEASE_GRANTED',updated_at=?
            where job_id=? and status='failed'`).run(attemptId, now(), task.job_id);
        })();
        return this.readTask(task.job_id)!;
      }
      return existing;
    }
    const timestamp = now();
    this.database.prepare(`insert into production_tasks(
      job_id,request_hash,task_json,identity_json,status,current_attempt_id,current_reason,created_at,updated_at
    ) values(?,?,?,?,?,?,?,?,?)`).run(
      task.job_id, task.request_hash, json(task), json(identity), "failed", attemptId,
      "LEASE_GRANTED", timestamp, timestamp,
    );
    return this.readTask(task.job_id)!;
  }

  public readTask(jobId: string): StoredProductionTask | null {
    const row = this.database.prepare(
      `select t.task_json,t.identity_json,t.status,t.result_json,t.staged_result_json,t.current_attempt_id,
        t.current_reason,t.updated_at,(select f.failure_json from production_attempt_failures f
          where f.job_id=t.job_id and f.attempt_id=t.current_attempt_id) as attempt_failure_json
       from production_tasks t where t.job_id=?`,
    ).get(jobId) as TaskRow | undefined;
    return row ? storedTaskFromRow(row) : null;
  }

  public readGptContinuationExecutionBinding(jobId: string) {
    const stored = this.readTask(jobId);
    return stored ? Object.freeze({
      job_id: jobId,
      plugin_id: stored.identity.plugin_id,
      plugin_version: stored.identity.plugin_version,
      owner_ref: stored.task.business_identity.owner_ref,
      subject_ref: stored.task.business_identity.subject_ref,
      authorization_ref: stored.task.business_identity.authorization_ref,
    }) : null;
  }

  public attemptIdsForTask(jobId: string): readonly string[] {
    const rows = this.database.prepare(`select attempt_id from production_attempt_failures where job_id=?
      union select current_attempt_id as attempt_id from production_tasks where job_id=?
      order by attempt_id`).all(jobId, jobId) as Array<{ attempt_id: string }>;
    return Object.freeze(rows.map((row) => row.attempt_id));
  }

  public taskAuthorities(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(
      `select t.task_json,t.identity_json,t.status,t.result_json,t.staged_result_json,t.current_attempt_id,
        t.current_reason,t.updated_at,(select f.failure_json from production_attempt_failures f
          where f.job_id=t.job_id and f.attempt_id=t.current_attempt_id) as attempt_failure_json
       from production_tasks t order by t.updated_at,t.job_id`,
    ).all() as TaskRow[];
    return rows.map(storedTaskFromRow);
  }

  public markExecuting(jobId: string): void {
    this.database.prepare(
      "update production_tasks set current_reason='EXECUTING',updated_at=? where job_id=? and status='failed'",
    ).run(now(), jobId);
  }

  public createGptContinuation(continuation: NewStoredGptContinuation): void {
    const task = this.readTask(continuation.origin_job_id);
    if (!task) throw executionFailure("failed", "GPT_CONTINUATION_ORIGIN_TASK_MISSING");
    const reservationIdentityHash = continuation.frontier_ref
      ?? hashCanonical({ identity_type: "persisted-gpt-continuation.v1", continuation_ref: continuation.continuation_ref });
    this.database.prepare(`insert into production_continuations(
      continuation_ref,reservation_kind,reservation_identity_hash,origin_job_id,origin_plugin_version,
      plugin_id,owner_ref,subject_ref,authorization_ref,conversation_identity_hash,frontier_ref,
      source_checkpoint_hash,reservation_fence_hash,reservation_effect_hash,origin_provenance_hash,
      semantic_contract_hash,artifact_ref,artifact_hash,semantic_admission_receipt_ref,semantic_admission_receipt_hash,
      semantic_admission_receipt_json,opaque_read_grant_hash,completion_receipt_hash,origin_provider_json,origin_checkpoint_json,
      provider_json,current_checkpoint_json,lane_version,lane_owner_job_id,created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      continuation.continuation_ref, "persisted", reservationIdentityHash,
      continuation.origin_job_id, task.identity.plugin_version, continuation.plugin_id,
      continuation.owner_ref, continuation.subject_ref, continuation.authorization_ref,
      continuation.conversation_identity_hash, continuation.frontier_ref,
      null, null, null, null, null, null, null, null, null, null, null, null, json(continuation.origin_provider),
      continuation.origin_checkpoint ? json(continuation.origin_checkpoint) : null,
      json(continuation.provider),
      continuation.current_checkpoint ? json(continuation.current_checkpoint) : null,
      continuation.lane_version, continuation.lane_owner_job_id, now(),
    );
  }

  public reserveExactGptContinuation(reservation: GptContinuationReservation): GptContinuationReservationReadback {
    this.database.prepare(`insert into production_continuations(
      continuation_ref,reservation_kind,reservation_identity_hash,origin_job_id,origin_plugin_version,
      plugin_id,owner_ref,subject_ref,authorization_ref,conversation_identity_hash,frontier_ref,
      source_checkpoint_hash,reservation_fence_hash,reservation_effect_hash,origin_provenance_hash,
      semantic_contract_hash,artifact_ref,artifact_hash,semantic_admission_receipt_ref,semantic_admission_receipt_hash,
      semantic_admission_receipt_json,opaque_read_grant_hash,completion_receipt_hash,origin_provider_json,origin_checkpoint_json,
      provider_json,current_checkpoint_json,lane_version,lane_owner_job_id,created_at
    ) values(?,?,?,?,?,?,?,?,?,null,?,?,?,?,?,?,null,null,null,null,null,null,null,null,null,null,null,?,?,?)
    on conflict(reservation_identity_hash) do nothing`).run(
      reservation.continuation_ref, reservation.reservation_kind, reservation.reservation_identity_hash,
      reservation.creator_job_id, reservation.creator_plugin_version, reservation.creator_plugin_id,
      reservation.owner_ref, reservation.subject_ref, reservation.authorization_ref,
      reservation.reservation_identity_hash, reservation.source_checkpoint_hash,
      reservation.reservation_fence_hash, reservation.reservation_effect_hash,
      reservation.origin_provenance_hash, reservation.semantic_contract_hash,
      reservation.lane_version, reservation.creator_job_id, now(),
    );
    let stored = this.readGptContinuationRecordForReservation(reservation.reservation_identity_hash);
    const isComplete = (value: GptContinuationRecord): boolean => Boolean(
      usableContinuationFromRecord(value) && gptContinuationUsable(value as StoredGptContinuation),
    );
    if (!stored) throw executionFailure("failed", "GPT_CONTINUATION_RESERVATION_CONFLICT");
    if (isComplete(stored) && sameReusableBoundary(stored, reservation)) {
      return Object.freeze({
        ...reservation,
        continuation_ref: stored.continuation_ref,
        lane_version: stored.lane_version,
        reservation_fence_hash: stored.reservation_fence_hash!,
        complete: true,
        opaque_read_grant_hash: stored.opaque_read_grant_hash,
      });
    }
    if (!sameReservation(stored, reservation)) {
      if (sameReusableBoundary(stored, reservation)) {
        throw executionFailure("failed", "GPT_CONTINUATION_RESERVATION_BUSY");
      }
      throw executionFailure("failed", "GPT_CONTINUATION_RESERVATION_CONFLICT");
    }
    if (!isComplete(stored) && stored.lane_owner_job_id === null) {
      const changed = this.database.prepare(`update production_continuations set lane_owner_job_id=?
        where reservation_identity_hash=? and lane_owner_job_id is null and provider_json is null`).run(
        reservation.creator_job_id, reservation.reservation_identity_hash,
      );
      if (changed.changes !== 1) throw executionFailure("failed", "GPT_CONTINUATION_RESERVATION_CAS_FAILED");
      stored = this.readGptContinuationRecordForReservation(reservation.reservation_identity_hash);
    }
    if (!stored || (!isComplete(stored) && stored.lane_owner_job_id !== reservation.creator_job_id)) {
      throw executionFailure("failed", "GPT_CONTINUATION_RESERVATION_BUSY");
    }
    return Object.freeze({
      ...reservation,
      complete: isComplete(stored),
      opaque_read_grant_hash: stored.opaque_read_grant_hash,
    });
  }

  public completeExactGptContinuationReservation(input: GptContinuationCompletionInput): StoredGptContinuation {
    const before = this.readGptContinuationRecordForReservation(input.reservation_identity_hash);
    if (!before) throw executionFailure("failed", "GPT_CONTINUATION_RESERVATION_MISSING");
    const semanticReceipt = input.semantic_admission_receipt;
    const expectedEvaluationHash = hashCanonical({
      kind: "exact-nested-result-contract-evaluation.v1",
      artifact_hash: input.artifact_hash,
      contract_hash: semanticReceipt.contract_hash,
      outcome: "accepted",
    });
    const semanticReceiptHash = hashCanonical(semanticReceipt);
    const expectedSemanticReceiptRef = `semantic-admission:${semanticReceiptHash.slice(7)}`;
    if (semanticReceipt.schema_version !== "exact-semantic-admission-receipt.v1"
      || semanticReceipt.artifact_ref !== input.artifact_ref
      || semanticReceipt.artifact_hash !== input.artifact_hash
      || semanticReceipt.contract_hash !== before.semantic_contract_hash
      || semanticReceipt.contract_evaluation_hash !== expectedEvaluationHash
      || semanticReceipt.outcome !== "accepted"
      || input.semantic_admission_receipt_ref !== expectedSemanticReceiptRef
      || input.semantic_admission_receipt_hash !== semanticReceiptHash) {
      throw executionFailure("failed", "GPT_CONTINUATION_SEMANTIC_ADMISSION_INVALID");
    }
    const expectedReadGrantHash = hashCanonical({
      kind: "current_artifact_read_grant.v1",
      owner_ref: before.owner_ref,
      subject_ref: before.subject_ref,
      source_artifact_ref: input.artifact_ref,
      source_artifact_hash: input.artifact_hash,
      source_checkpoint_hash: before.source_checkpoint_hash ?? hashCanonical(input.checkpoint),
      semantic_admission_receipt_ref: input.semantic_admission_receipt_ref,
      semantic_admission_receipt_hash: input.semantic_admission_receipt_hash,
    });
    const expectedCompletionReceiptHash = hashCanonical({
      kind: "gpt-continuation-completion.v1",
      reservation_identity_hash: input.reservation_identity_hash,
      continuation_ref: input.continuation_ref,
      lane_version: input.lane_version,
      reservation_fence_hash: input.reservation_fence_hash,
      conversation_identity_hash: gptContinuationIdentityHash(input.provider),
      checkpoint_hash: hashCanonical(input.checkpoint),
      artifact_ref: input.artifact_ref,
      artifact_hash: input.artifact_hash,
      semantic_admission_receipt_ref: input.semantic_admission_receipt_ref,
      semantic_admission_receipt_hash: input.semantic_admission_receipt_hash,
      opaque_read_grant_hash: input.opaque_read_grant_hash,
    });
    if (input.artifact_ref !== input.checkpoint.artifact_ref
      || input.artifact_hash !== input.checkpoint.semantic_text_hash
      || input.opaque_read_grant_hash !== expectedReadGrantHash
      || input.completion_receipt_hash !== expectedCompletionReceiptHash) {
      throw executionFailure("failed", "GPT_CONTINUATION_COMPLETION_RECEIPT_INVALID");
    }
    if (before && sameReservationCompletion(before, input)) {
      const settled = usableContinuationFromRecord(before);
      if (settled) return settled;
    }
    const changed = this.database.prepare(`update production_continuations set
      conversation_identity_hash=?,origin_provider_json=?,origin_checkpoint_json=?,
      provider_json=?,current_checkpoint_json=?,artifact_ref=?,artifact_hash=?,
      semantic_admission_receipt_ref=?,semantic_admission_receipt_hash=?,opaque_read_grant_hash=?,
      semantic_admission_receipt_json=?,completion_receipt_hash=?,lane_owner_job_id=null
      where continuation_ref=? and reservation_identity_hash=? and origin_job_id=?
        and lane_version=? and reservation_fence_hash=? and lane_owner_job_id=?
        and provider_json is null and current_checkpoint_json is null`).run(
      gptContinuationIdentityHash(input.provider), json(input.provider), json(input.checkpoint),
      json(input.provider), json(input.checkpoint), input.artifact_ref, input.artifact_hash,
      input.semantic_admission_receipt_ref, input.semantic_admission_receipt_hash,
      input.opaque_read_grant_hash, json(input.semantic_admission_receipt), input.completion_receipt_hash,
      input.continuation_ref, input.reservation_identity_hash, input.creator_job_id,
      input.lane_version, input.reservation_fence_hash, input.creator_job_id,
    );
    const record = this.readGptContinuationRecordForReservation(input.reservation_identity_hash);
    const stored = record ? usableContinuationFromRecord(record) : null;
    if ((changed.changes !== 1 && !stored) || !record || !stored || !sameReservationCompletion(record, input)) {
      throw executionFailure("failed", "GPT_CONTINUATION_COMPLETION_CAS_FAILED");
    }
    return stored;
  }

  public readGptContinuation(continuationRef: string): StoredGptContinuation | null {
    const row = this.database.prepare(`select ${GPT_CONTINUATION_SELECT}
      from production_continuations where continuation_ref=?`).get(continuationRef) as
      | GptContinuationRow | undefined;
    return row ? usableContinuationFromRecord(continuationRecordFromRow(row)) : null;
  }

  public readGptContinuationForOriginJob(
    jobId: string,
    pluginId: string,
    turnMarker: string,
  ): StoredGptContinuation | null {
    const rows = this.database.prepare(`select ${GPT_CONTINUATION_SELECT}
      from production_continuations where origin_job_id=? and plugin_id=?
        and provider_json is not null and json_extract(provider_json,'$.prior_turn_marker')=?
      order by continuation_ref limit 2`).all(jobId, pluginId, turnMarker) as GptContinuationRow[];
    if (rows.length > 1) throw executionFailure("failed", "GPT_CONTINUATION_IDENTITY_AMBIGUOUS");
    const row = rows[0];
    return row ? usableContinuationFromRecord(continuationRecordFromRow(row)) : null;
  }

  public readGptContinuationForFrontier(
    frontierRef: `sha256:${string}`,
  ): StoredGptContinuation | null {
    const rows = this.database.prepare(`select ${GPT_CONTINUATION_SELECT}
      from production_continuations where frontier_ref=? limit 2`).all(frontierRef) as GptContinuationRow[];
    if (rows.length > 1) throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_AMBIGUOUS");
    const row = rows[0];
    return row ? usableContinuationFromRecord(continuationRecordFromRow(row)) : null;
  }

  public frontierContinuationsMissingCurrentCheckpoint(): readonly StoredGptContinuation[] {
    const rows = this.database.prepare(`select ${GPT_CONTINUATION_SELECT}
      from production_continuations
      where reservation_kind='persisted' and frontier_ref is not null and current_checkpoint_json is null
      order by continuation_ref`).all() as GptContinuationRow[];
    return Object.freeze(rows.map(continuationRecordFromRow).map(usableContinuationFromRecord).filter(
      (row): row is StoredGptContinuation => row !== null,
    ));
  }

  public migrateFrontierCurrentCheckpoint(
    continuationRef: string,
    expectedProvider: GptProviderContinuation,
    checkpoint: GptContinuationCheckpoint,
  ): void {
    const changed = this.database.prepare(`update production_continuations
      set current_checkpoint_json=?
      where continuation_ref=? and current_checkpoint_json is null and provider_json=?`).run(
      json(checkpoint), continuationRef, json(expectedProvider),
    );
    if (changed.changes !== 1) {
      throw executionFailure("failed", "GPT_CONTINUATION_CUTOVER_CAS_FAILED");
    }
  }

  public acquireGptContinuationLane(continuationRef: string, ownerJobId: string): StoredGptContinuation {
    const changed = this.database.prepare(`update production_continuations
      set lane_owner_job_id=?,lane_version=case when lane_owner_job_id is null then lane_version+1 else lane_version end
      where continuation_ref=? and (lane_owner_job_id is null or lane_owner_job_id=?)
        and provider_json is not null and current_checkpoint_json is not null
        and (reservation_kind='persisted' or (artifact_ref is not null and artifact_hash is not null
          and semantic_admission_receipt_ref is not null and semantic_admission_receipt_hash is not null
          and opaque_read_grant_hash is not null and completion_receipt_hash is not null))`
    ).run(ownerJobId, continuationRef, ownerJobId);
    if (changed.changes !== 1) throw executionFailure("failed", "GPT_CONTINUATION_LANE_BUSY");
    return this.readGptContinuation(continuationRef)!;
  }

  public advanceGptContinuationLane(input: Readonly<{
    continuationRef: string;
    ownerJobId: string;
    laneVersion: number;
    pluginId: string;
    provider: GptProviderContinuation;
    currentCheckpoint: GptContinuationCheckpoint;
    conversationIdentityHash: ProductionHash;
  }>): void {
    const changed = this.database.prepare(`update production_continuations
      set plugin_id=?,conversation_identity_hash=?,provider_json=?,current_checkpoint_json=?,lane_owner_job_id=null
      where continuation_ref=? and lane_owner_job_id=? and lane_version=?`).run(
      input.pluginId, input.conversationIdentityHash, json(input.provider), json(input.currentCheckpoint), input.continuationRef,
      input.ownerJobId, input.laneVersion,
    );
    if (changed.changes !== 1) {
      throw executionFailure("failed", "GPT_CONTINUATION_ADVANCE_CAS_FAILED");
    }
  }

  public releaseGptContinuationLane(continuationRef: string, ownerJobId: string, laneVersion: number): void {
    this.database.prepare(`update production_continuations set lane_owner_job_id=null
      where continuation_ref=? and lane_owner_job_id=? and lane_version=?`
    ).run(continuationRef, ownerJobId, laneVersion);
  }

  public releaseGptContinuationLanesForJob(ownerJobId: string): number {
    const released = this.database.prepare(
      "update production_continuations set lane_owner_job_id=null where lane_owner_job_id=?",
    ).run(ownerJobId);
    return released.changes;
  }

  public stageResult(jobId: string, result: WebsiteAgentResult): void {
    WebsiteAgentResultSchema.parse(result);
    const accepted = this.readTask(jobId);
    assertResultIdentity(accepted, result);
    if (accepted!.attempt_failure) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_ALREADY_FAILED");
    }
    if (accepted!.staged_result && json(accepted!.staged_result) !== json(result)) {
      throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_CONFLICT");
    }
    const changed = this.database.prepare(`update production_tasks
      set staged_result_json=?,current_reason='BUSINESS_ADMISSION_PENDING',updated_at=?
      where job_id=? and status='failed'`).run(json(result), now(), jobId);
    if (changed.changes !== 1) {
      throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_TERMINAL_CONFLICT");
    }
  }

  public completeTask(jobId: string, result: WebsiteAgentResult): void {
    WebsiteAgentResultSchema.parse(result);
    assertResultIdentity(this.readTask(jobId), result);
    const changed = this.database.prepare(`update production_tasks set status='completed',current_reason=null,
      result_json=?,staged_result_json=null,updated_at=?
      where job_id=? and status='failed'`).run(
      json(result), now(), jobId,
    );
    if (changed.changes === 0 && !sameCompletion(this.readTask(jobId), result)) {
      throw executionFailure("failed", "PRODUCTION_TASK_COMPLETION_CONFLICT");
    }
  }

  public pendingBusinessAdmissions(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(`select task_json,identity_json,status,result_json,staged_result_json,
      current_attempt_id,current_reason,updated_at,(select f.failure_json from production_attempt_failures f
        where f.job_id=production_tasks.job_id and f.attempt_id=production_tasks.current_attempt_id)
        as attempt_failure_json from production_tasks
      where status='failed' and staged_result_json is not null order by updated_at,job_id`).all() as TaskRow[];
    return rows.map(storedTaskFromRow);
  }

  public setCurrentReason(jobId: string, reason: string): void {
    this.database.prepare(
      "update production_tasks set current_reason=?,updated_at=? where job_id=? and status='failed'",
    ).run(reason.slice(0, 1_000), now(), jobId);
  }

  public recordAttemptFailure(jobId: string, attemptId: string, failure: SerializedExecutionFailure): void {
    if (!isSerializedTerminalFailure(failure)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_INVALID");
    }
    const existing = this.database.prepare(
      "select current_attempt_id from production_tasks where job_id=? and status='failed'",
    ).get(jobId) as { current_attempt_id: string } | undefined;
    if (!existing || existing.current_attempt_id !== attemptId) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IDENTITY_MISMATCH");
    }
    const serialized = json(failure);
    const first = this.database.prepare(`select failure_json from production_attempt_failures
      where job_id=? and attempt_id=?`
    ).get(jobId, attemptId) as { failure_json: string } | undefined;
    if (first && first.failure_json !== serialized) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE");
    }
    this.database.transaction(() => {
      this.database.prepare(`insert into production_attempt_failures(job_id,attempt_id,failure_json,created_at)
        values(?,?,?,?) on conflict(job_id,attempt_id) do nothing`).run(
        jobId, attemptId, serialized, now(),
      );
      this.database.prepare(`update production_tasks set current_reason=?,updated_at=?
        where job_id=? and status='failed'`).run(failure.code.slice(0, 1_000), now(), jobId);
    })();
  }

  protected removeRejectedCheckpointFalseFailure(input: Readonly<{
    jobId: string;
    attemptId: string;
    failure: SerializedExecutionFailure;
  }>): void {
    if (!isRejectedCheckpointSequenceFailure(input.failure)) {
      throw executionFailure("failed", "PRODUCTION_RECOVERY_FAILURE_SHAPE_MISMATCH");
    }
    const task = this.database.prepare(`select current_attempt_id from production_tasks
      where job_id=? and status='failed'`).get(input.jobId) as { current_attempt_id: string } | undefined;
    if (!task || task.current_attempt_id !== input.attemptId) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_AUTHORITY_CONFLICT");
    }
    const changed = this.database.prepare(`delete from production_attempt_failures
      where job_id=? and attempt_id=? and failure_json=?`).run(
      input.jobId, input.attemptId, json(input.failure),
    );
    if (changed.changes !== 1) throw executionFailure("failed", "PRODUCTION_ATTEMPT_AUTHORITY_CONFLICT");
    this.database.prepare(`update production_tasks set current_reason='REMOTE_CHECKPOINT_PREFIX_RECONCILED',
      updated_at=? where job_id=? and status='failed'`).run(now(), input.jobId);
  }

  public recordCheckpoint(authority: ProductionCheckpointAuthority): ProductionCheckpointAuthority {
    const task = this.readTask(authority.jobId);
    if (!task || task.status !== "failed" || task.current_attempt_id !== authority.attemptId) {
      throw executionFailure("failed", "PRODUCTION_CHECKPOINT_ATTEMPT_IDENTITY_MISMATCH");
    }
    this.database.prepare(`insert into production_checkpoints(
      job_id,attempt_id,checkpoint_id,checkpoint_hash,state,updated_at
    ) values(?,?,?,?,?,?) on conflict(job_id) do update set
      attempt_id=excluded.attempt_id,checkpoint_id=excluded.checkpoint_id,
      checkpoint_hash=excluded.checkpoint_hash,state=excluded.state,updated_at=excluded.updated_at`).run(
      authority.jobId, authority.attemptId, authority.checkpointId, authority.checkpointHash, authority.state, now(),
    );
    return this.readCheckpoint(authority.jobId)!;
  }

  public readCheckpoint(jobId: string): ProductionCheckpointAuthority | null {
    const row = this.database.prepare(`select job_id,attempt_id,checkpoint_id,checkpoint_hash,state
      from production_checkpoints where job_id=?`).get(jobId) as Readonly<{
      job_id: string; attempt_id: string; checkpoint_id: string | null;
      checkpoint_hash: ProductionHash | null; state: ProductionCheckpointAuthority["state"];
    }> | undefined;
    return row ? Object.freeze({
      jobId: row.job_id, attemptId: row.attempt_id, checkpointId: row.checkpoint_id,
      checkpointHash: row.checkpoint_hash, state: row.state,
    }) : null;
  }

  public recordLease(authority: ProductionLeaseAuthority): ProductionLeaseAuthority {
    const task = this.readTask(authority.jobId);
    if (!task || task.status !== "failed" || task.current_attempt_id !== authority.attemptId) {
      throw executionFailure("failed", "PRODUCTION_LEASE_ATTEMPT_IDENTITY_MISMATCH");
    }
    const existing = this.readLease(authority.jobId);
    if (existing?.attemptId === authority.attemptId && authority.leaseVersion < existing.leaseVersion) {
      throw executionFailure("failed", "PRODUCTION_LEASE_VERSION_REGRESSION");
    }
    this.database.prepare(`insert into production_leases(
      job_id,attempt_id,lease_version,fence_hash,state,expires_at,updated_at
    ) values(?,?,?,?,?,?,?) on conflict(job_id) do update set
      attempt_id=excluded.attempt_id,lease_version=excluded.lease_version,
      fence_hash=excluded.fence_hash,state=excluded.state,
      expires_at=excluded.expires_at,updated_at=excluded.updated_at`).run(
      authority.jobId, authority.attemptId, authority.leaseVersion, authority.fenceHash,
      authority.state, authority.expiresAt, now(),
    );
    return this.readLease(authority.jobId)!;
  }

  public readLease(jobId: string): ProductionLeaseAuthority | null {
    const row = this.database.prepare(`select job_id,attempt_id,lease_version,fence_hash,state,expires_at
      from production_leases where job_id=?`).get(jobId) as Readonly<{
      job_id: string; attempt_id: string; lease_version: number; fence_hash: ProductionHash;
      state: ProductionLeaseAuthority["state"]; expires_at: string | null;
    }> | undefined;
    return row ? Object.freeze({
      jobId: row.job_id, attemptId: row.attempt_id, leaseVersion: row.lease_version,
      fenceHash: row.fence_hash, state: row.state, expiresAt: row.expires_at,
    }) : null;
  }
}
