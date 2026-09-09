import { executionFailure, failureCode, typedExecutionFailure } from "../../execution-failure.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";
import { terminalFailureHttpStatus } from "./terminal-failure.js";
import { hashCanonical, parseTerminalReceipt, parseTerminalReceiptExpectation, type ProductionHash } from "./contracts.js";
import {
  assertReceiptIdentity,
  isRejectedCheckpointSequenceFailure,
  parseRecoveryCheckpointIntent,
  proveRecoveryCheckpointPrefix,
  type LocalReceiptIntent,
  type RecoveryCheckpointPrefix,
  type RecoveryOutboxRow,
  type RemoteReceipt,
} from "./store-outbox-recovery-proof.js";
import { ProductionStoreTaskState } from "./store-task-state.js";
import { productionOutboxAuthorityFromRow } from "./store-authority-validation.js";
import {
  json,
  now,
  type ProductionOutboxAuthority,
  type ProductionOutboxAuthorityRow,
  type ProductionOutboxWrite,
} from "./store-foundation.js";

const OUTBOX_TRANSIENT_RETRY_DELAY_MS = 5_000;
const OUTBOX_LOW_FREQUENCY_RETRY_DELAY_MS = 3_600_000;
const PERMANENT_REVOCATION_REASON = "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED";
const PERMANENT_AUTHORIZATION_REVOKED_CODE = "AI_PERMANENT_AUTHORIZATION_REVOKED";
const STALE_LEASE_FENCE_CODE = "AI_LEASE_FENCE_STALE";
const STALE_LEASE_FENCE_REMOTE_PROOF = "WEBSITE_HTTP_409:AI_LEASE_FENCE_STALE";
const jobPathMarker = (jobId: string): string => `/jobs/${encodeURIComponent(jobId)}/`;
const checkpointPath = (jobId: string): string =>
  `/internal/ai-production/v6/jobs/${encodeURIComponent(jobId)}/checkpoints`;

const retryDelay = (error: unknown): number => {
  const httpStatus = terminalFailureHttpStatus(error);
  if (httpStatus === 409 && failureCode(error) === PERMANENT_AUTHORIZATION_REVOKED_CODE) {
    return OUTBOX_TRANSIENT_RETRY_DELAY_MS;
  }
  return httpStatus !== null && httpStatus >= 400 && httpStatus <= 499
    ? OUTBOX_LOW_FREQUENCY_RETRY_DELAY_MS : OUTBOX_TRANSIENT_RETRY_DELAY_MS;
};

const receiptHashOf = (response: Record<string, unknown>): ProductionHash | null =>
  typeof response.receipt_hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(response.receipt_hash)
    ? response.receipt_hash as ProductionHash : null;

const assertTerminalReceipt = (local: LocalReceiptIntent, response: Record<string, unknown>): void => {
  if (local.kind !== "terminal") return;
  const request = JSON.parse(local.body_blob.toString("utf8")) as Record<string, unknown>;
  if (request.terminal_status === "completed") {
    parseTerminalReceipt(response, parseTerminalReceiptExpectation(request));
    return;
  }
  throw executionFailure("failed", "PRODUCTION_FAILED_COMPLETION_RETIRED");
};

