import { executionFailure } from "../../typed-failure.js";
import { hashCanonical, parseTerminalReceipt, parseTerminalReceiptExpectation, type ProductionHash } from "./contracts.js";
import { ProductionStoreTaskState } from "./store-task-state.js";
import {
  json,
  now,
  type LegacyProductionTaskStatus,
  type ProductionOutboxAuthority,
  type ProductionOutboxWrite,
} from "./store-foundation.js";

type RemoteReceipt = Readonly<{
  request_id: string;
  write_kind: string;
  payload_hash: ProductionHash;
  response_json: Record<string, unknown>;
}>;

type LocalReceiptIntent = Readonly<{
  kind: ProductionOutboxWrite["kind"];
  path: string;
  headers_json: string;
  body_blob: Buffer;
  response_json: string | null;
  response_hash: ProductionHash | null;
}>;

const receiptHashOf = (response: Record<string, unknown>): ProductionHash | null =>
  typeof response.receipt_hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(response.receipt_hash)
    ? response.receipt_hash as ProductionHash : null;

const payloadHashOf = (local: LocalReceiptIntent): ProductionHash => {
  const headers = JSON.parse(local.headers_json) as Record<string, string>;
  return local.kind === "artifact" ? headers["x-ai-content-sha256"] as ProductionHash
    : hashCanonical(JSON.parse(local.body_blob.toString("utf8")) as unknown);
};

const assertReceiptIdentity = (jobId: string, local: LocalReceiptIntent, receipt: RemoteReceipt): void => {
  const pathJobId = /\/jobs\/([^/]+)\//u.exec(local.path)?.[1];
  if (!pathJobId || decodeURIComponent(pathJobId) !== jobId || local.kind !== receipt.write_kind) {
    throw executionFailure("review_required", "PRODUCTION_REMOTE_RECEIPT_IDENTITY_MISMATCH");
  }
  if (payloadHashOf(local) !== receipt.payload_hash) {
    throw executionFailure("review_required", "PRODUCTION_REMOTE_RECEIPT_PAYLOAD_MISMATCH");
  }
};

