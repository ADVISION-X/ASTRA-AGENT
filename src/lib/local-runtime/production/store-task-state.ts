import type { SerializedExecutionFailure } from "../../typed-failure.js";
import { executionFailure } from "../../typed-failure.js";
import {
  GPT_TURN_FLOW_VERSION,
  type GptChildCapabilityId,
  type GptProviderContinuation,
  type StoredGptContinuation,
} from "../../../capabilities/gpt/index.js";
import type { DurablePluginIdentity, WebsiteAgentResult, WebsiteAgentTask } from "./contracts.js";
import { WebsiteAgentResultSchema, type ProductionHash } from "./contracts.js";
import type { ProviderTurnResult } from "./plugin.js";
import type { GptTurnStateSnapshot } from "./gpt-turn-state.js";
import {
  ProductionStoreFoundation,
  isSerializedTerminalFailure,
  json,
  now,
  storedTaskFromRow,
  type ProductionCheckpointAuthority,
  type ProductionLeaseAuthority,
  type ProductionTaskStatus,
  type StepRow,
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
    throw executionFailure("review_required", "PRODUCTION_RESULT_DURABLE_IDENTITY_MISMATCH");
  }
};

const sameTerminal = (
  existing: StoredProductionTask | null,
  status: Extract<ProductionTaskStatus, "completed" | "failed">,
  failure: SerializedExecutionFailure | null,
  result: WebsiteAgentResult | null,
): boolean => Boolean(existing && existing.status === status
  && json(existing.result) === json(result) && json(existing.failure) === json(failure));

export type GptTurnDurableCheckpoint = Readonly<{
  schema_version: "gpt-turn-checkpoint.v2";
  flow_version: typeof GPT_TURN_FLOW_VERSION;
  input_hash: ProductionHash;
  step_index: number;
  child_capability_id: GptChildCapabilityId;
  status: "success" | "failed";
  mutation_state: "no" | "dispatched" | "confirmed";
  postcondition_result: "passed" | "failed" | "pending";
  evidence_ref: string;
  evidence_hash: ProductionHash;
  provider_dispatch_used: boolean;
  state: GptTurnStateSnapshot;
  result: ProviderTurnResult | null;
}>;

const checkpointIdentityValid = (parsed: Partial<GptTurnDurableCheckpoint>): boolean =>
  parsed.schema_version === "gpt-turn-checkpoint.v2"
  && parsed.flow_version === GPT_TURN_FLOW_VERSION
  && typeof parsed.input_hash === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(parsed.input_hash)
  && Number.isSafeInteger(parsed.step_index)
  && (parsed.step_index as number) >= 0
  && typeof parsed.child_capability_id === "string";

const checkpointProgressValid = (parsed: Partial<GptTurnDurableCheckpoint>): boolean =>
  (parsed.status === "success" || parsed.status === "failed")
  && ["no", "dispatched", "confirmed"].includes(String(parsed.mutation_state))
  && ["passed", "failed", "pending"].includes(String(parsed.postcondition_result))
  && typeof parsed.provider_dispatch_used === "boolean";

const checkpointEvidenceValid = (parsed: Partial<GptTurnDurableCheckpoint>): boolean =>
  typeof parsed.evidence_ref === "string"
  && parsed.evidence_ref.length > 0
  && typeof parsed.evidence_hash === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(parsed.evidence_hash)
  && Boolean(parsed.state)
  && typeof parsed.state === "object"
  && !Array.isArray(parsed.state);

const parseGptTurnCheckpoint = (value: string): GptTurnDurableCheckpoint => {
  const parsed = JSON.parse(value) as Partial<GptTurnDurableCheckpoint>;
  if (!checkpointIdentityValid(parsed) || !checkpointProgressValid(parsed) || !checkpointEvidenceValid(parsed)) {
    throw executionFailure("review_required", "GPT_TURN_CHECKPOINT_INVALID");
  }
  return parsed as GptTurnDurableCheckpoint;
};

export abstract class ProductionStoreTaskState extends ProductionStoreFoundation {
  public acceptTask(task: WebsiteAgentTask, identity: DurablePluginIdentity): StoredProductionTask {
    const existing = this.readTask(task.job_id);
    if (existing) {
      if (existing.task.request_hash !== task.request_hash) {
        throw executionFailure("review_required", "PRODUCTION_TASK_REQUEST_HASH_CONFLICT");
      }
      if (json(existing.identity) !== json(identity)) {
        throw executionFailure("review_required", "PLUGIN_IDENTITY_CHANGED_BEFORE_RECOVERY");
      }
      return existing;
    }
    const timestamp = now();
    this.database.prepare(`insert into production_tasks(
      job_id,request_hash,task_json,identity_json,status,created_at,updated_at
    ) values(?,?,?,?,?,?,?)`).run(
      task.job_id, task.request_hash, json(task), json(identity), "accepted", timestamp, timestamp,
    );
    return this.readTask(task.job_id)!;
  }

