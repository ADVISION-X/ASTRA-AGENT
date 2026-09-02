import { executionFailure } from "../../typed-failure.js";
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
import { hashCanonical, type ProductionHash } from "./contracts.js";
import {
  ProductionStoreFoundation,
  json,
  now,
  type StoredProductionTask,
} from "./store-foundation.js";

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

const sameCompletionIdentity = (
  stored: GptContinuationRecord,
  input: GptContinuationCompletionInput,
): boolean => stored.continuation_ref === input.continuation_ref
  && stored.reservation_identity_hash === input.reservation_identity_hash
  && stored.origin_job_id === input.creator_job_id
  && stored.lane_version === input.lane_version
  && stored.reservation_fence_hash === input.reservation_fence_hash
  && stored.conversation_identity_hash === gptContinuationIdentityHash(input.provider)
  && json(stored.origin_provider) === json(input.provider)
  && json(stored.provider) === json(input.provider);

const sameCompletionEvidence = (
  stored: GptContinuationRecord,
  input: GptContinuationCompletionInput,
): boolean => json(stored.origin_checkpoint) === json(input.checkpoint)
  && json(stored.current_checkpoint) === json(input.checkpoint)
  && stored.artifact_ref === input.artifact_ref
  && stored.artifact_hash === input.artifact_hash
  && stored.semantic_admission_receipt_ref === input.semantic_admission_receipt_ref
  && stored.semantic_admission_receipt_hash === input.semantic_admission_receipt_hash
  && json(stored.semantic_admission_receipt) === json(input.semantic_admission_receipt)
  && stored.opaque_read_grant_hash === input.opaque_read_grant_hash
  && stored.completion_receipt_hash === input.completion_receipt_hash
  && stored.lane_owner_job_id === null;

const sameReservationCompletion = (
  stored: GptContinuationRecord,
  input: GptContinuationCompletionInput,
): boolean => sameCompletionIdentity(stored, input) && sameCompletionEvidence(stored, input);

const assertCompletionReceipts = (
  before: GptContinuationRecord,
  input: GptContinuationCompletionInput,
): void => {
  const semanticReceipt = input.semantic_admission_receipt;
  const semanticReceiptHash = hashCanonical(semanticReceipt);
  const expectedEvaluationHash = hashCanonical({
    kind: "exact-nested-result-contract-evaluation.v1",
    artifact_hash: input.artifact_hash,
    contract_hash: semanticReceipt.contract_hash,
    outcome: "accepted",
  });
  if (semanticReceipt.schema_version !== "exact-semantic-admission-receipt.v1"
    || semanticReceipt.artifact_ref !== input.artifact_ref
    || semanticReceipt.artifact_hash !== input.artifact_hash
    || semanticReceipt.contract_hash !== before.semantic_contract_hash
    || semanticReceipt.contract_evaluation_hash !== expectedEvaluationHash
    || semanticReceipt.outcome !== "accepted"
    || input.semantic_admission_receipt_ref !== `semantic-admission:${semanticReceiptHash.slice(7)}`
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
};


export abstract class ProductionStoreContinuationState extends ProductionStoreFoundation {
  public abstract readTask(jobId: string): StoredProductionTask | null;

  private readGptContinuationRecordForReservation(
    reservationIdentityHash: `sha256:${string}`,
  ): GptContinuationRecord | null {
    const row = this.database.prepare(`select ${GPT_CONTINUATION_SELECT}
      from production_continuations where reservation_identity_hash=?`).get(reservationIdentityHash) as
      | GptContinuationRow | undefined;
    return row ? continuationRecordFromRow(row) : null;
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
    assertCompletionReceipts(before, input);
    if (sameReservationCompletion(before, input)) {
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

}