const assertTerminalReceipt = (local: LocalReceiptIntent, response: Record<string, unknown>): void => {
  if (local.kind !== "terminal") return;
  const request = JSON.parse(local.body_blob.toString("utf8")) as Record<string, unknown>;
  if (request.terminal_status === "completed" || request.terminal_status === "failed") {
    parseTerminalReceipt(response, parseTerminalReceiptExpectation(request));
    return;
  }
  if (response.job_id !== request.job_id || response.terminal_status !== request.terminal_status
    || response.payload_hash !== request.payload_hash) {
    throw executionFailure("review_required", "PRODUCTION_LEGACY_TERMINAL_RECEIPT_MISMATCH");
  }
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
        throw executionFailure("review_required", "PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT");
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

  public pendingOutbox(): readonly ProductionOutboxWrite[] {
    const rows = this.database.prepare(
      "select idempotency_key,kind,path,method,headers_json,body_blob from production_outbox where sent_at is null order by created_at,idempotency_key",
    ).all() as Array<{
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
          throw executionFailure("review_required", "PRODUCTION_OUTBOX_RESPONSE_CONFLICT");
        }
        return;
      }
      this.database.prepare(`update production_outbox set response_json=?,response_hash=?,receipt_hash=?,
        sent_at=?,failure_code=null where idempotency_key=? and sent_at is null`
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

  public unreconciledOutboxJobIds(): readonly string[] {
    const rows = this.database.prepare(`select path from production_outbox
      where response_hash is null and failure_code is not 'REMOTE_JOB_ABSENT_HISTORICAL'
      order by created_at,idempotency_key`).all() as Array<{ path: string }>;
    const jobIds = rows.map((row) => /\/jobs\/([^/]+)\//u.exec(row.path)?.[1])
      .filter((jobId): jobId is string => Boolean(jobId)).map(decodeURIComponent);
    return Object.freeze([...new Set(jobIds)]);
  }

  private hydrateOne(jobId: string, receipt: RemoteReceipt): boolean {
    const local = this.database.prepare(`select kind,path,headers_json,body_blob,response_json,response_hash
      from production_outbox where idempotency_key=?`).get(receipt.request_id) as LocalReceiptIntent | undefined;
    if (!local) return false;
    assertReceiptIdentity(jobId, local, receipt);
    const responseJson = json(receipt.response_json);
    const responseHash = hashCanonical(receipt.response_json);
    if (local.response_hash) {
      if (local.response_hash !== responseHash || local.response_json !== responseJson) {
        throw executionFailure("review_required", "PRODUCTION_OUTBOX_RESPONSE_CONFLICT");
      }
      return false;
    }
    assertTerminalReceipt(local, receipt.response_json);
    this.database.prepare(`update production_outbox set response_json=?,response_hash=?,receipt_hash=?,
      sent_at=coalesce(sent_at,?),failure_code=null where idempotency_key=? and response_hash is null`).run(
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

  public markRemoteAbsentHistorical(jobId: string): boolean {
    const task = this.database.prepare("select status from production_tasks where job_id=?")
      .get(jobId) as { status: LegacyProductionTaskStatus } | undefined;
    if (!task || !["completed", "failed", "review_required", "cancelled"].includes(task.status)) return false;
    this.database.prepare(`update production_outbox set failure_code='REMOTE_JOB_ABSENT_HISTORICAL',
      sent_at=coalesce(sent_at,?) where path like ? and response_hash is null`
    ).run(now(), `%/jobs/${encodeURIComponent(jobId)}/%`);
    return true;
  }

  public deliverOutbox<T>(idempotencyKey: string, send: () => Promise<T>): Promise<T> {
    const operation = async (): Promise<T> => {
      const authority = this.readOutboxAuthority(idempotencyKey);
      if (!authority) throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
      if (authority.state === "delivered") return this.readOutboxResponse(idempotencyKey) as T;
      if (authority.state === "failed") this.markOutboxPending(idempotencyKey);
      try {
        const response = await send();
        this.markOutboxSent(idempotencyKey, response);
        return response;
      } catch (error) {
        this.markOutboxFailed(idempotencyKey, "OUTBOX_DELIVERY_FAILED");
        throw error;
      }
    };
    const result = this.outboxDeliveryTail.then(operation, operation);
    this.outboxDeliveryTail = result.then(() => undefined, () => undefined);
    return result;
  }

  public markOutboxPending(idempotencyKey: string): void {
    this.database.prepare(
      "update production_outbox set failure_code=null where idempotency_key=? and sent_at is null",
    ).run(idempotencyKey);
    this.notifyOutbox(this.readOutboxAuthority(idempotencyKey));
  }

  public markOutboxFailed(idempotencyKey: string, failureCode: string): void {
    this.database.prepare(
      "update production_outbox set failure_code=? where idempotency_key=? and sent_at is null",
    ).run(failureCode, idempotencyKey);
    this.notifyOutbox(this.readOutboxAuthority(idempotencyKey));
  }

  public readOutboxAuthority(idempotencyKey: string): ProductionOutboxAuthority | null {
    const row = this.database.prepare(`select idempotency_key,kind,path,sent_at,failure_code,response_hash,receipt_hash
      from production_outbox where idempotency_key=?`).get(idempotencyKey) as Readonly<{
      idempotency_key: string; kind: ProductionOutboxWrite["kind"]; path: string; sent_at: string | null;
      failure_code: string | null; response_hash: ProductionHash | null; receipt_hash: ProductionHash | null;
    }> | undefined;
    if (!row) return null;
    const match = /\/jobs\/([^/]+)\//u.exec(row.path);
    if (!match?.[1]) throw new Error("PRODUCTION_OUTBOX_JOB_ID_MISSING");
    return Object.freeze({
      idempotencyKey: row.idempotency_key, jobId: decodeURIComponent(match[1]), kind: row.kind,
      state: row.sent_at && row.response_hash ? "delivered" : row.failure_code ? "failed" : "pending",
      failureCode: row.failure_code, responseHash: row.response_hash, receiptHash: row.receipt_hash,
    });
  }

  public outboxAuthorities(): readonly ProductionOutboxAuthority[] {
    const rows = this.database.prepare(
      "select idempotency_key from production_outbox order by created_at,idempotency_key",
    ).all() as Array<{ idempotency_key: string }>;
    return Object.freeze(rows.map((row) => this.readOutboxAuthority(row.idempotency_key)!));
  }
}