  public readTask(jobId: string): StoredProductionTask | null {
    const row = this.database.prepare(
      "select task_json,identity_json,status,result_json,staged_result_json,failure_json,failure_reason,updated_at from production_tasks where job_id=?",
    ).get(jobId) as TaskRow | undefined;
    return row ? storedTaskFromRow(row) : null;
  }

  public taskAuthorities(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(
      "select task_json,identity_json,status,result_json,staged_result_json,failure_json,failure_reason,updated_at from production_tasks order by updated_at,job_id",
    ).all() as TaskRow[];
    return rows.map(storedTaskFromRow);
  }

  public markRunning(jobId: string): void {
    this.database.prepare(
      "update production_tasks set status='running',failure_reason=null,updated_at=? where job_id=? and status in ('accepted','recovery_pending')",
    ).run(now(), jobId);
  }

  public readGptTurnCheckpoint(
    jobId: string,
    stepId: string,
    inputHash: ProductionHash,
  ): GptTurnDurableCheckpoint | null {
    const row = this.database.prepare(
      "select input_hash,result_json from production_steps where job_id=? and step_id=?",
    ).get(jobId, stepId) as StepRow | undefined;
    if (!row) return null;
    if (row.input_hash !== inputHash) {
      throw executionFailure("review_required", `PLUGIN_CHECKPOINT_INPUT_DRIFT:${stepId}`);
    }
    const checkpoint = parseGptTurnCheckpoint(row.result_json);
    if (checkpoint.input_hash !== inputHash) {
      throw executionFailure("review_required", `PLUGIN_CHECKPOINT_INPUT_DRIFT:${stepId}`);
    }
    return checkpoint;
  }

  public writeGptTurnCheckpoint(
    jobId: string,
    stepId: string,
    checkpoint: GptTurnDurableCheckpoint,
  ): void {
    const existing = this.readGptTurnCheckpoint(jobId, stepId, checkpoint.input_hash);
    if (existing && (existing.step_index > checkpoint.step_index
      || (existing.step_index === checkpoint.step_index
        && existing.status === "success" && checkpoint.status === "failed")
      || (existing.result && checkpoint.result && json(existing.result) !== json(checkpoint.result)))) {
      throw executionFailure("review_required", `GPT_TURN_CHECKPOINT_REGRESSION:${stepId}`);
    }
    this.database.prepare(`insert into production_steps(
      job_id,step_id,input_hash,result_json,completed_at
    ) values(?,?,?,?,?) on conflict(job_id,step_id) do update set
      input_hash=excluded.input_hash,result_json=excluded.result_json,completed_at=excluded.completed_at`
    ).run(jobId, stepId, checkpoint.input_hash, json(checkpoint), now());
    const readback = this.readGptTurnCheckpoint(jobId, stepId, checkpoint.input_hash);
    if (!readback || json(readback) !== json(checkpoint)) {
      throw executionFailure("review_required", `GPT_TURN_CHECKPOINT_READBACK_INVALID:${stepId}`);
    }
  }

  public countGptProviderDispatches(jobId: string): number {
    const rows = this.database.prepare(
      "select result_json from production_steps where job_id=?",
    ).all(jobId) as Array<{ result_json: string }>;
    return rows.reduce(
      (count, row) => count + (parseGptTurnCheckpoint(row.result_json).provider_dispatch_used ? 1 : 0),
      0,
    );
  }

  public createGptContinuation(continuation: StoredGptContinuation): void {
    this.database.prepare(`insert into production_continuations(
      continuation_ref,origin_job_id,plugin_id,owner_ref,subject_ref,authorization_ref,
      conversation_identity_hash,provider_json,lane_version,lane_owner_job_id,created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?)`).run(
      continuation.continuation_ref, continuation.origin_job_id, continuation.plugin_id,
      continuation.owner_ref, continuation.subject_ref, continuation.authorization_ref,
      continuation.conversation_identity_hash, json(continuation.provider), continuation.lane_version,
      continuation.lane_owner_job_id, now(),
    );
  }

  public readGptContinuation(continuationRef: string): StoredGptContinuation | null {
    const row = this.database.prepare(`select continuation_ref,origin_job_id,plugin_id,owner_ref,subject_ref,
      authorization_ref,conversation_identity_hash,provider_json,lane_version,lane_owner_job_id
      from production_continuations where continuation_ref=?`).get(continuationRef) as
      | (Omit<StoredGptContinuation, "provider"> & { provider_json: string }) | undefined;
    return row ? { ...row, provider: JSON.parse(row.provider_json) as GptProviderContinuation } : null;
  }

