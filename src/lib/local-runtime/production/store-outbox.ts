import { executionFailure, failureCode, typedExecutionFailure } from "../../typed-failure.js";
import { hashCanonical, parseTerminalReceipt, parseTerminalReceiptExpectation, type ProductionHash } from "./contracts.js";
import { ProductionStoreTaskState } from "./store-task-state.js";
import {
  json,
  now,
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

const OUTBOX_RETRY_DELAY_MS = 5_000;
const OUTBOX_STALE_RETIRE_CODES = new Set([
  "AI_LEASE_FENCE_STALE",
  "AI_V6_LEASE_RACE",
  "AI_V6_JOB_NOT_FOUND",
]);

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
    throw executionFailure("failed", "PRODUCTION_REMOTE_RECEIPT_IDENTITY_MISMATCH");
  }
  if (payloadHashOf(local) !== receipt.payload_hash) {
    throw executionFailure("failed", "PRODUCTION_REMOTE_RECEIPT_PAYLOAD_MISMATCH");
  }
};

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

  public unreconciledOutboxJobIds(): readonly string[] {
    const rows = this.database.prepare(`select path from production_outbox
      where sent_at is null and response_hash is null
        and (last_error is null or last_error='CLOUD_TRANSPORT_UNAVAILABLE' or next_delivery_at is not null)
      order by created_at,idempotency_key`).all() as Array<{ path: string }>;
    const jobIds = rows.map((row) => /\/jobs\/([^/]+)\//u.exec(row.path)?.[1])
      .filter((jobId): jobId is string => Boolean(jobId)).map(decodeURIComponent);
    return Object.freeze([...new Set(jobIds)]);
  }

  public hasUnsentOutbox(jobId: string): boolean {
    return Boolean(this.database.prepare(`select 1 from production_outbox
      where path like ? and sent_at is null limit 1`).get(`%/jobs/${encodeURIComponent(jobId)}/%`));
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
      this.database.prepare(`update production_outbox set next_delivery_at=?
        where path like ? and sent_at is null and last_error='CLOUD_TRANSPORT_UNAVAILABLE'
          and next_delivery_at is null`).run(
        new Date(Date.now() + OUTBOX_RETRY_DELAY_MS).toISOString(),
        `%/jobs/${encodeURIComponent(jobId)}/%`,
      );
      return hydrated;
    });
    return transaction();
  }

  private recordDeliveryFailure(
    idempotencyKey: string,
    error: unknown,
  ): void {
    const timestamp = now();
    const typed = typedExecutionFailure(error);
    const code = failureCode(error, "OUTBOX_DELIVERY_FAILED");
    const retryableResponse = typed?.httpStatus !== null && typed?.httpStatus !== undefined
      && typed.httpStatus >= 500 && typed.httpStatus <= 599;
    const nextDeliveryAt = retryableResponse
      ? new Date(Date.parse(timestamp) + OUTBOX_RETRY_DELAY_MS).toISOString() : null;
    const changed = this.database.prepare(`update production_outbox
      set last_error=?,next_delivery_at=? where idempotency_key=? and sent_at is null`
    ).run(code, nextDeliveryAt, idempotencyKey);
    if (changed.changes === 0 && !this.readOutboxAuthority(idempotencyKey)) {
      throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
    }
    this.notifyOutbox(this.readOutboxAuthority(idempotencyKey));
  }

  public deliverOutbox<T>(
    idempotencyKey: string,
    send: () => Promise<T>,
  ): Promise<T> {
    const operation = async (): Promise<T> => {
      const authority = this.readOutboxAuthority(idempotencyKey);
      if (!authority) throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
      if (authority.state === "delivered") return this.readOutboxResponse(idempotencyKey) as T;
      if (authority.state === "failed") {
        throw executionFailure("failed", authority.lastError ?? "PRODUCTION_OUTBOX_DELIVERY_STOPPED");
      }
      if (authority.nextDeliveryAt && authority.nextDeliveryAt > now()) {
        throw executionFailure("failed", "PRODUCTION_OUTBOX_DELIVERY_BACKOFF_ACTIVE");
      }
      try {
        const response = await send();
        this.markOutboxSent(idempotencyKey, response);
        return response;
      } catch (error) {
        const code = failureCode(error, "OUTBOX_DELIVERY_FAILED");
        if (OUTBOX_STALE_RETIRE_CODES.has(code)) this.retireStaleOutbox(idempotencyKey, code);
        else this.recordDeliveryFailure(idempotencyKey, error);
        throw error;
      }
    };
    const result = this.outboxDeliveryTail.then(operation, operation);
    this.outboxDeliveryTail = result.then(() => undefined, () => undefined);
    return result;
  }

  private retireStaleOutbox(idempotencyKey: string, remoteCode: string): void {
    this.database.prepare(`update production_outbox
      set last_error=?,next_delivery_at=null
      where idempotency_key=? and response_hash is null`
    ).run(`STALE_LEASE_OUTBOX_RETIRED:${remoteCode}`.slice(0, 240), idempotencyKey);
    this.notifyOutbox(this.readOutboxAuthority(idempotencyKey));
  }

  public readOutboxAuthority(idempotencyKey: string): ProductionOutboxAuthority | null {
    const row = this.database.prepare(`select idempotency_key,kind,path,sent_at,last_error,response_hash,receipt_hash,
      next_delivery_at
      from production_outbox where idempotency_key=?`).get(idempotencyKey) as Readonly<{
      idempotency_key: string; kind: ProductionOutboxWrite["kind"]; path: string; sent_at: string | null;
      last_error: string | null; response_hash: ProductionHash | null; receipt_hash: ProductionHash | null;
      next_delivery_at: string | null;
    }> | undefined;
    if (!row) return null;
    const match = /\/jobs\/([^/]+)\//u.exec(row.path);
    if (!match?.[1]) throw new Error("PRODUCTION_OUTBOX_JOB_ID_MISSING");
    return Object.freeze({
      idempotencyKey: row.idempotency_key, jobId: decodeURIComponent(match[1]), kind: row.kind,
      state: row.sent_at && row.response_hash ? "delivered"
        : row.last_error && row.next_delivery_at === null ? "failed" : "pending",
      nextDeliveryAt: row.next_delivery_at, lastError: row.last_error,
      responseHash: row.response_hash, receiptHash: row.receipt_hash,
    });
  }

  public outboxAuthorities(): readonly ProductionOutboxAuthority[] {
    const rows = this.database.prepare(
      "select idempotency_key from production_outbox order by created_at,idempotency_key",
    ).all() as Array<{ idempotency_key: string }>;
    return Object.freeze(rows.map((row) => this.readOutboxAuthority(row.idempotency_key)!));
  }
}