export abstract class ProductionStoreOutbox extends ProductionStoreTaskState {
  private readPendingOutboxWrite(idempotencyKey: string): ProductionOutboxWrite {
    const row = this.database.prepare(`select idempotency_key,kind,path,method,headers_json,body_blob
      from production_outbox where idempotency_key=? and sent_at is null`
    ).get(idempotencyKey) as Readonly<{
      idempotency_key: string; kind: ProductionOutboxWrite["kind"]; path: string;
      method: ProductionOutboxWrite["method"]; headers_json: string; body_blob: Buffer;
    }> | undefined;
    if (!row) throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
    return Object.freeze({
      idempotency_key: row.idempotency_key,
      kind: row.kind,
      path: row.path,
      method: row.method,
      headers: Object.freeze(JSON.parse(row.headers_json) as Record<string, string>),
      body: row.body_blob,
    });
  }
  private serializeOutboxOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.outboxDeliveryTail.then(operation, operation);
    this.outboxDeliveryTail = result.then(() => undefined, () => undefined);
    return result;
  }

  public enqueue(write: ProductionOutboxWrite): void {
    const bytes = Buffer.from(write.body);
    const headers = json(write.headers);
    const existing = this.database.prepare(`select kind,path,method,headers_json,body_blob
      from production_outbox where idempotency_key=?`).get(write.idempotency_key) as Readonly<{
      kind: string; path: string; method: string; headers_json: string; body_blob: Buffer;
    }> | undefined;
    if (existing) {
      if (existing.kind !== write.kind || existing.path !== write.path || existing.method !== write.method
        || existing.headers_json !== headers || !existing.body_blob.equals(bytes)) {
        throw executionFailure("failed", "PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT");
      }
      this.notifyOutbox(this.readOutboxAuthority(write.idempotency_key));
      return;
    }
    this.database.prepare(`insert into production_outbox(
      idempotency_key,kind,path,method,headers_json,body_blob,created_at
    ) values(?,?,?,?,?,?,?)`).run(
      write.idempotency_key, write.kind, write.path, write.method, headers, bytes, now(),
    );
    this.notifyOutbox(this.readOutboxAuthority(write.idempotency_key));
  }

  public pendingOutbox(observedAt = now()): readonly ProductionOutboxWrite[] {
    const rows = this.database.prepare(
      `select idempotency_key,kind,path,method,headers_json,body_blob from production_outbox
       where sent_at is null
         and (last_error is null or (next_delivery_at is not null and next_delivery_at<=?))
       order by created_at,idempotency_key`,
    ).all(observedAt) as Array<{
      idempotency_key: string; kind: ProductionOutboxWrite["kind"]; path: string;
      method: ProductionOutboxWrite["method"]; headers_json: string; body_blob: Buffer;
    }>;
    return rows.map((row) => ({
      idempotency_key: row.idempotency_key, kind: row.kind, path: row.path, method: row.method,
      headers: JSON.parse(row.headers_json) as Record<string, string>, body: row.body_blob,
    }));
  }

  public markOutboxSent(idempotencyKey: string, response: unknown): void {
    const transaction = this.database.transaction(() => {
      const existing = this.database.prepare(`select kind,body_blob,sent_at,response_json,response_hash
        from production_outbox where idempotency_key=?`).get(idempotencyKey) as Readonly<{
        kind: ProductionOutboxWrite["kind"]; body_blob: Buffer; sent_at: string | null;
        response_json: string | null; response_hash: string | null;
      }> | undefined;
      if (!existing) throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
      const validated = existing.kind === "terminal" ? parseTerminalReceipt(
        response, parseTerminalReceiptExpectation(existing.body_blob.toString("utf8")),
      ) : response;
      const responseJson = json(validated);
      const responseHash = hashCanonical(validated);
      const receiptHash = validated && typeof validated === "object" && !Array.isArray(validated)
        ? receiptHashOf(validated as Record<string, unknown>) : null;
      if (existing.sent_at) {
        if (existing.response_json !== responseJson || existing.response_hash !== responseHash) {
          throw executionFailure("failed", "PRODUCTION_OUTBOX_RESPONSE_CONFLICT");
        }
        return;
      }
      this.database.prepare(`update production_outbox set response_json=?,response_hash=?,receipt_hash=?,
        sent_at=?,last_error=null,next_delivery_at=null
        where idempotency_key=? and sent_at is null`
      ).run(responseJson, responseHash, receiptHash, now(), idempotencyKey);
    });
    transaction();
    this.notifyOutbox(this.readOutboxAuthority(idempotencyKey));
  }

  public readOutboxResponse(idempotencyKey: string): unknown | null {
    const row = this.database.prepare(
      "select response_json from production_outbox where idempotency_key=?",
    ).get(idempotencyKey) as { response_json: string | null } | undefined;
    return row?.response_json ? JSON.parse(row.response_json) as unknown : null;
  }

  public unreconciledOutboxJobIds(observedAt = now()): readonly string[] {
    const rows = this.database.prepare(`select path from production_outbox
      where sent_at is null and response_hash is null
        and (last_error is null or (next_delivery_at is not null and next_delivery_at<=?))
      order by created_at,idempotency_key`).all(observedAt) as Array<{ path: string }>;
    const jobIds = rows.map((row) => /\/jobs\/([^/]+)\//u.exec(row.path)?.[1])
      .filter((jobId): jobId is string => Boolean(jobId)).map(decodeURIComponent);
    return Object.freeze([...new Set(jobIds)]);
  }

  public hasUnsentOutbox(jobId: string): boolean {
    return Boolean(this.database.prepare(`select 1 from production_outbox
      where instr(path,?)>0 and sent_at is null
        and (last_error is null or next_delivery_at is not null) limit 1`
    ).get(jobPathMarker(jobId)));
  }

  public scheduledCheckpointFailure(input: Readonly<{
    jobId: string;
    attemptId: string;
    checkpointSeq: number;
    checkpointKind: string;
    attemptFailure: unknown;
  }>): string | null {
    const rows = this.database.prepare(`select body_blob,last_error from production_outbox
      where kind='checkpoint' and instr(path,?)>0 and sent_at is null and response_hash is null
        and last_error is not null and next_delivery_at is not null order by created_at,idempotency_key`
    ).all(jobPathMarker(input.jobId)) as Array<{
      body_blob: Buffer; last_error: string;
    }>;
    for (const row of rows) {
      const body = JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>;
      if (body.job_id === input.jobId && body.attempt_id === input.attemptId
        && body.checkpoint_seq === input.checkpointSeq && body.checkpoint_kind === input.checkpointKind
        && json(body.attempt_failure) === json(input.attemptFailure)) return row.last_error;
    }
    return null;
  }

  private hydrateOne(jobId: string, receipt: RemoteReceipt): boolean {
    const local = this.database.prepare(`select kind,path,headers_json,body_blob,response_json,response_hash
      from production_outbox where idempotency_key=?`).get(receipt.request_id) as LocalReceiptIntent | undefined;
    if (!local) return false;
    assertReceiptIdentity(jobId, local, receipt);
    const responseJson = json(receipt.response_json);
    const responseHash = hashCanonical(receipt.response_json);
    if (Boolean(local.response_json) !== Boolean(local.response_hash)) {
      throw executionFailure("failed", "PRODUCTION_OUTBOX_RESPONSE_CONFLICT");
    }
    if (local.response_hash && local.response_json) {
      let localResponse: unknown;
      try { localResponse = JSON.parse(local.response_json) as unknown; }
      catch { throw executionFailure("failed", "PRODUCTION_OUTBOX_RESPONSE_CONFLICT"); }
      if (hashCanonical(localResponse) !== local.response_hash || local.response_hash !== responseHash) {
        throw executionFailure("failed", "PRODUCTION_OUTBOX_RESPONSE_CONFLICT");
      }
      return false;
    }
    assertTerminalReceipt(local, receipt.response_json);
    this.database.prepare(`update production_outbox set response_json=?,response_hash=?,receipt_hash=?,
      sent_at=coalesce(sent_at,?),last_error=null,next_delivery_at=null
      where idempotency_key=? and response_hash is null`).run(
      responseJson, responseHash, receiptHashOf(receipt.response_json), now(), receipt.request_id,
    );
    return true;
  }

  public hydrateRemoteOutboxReceipts(jobId: string, receipts: readonly RemoteReceipt[]): number {
    const transaction = this.database.transaction(() => {
      let hydrated = 0;
      for (const receipt of receipts) if (this.hydrateOne(jobId, receipt)) hydrated += 1;
      return hydrated;
    });
    return transaction();
  }

  private reauthorizeStaleCheckpoint(input: Readonly<{ jobId: string; attemptId: string; workerSessionId: string;
    workerSessionEpoch: number; leaseVersion: number; fenceHash: ProductionHash;
    receipts: readonly RemoteReceipt[];
  }>): ProductionOutboxWrite | null {
    if (!input.workerSessionId || !Number.isInteger(input.workerSessionEpoch)
      || input.workerSessionEpoch < 1 || !Number.isInteger(input.leaseVersion)
      || input.leaseVersion < 1 || !/^sha256:[a-f0-9]{64}$/u.test(input.fenceHash)) {
      throw executionFailure("failed", "PRODUCTION_STALE_FENCE_AUTHORITY_INVALID");
    }
    this.hydrateRemoteOutboxReceipts(input.jobId, input.receipts);
    const transaction = this.database.transaction(() => {
      const task = this.readTask(input.jobId);
      if (!task || task.status !== "failed" || task.current_attempt_id !== input.attemptId
        || task.staged_result !== null) {
        throw executionFailure("failed", "PRODUCTION_STALE_FENCE_TASK_AUTHORITY_CONFLICT");
      }
      type Candidate = RecoveryOutboxRow & Readonly<{ method: ProductionOutboxWrite["method"] }>;
      const rows = this.database.prepare(`select idempotency_key,kind,path,method,headers_json,body_blob,
        sent_at,last_error,response_json,response_hash,next_delivery_at from production_outbox
        where kind='checkpoint' and instr(path,?)>0 and sent_at is null and response_hash is null
          and last_error=? and next_delivery_at is null order by created_at,idempotency_key`
      ).all(jobPathMarker(input.jobId), STALE_LEASE_FENCE_REMOTE_PROOF) as Candidate[];
      const candidates = rows.filter((row) => {
        const body = JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>;
        return body.attempt_id === input.attemptId;
      });
      if (candidates.length === 0) return null;
      if (candidates.length !== 1) {
        throw executionFailure("failed", "PRODUCTION_STALE_FENCE_INTENT_AMBIGUOUS");
      }
      const row = candidates[0]!;
      const body = parseRecoveryCheckpointIntent(input.jobId, input.attemptId, row);
      let headers: Record<string, unknown>;
      try { headers = JSON.parse(row.headers_json) as Record<string, unknown>; }
      catch { throw executionFailure("failed", "PRODUCTION_STALE_FENCE_CHECKPOINT_INTENT_INVALID"); }
      if (row.path !== checkpointPath(input.jobId) || row.method !== "POST"
        || JSON.stringify(Object.keys(headers)) !== JSON.stringify(["x-ai-execution-fence-hash"])
        || typeof headers["x-ai-execution-fence-hash"] !== "string") {
        throw executionFailure("failed", "PRODUCTION_STALE_FENCE_CHECKPOINT_INTENT_INVALID");
      }
      const nextBody = {
        ...body,
        worker_session_id: input.workerSessionId,
        worker_session_epoch: input.workerSessionEpoch,
        lease_version: input.leaseVersion,
        fence_hash: input.fenceHash,
      };
      const nextHeaders = { "x-ai-execution-fence-hash": input.fenceHash };
      const nextBodyBytes = Buffer.from(json(nextBody));
      const changed = this.database.prepare(`update production_outbox
        set headers_json=?,body_blob=?,last_error=null,next_delivery_at=null
        where idempotency_key=? and kind='checkpoint' and path=? and method='POST'
          and body_blob=? and headers_json=? and sent_at is null and response_hash is null
          and last_error=? and next_delivery_at is null`).run(
        json(nextHeaders), nextBodyBytes, row.idempotency_key, row.path,
        row.body_blob, row.headers_json, STALE_LEASE_FENCE_REMOTE_PROOF,
      );
      if (changed.changes !== 1) {
        throw executionFailure("failed", "PRODUCTION_STALE_FENCE_INTENT_CONFLICT");
      }
      return Object.freeze({
        idempotency_key: row.idempotency_key,
        kind: "checkpoint" as const,
        path: row.path,
        method: "POST" as const,
        headers: Object.freeze(nextHeaders),
        body: nextBodyBytes,
      });
    });
    const write = transaction();
    if (write) this.notifyOutbox(this.readOutboxAuthority(write.idempotency_key));
    return write;
  }
  public deliverReauthorizedStaleCheckpoint<T>(input: Readonly<{
    jobId: string;
    attemptId: string;
    workerSessionId: string;
    workerSessionEpoch: number;
    leaseVersion: number;
    fenceHash: ProductionHash;
    receipts: readonly RemoteReceipt[];
  }>, send: (write: ProductionOutboxWrite) => Promise<T>): Promise<Readonly<{
    requestId: string | null;
    deliveryError: unknown | null;
  }>> {
    return this.serializeOutboxOperation(async () => {
      const write = this.reauthorizeStaleCheckpoint(input);
      if (!write) return Object.freeze({ requestId: null, deliveryError: null });
      try {
        const response = await send(write);
        this.markOutboxSent(write.idempotency_key, response);
        return Object.freeze({ requestId: write.idempotency_key, deliveryError: null });
      } catch (error) {
        this.recordDeliveryFailure(write.idempotency_key, error);
        return Object.freeze({ requestId: write.idempotency_key, deliveryError: error });
      }
    });
  }
  public recoverCheckpointPrefix(input: Readonly<{
    jobId: string;
    attemptId: string;
    acceptedAttemptCount: number;
    receipts: readonly RemoteReceipt[];
  }>): RecoveryCheckpointPrefix {
    this.hydrateRemoteOutboxReceipts(input.jobId, input.receipts);
    return this.database.transaction(() => {
      const task = this.readTask(input.jobId);
      if (!task || task.status !== "failed" || task.current_attempt_id !== input.attemptId
        || task.staged_result !== null) {
        throw executionFailure("failed", "PRODUCTION_RECOVERY_TASK_AUTHORITY_CONFLICT");
      }
      const activeRejectedFailure = task.attempt_failure !== null
        && isRejectedCheckpointSequenceFailure(task.attempt_failure);
      if (task.attempt_failure && !activeRejectedFailure) {
        throw executionFailure("failed", "PRODUCTION_RECOVERY_FAILURE_SHAPE_MISMATCH");
      }
      const rows = this.database.prepare(`select idempotency_key,kind,path,headers_json,body_blob,
        sent_at,last_error,response_json,response_hash,next_delivery_at
        from production_outbox where instr(path,?)>0 order by created_at,idempotency_key`
      ).all(jobPathMarker(input.jobId)) as RecoveryOutboxRow[];
      if (rows.some((row) => row.kind !== "checkpoint")) {
        throw executionFailure("failed", "PRODUCTION_RECOVERY_RESULT_WRITE_PRESENT");
      }
      const prefix = proveRecoveryCheckpointPrefix({
        ...input,
        rows,
      });
      if (activeRejectedFailure) {
        if (!prefix.rejectedIncident) {
          throw executionFailure("failed", "PRODUCTION_RECOVERY_REJECTED_INCIDENT_MISSING");
        }
        this.removeRejectedCheckpointFalseFailure({
          jobId: input.jobId,
          attemptId: input.attemptId,
          failure: task.attempt_failure!,
        });
      }
      if (prefix.attemptFailure) {
        this.recordAttemptFailure(input.jobId, input.attemptId, prefix.attemptFailure);
      }
      return Object.freeze({ checkpointSeq: prefix.checkpointSeq, checkpointHash: prefix.checkpointHash });
    })();
  }

  private recordDeliveryFailure(
    idempotencyKey: string,
    error: unknown,
  ): void {
    const timestamp = now();
    const transport = typedRuntimeTransportFailure(error);
    const staleFenceRejected = transport?.code === STALE_LEASE_FENCE_CODE
      && transport.httpStatus === 409;
    const code = staleFenceRejected
      ? STALE_LEASE_FENCE_REMOTE_PROOF
      : failureCode(error, "OUTBOX_DELIVERY_FAILED");
    const nextDeliveryAt = staleFenceRejected
      ? null
      : new Date(Date.parse(timestamp) + retryDelay(error)).toISOString();
    const changed = this.database.prepare(`update production_outbox
      set last_error=?,next_delivery_at=? where idempotency_key=? and sent_at is null`
    ).run(code, nextDeliveryAt, idempotencyKey);
    if (changed.changes === 0 && !this.readOutboxAuthority(idempotencyKey)) {
      throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
    }
    this.notifyOutbox(this.readOutboxAuthority(idempotencyKey));
  }

  public deferOutboxReconciliation(jobId: string, error: unknown): number {
    const nextDeliveryAt = new Date(Date.now() + retryDelay(error)).toISOString();
    const changed = this.database.prepare(`update production_outbox
      set last_error=?,next_delivery_at=?
        where instr(path,?)>0
        and sent_at is null and response_hash is null
        and (last_error is null or last_error not in (?,?,?))`
    ).run(failureCode(error, "OUTBOX_RECONCILIATION_FAILED"), nextDeliveryAt,
      jobPathMarker(jobId), PERMANENT_AUTHORIZATION_REVOKED_CODE,
      PERMANENT_REVOCATION_REASON, STALE_LEASE_FENCE_REMOTE_PROOF);
    this.notifyOutbox(this.outboxAuthorities().find((row) => row.jobId === jobId) ?? null);
    return changed.changes;
  }

  public hasPermanentAuthorizationRevocationFailure(jobId: string): boolean {
    return Boolean(this.database.prepare(`select 1 from production_outbox
      where instr(path,?)>0 and sent_at is null and response_hash is null and last_error=? limit 1`
    ).get(jobPathMarker(jobId), PERMANENT_AUTHORIZATION_REVOKED_CODE));
  }

  public settlePermanentlyRevokedJob(jobId: string, currentReason: string): number {
    const transaction = this.database.transaction(() => {
      const task = this.readTask(jobId);
      if (!task || task.status !== "failed") {
        throw executionFailure("failed", "PRODUCTION_REVOCATION_TASK_AUTHORITY_INVALID");
      }
      const rejectedFailureIntents = this.database.prepare(`select body_blob from production_outbox
        where kind='checkpoint' and instr(path,?)>0 and sent_at is null and response_hash is null
          and last_error=?`).all(jobPathMarker(jobId), PERMANENT_AUTHORIZATION_REVOKED_CODE) as Array<{
        body_blob: Buffer;
      }>;
      const unacceptedFailure = task.attempt_failure !== null && rejectedFailureIntents.some((row) => {
        const body = JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>;
        return body.job_id === jobId && body.attempt_id === task.current_attempt_id
          && body.checkpoint_kind === "attempt_failure"
          && json(body.attempt_failure) === json(task.attempt_failure);
      });
      const changed = this.database.prepare(`update production_outbox
        set last_error=?,next_delivery_at=null where instr(path,?)>0
          and sent_at is null and response_hash is null`
      ).run(PERMANENT_REVOCATION_REASON, jobPathMarker(jobId));
      this.database.prepare(`update production_tasks set current_reason=?,updated_at=?
        where job_id=? and status='failed'`).run(currentReason, now(), jobId);
      if (unacceptedFailure) {
        this.database.prepare(`delete from production_attempt_failures
          where job_id=? and attempt_id=? and failure_json=?`).run(
          jobId, task.current_attempt_id, json(task.attempt_failure),
        );
      }
      this.database.prepare(
        "update production_continuations set lane_owner_job_id=null where lane_owner_job_id=?",
      ).run(jobId);
      return changed.changes;
    });
    const changed = transaction();
    this.notifyOutbox(this.outboxAuthorities().find((row) => row.jobId === jobId) ?? null);
    return changed;
  }

  public deliverOutbox<T>(
    idempotencyKey: string,
    send: (write: ProductionOutboxWrite) => Promise<T>,
  ): Promise<T> {
    const operation = async (): Promise<T> => {
      const authority = this.readOutboxAuthority(idempotencyKey);
      if (!authority) throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
      if (authority.state === "delivered") return this.readOutboxResponse(idempotencyKey) as T;
      if (authority.lastError === STALE_LEASE_FENCE_REMOTE_PROOF) {
        throw executionFailure("failed", "PRODUCTION_STALE_FENCE_REAUTHORIZATION_REQUIRED");
      }
      if (authority.nextDeliveryAt && authority.nextDeliveryAt > now()) {
        throw executionFailure("failed", "PRODUCTION_OUTBOX_DELIVERY_BACKOFF_ACTIVE");
      }
      try {
        const response = await send(this.readPendingOutboxWrite(idempotencyKey));
        this.markOutboxSent(idempotencyKey, response);
        return response;
      } catch (error) {
        this.recordDeliveryFailure(idempotencyKey, error);
        throw error;
      }
    };
    return this.serializeOutboxOperation(operation);
  }

  public readOutboxAuthority(idempotencyKey: string): ProductionOutboxAuthority | null {
    const row = this.database.prepare(`select idempotency_key,kind,path,method,headers_json,body_blob,created_at,
      sent_at,last_error,response_json,response_hash,receipt_hash,next_delivery_at
      from production_outbox where idempotency_key=?`).get(idempotencyKey) as ProductionOutboxAuthorityRow | undefined;
    if (!row) return null;
    return productionOutboxAuthorityFromRow(row, idempotencyKey);
  }

  public outboxAuthorities(): readonly ProductionOutboxAuthority[] {
    const rows = this.database.prepare(
      "select idempotency_key from production_outbox order by created_at,idempotency_key",
    ).all() as Array<{ idempotency_key: string }>;
    return Object.freeze(rows.map((row) => this.readOutboxAuthority(row.idempotency_key)!));
  }
}