  public acquireGptContinuationLane(continuationRef: string, ownerJobId: string): StoredGptContinuation {
    const changed = this.database.prepare(`update production_continuations
      set lane_owner_job_id=?,lane_version=case when lane_owner_job_id is null then lane_version+1 else lane_version end
      where continuation_ref=? and (lane_owner_job_id is null or lane_owner_job_id=?)`
    ).run(ownerJobId, continuationRef, ownerJobId);
    if (changed.changes !== 1) throw executionFailure("review_required", "GPT_CONTINUATION_LANE_BUSY");
    return this.readGptContinuation(continuationRef)!;
  }

  public advanceGptContinuationLane(input: Readonly<{
    continuationRef: string;
    ownerJobId: string;
    laneVersion: number;
    pluginId: string;
    provider: GptProviderContinuation;
    conversationIdentityHash: ProductionHash;
  }>): void {
    const changed = this.database.prepare(`update production_continuations
      set plugin_id=?,conversation_identity_hash=?,provider_json=?,lane_owner_job_id=null
      where continuation_ref=? and lane_owner_job_id=? and lane_version=?`).run(
      input.pluginId, input.conversationIdentityHash, json(input.provider), input.continuationRef,
      input.ownerJobId, input.laneVersion,
    );
    if (changed.changes !== 1) {
      throw executionFailure("review_required", "GPT_CONTINUATION_ADVANCE_CAS_FAILED");
    }
  }

  public releaseGptContinuationLane(continuationRef: string, ownerJobId: string, laneVersion: number): void {
    this.database.prepare(`update production_continuations set lane_owner_job_id=null
      where continuation_ref=? and lane_owner_job_id=? and lane_version=?`
    ).run(continuationRef, ownerJobId, laneVersion);
  }

  public stageResult(jobId: string, result: WebsiteAgentResult): void {
    WebsiteAgentResultSchema.parse(result);
    const accepted = this.readTask(jobId);
    assertResultIdentity(accepted, result);
    if (accepted!.staged_result && json(accepted!.staged_result) !== json(result)) {
      throw executionFailure("review_required", "PRODUCTION_STAGED_RESULT_CONFLICT");
    }
    const changed = this.database.prepare(`update production_tasks set staged_result_json=?,updated_at=?
      where job_id=? and status not in ('completed','review_required','failed','cancelled')`
    ).run(json(result), now(), jobId);
    if (changed.changes !== 1) {
      throw executionFailure("review_required", "PRODUCTION_STAGED_RESULT_TERMINAL_CONFLICT");
    }
  }

  public setTerminal(
    jobId: string,
    status: Extract<ProductionTaskStatus, "completed" | "failed">,
    failure: SerializedExecutionFailure | null,
    result: WebsiteAgentResult | null,
  ): void {
    if (status === "completed") {
      if (!result) throw new Error("PRODUCTION_COMPLETED_RESULT_REQUIRED");
      WebsiteAgentResultSchema.parse(result);
      assertResultIdentity(this.readTask(jobId), result);
      if (failure) throw new Error("PRODUCTION_COMPLETED_FAILURE_FORBIDDEN");
    } else if (result) throw new Error("PRODUCTION_NONCOMPLETED_RESULT_FORBIDDEN");
    else if (!isSerializedTerminalFailure(failure)) throw new Error("PRODUCTION_TYPED_TERMINAL_FAILURE_REQUIRED");
    const changed = this.database.prepare(`update production_tasks set status=?,failure_json=?,failure_reason=?,
      result_json=?,staged_result_json=null,updated_at=?
      where job_id=? and status not in ('completed','review_required','failed','cancelled')`).run(
      status, failure ? json(failure) : null, failure?.code ?? null, result ? json(result) : null, now(), jobId,
    );
    if (changed.changes === 0 && !sameTerminal(this.readTask(jobId), status, failure, result)) {
      throw executionFailure("review_required", "PRODUCTION_TASK_FIRST_TERMINAL_CONFLICT");
    }
  }

  public setRecoveryPending(jobId: string, reason: string): void {
    this.database.prepare(
      "update production_tasks set status='recovery_pending',failure_json=null,failure_reason=?,updated_at=? where job_id=? and status in ('accepted','running','recovery_pending')",
    ).run(reason.slice(0, 1_000), now(), jobId);
  }

  public recordCheckpoint(authority: ProductionCheckpointAuthority): ProductionCheckpointAuthority {
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
