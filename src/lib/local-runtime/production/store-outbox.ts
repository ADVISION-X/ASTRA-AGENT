import { executionFailure, failureCode, typedExecutionFailure } from "../../execution-failure.js";
import { terminalFailureHttpStatus } from "./terminal-failure.js";
import { hashCanonical, parseTerminalReceipt, parseTerminalReceiptExpectation, type ProductionHash } from "./contracts.js";
import {
  assertReceiptIdentity,
  isRejectedCheckpointSequenceFailure,
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
const jobPathMarker = (jobId: string): string => `/jobs/${encodeURIComponent(jobId)}/`;

const retryDelay = (error: unknown): number => {
  const httpStatus = terminalFailureHttpStatus(error);
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
      return Object.freeze({ checkpointSeq: prefix.checkpointSeq, checkpointHash: prefix.checkpointHash });
    })();
  }

  private recordDeliveryFailure(
    idempotencyKey: string,
    error: unknown,
  ): void {
    const timestamp = now();
    const code = failureCode(error, "OUTBOX_DELIVERY_FAILED");
    const nextDeliveryAt = new Date(Date.parse(timestamp) + retryDelay(error)).toISOString();
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
      set last_error=?,next_delivery_at=? where instr(path,?)>0
        and sent_at is null and response_hash is null`
    ).run(failureCode(error, "OUTBOX_RECONCILIATION_FAILED"), nextDeliveryAt,
      jobPathMarker(jobId));
    this.notifyOutbox(this.outboxAuthorities().find((row) => row.jobId === jobId) ?? null);
    return changed.changes;
  }

  public settlePermanentlyRevokedJob(jobId: string, currentReason: string): number {
    const transaction = this.database.transaction(() => {
      const task = this.readTask(jobId);
      if (!task || task.status !== "failed") {
        throw executionFailure("failed", "PRODUCTION_REVOCATION_TASK_AUTHORITY_INVALID");
      }
      const changed = this.database.prepare(`update production_outbox
        set last_error=?,next_delivery_at=null where instr(path,?)>0
          and sent_at is null and response_hash is null`
      ).run(PERMANENT_REVOCATION_REASON, jobPathMarker(jobId));
      this.database.prepare(`update production_tasks set current_reason=?,updated_at=?
        where job_id=? and status='failed'`).run(currentReason, now(), jobId);
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
    send: () => Promise<T>,
  ): Promise<T> {
    const operation = async (): Promise<T> => {
      const authority = this.readOutboxAuthority(idempotencyKey);
      if (!authority) throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
      if (authority.state === "delivered") return this.readOutboxResponse(idempotencyKey) as T;
      if (authority.nextDeliveryAt && authority.nextDeliveryAt > now()) {
        throw executionFailure("failed", "PRODUCTION_OUTBOX_DELIVERY_BACKOFF_ACTIVE");
      }
      try {
        const response = await send();
        this.markOutboxSent(idempotencyKey, response);
        return response;
      } catch (error) {
        this.recordDeliveryFailure(idempotencyKey, error);
        throw error;
      }
    };
    const result = this.outboxDeliveryTail.then(operation, operation);
    this.outboxDeliveryTail = result.then(() => undefined, () => undefined);
    return result;
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
