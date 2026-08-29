import { executionFailure, failureCode } from "../../typed-failure.js";
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

const OUTBOX_DELIVERY_MAX_ATTEMPTS = 3;
const OUTBOX_DELIVERY_BACKOFF_MS = [5_000, 15_000] as const;
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
    throw executionFailure("review_required", "PRODUCTION_REMOTE_RECEIPT_IDENTITY_MISMATCH");
  }
  if (payloadHashOf(local) !== receipt.payload_hash) {
    throw executionFailure("review_required", "PRODUCTION_REMOTE_RECEIPT_PAYLOAD_MISMATCH");
  }
};

const assertTerminalReceipt = (local: LocalReceiptIntent, response: Record<string, unknown>): void => {
  if (local.kind !== "terminal") return;
  const request = JSON.parse(local.body_blob.toString("utf8")) as Record<string, unknown>;
  if (request.terminal_status === "completed") {
    parseTerminalReceipt(response, parseTerminalReceiptExpectation(request));
    return;
  }
  throw executionFailure("review_required", "PRODUCTION_FAILED_COMPLETION_RETIRED");
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

  private bindDeliveryBuild(idempotencyKey: string | null, buildHash: ProductionHash): void {
    const where = idempotencyKey === null
      ? "sent_at is null and (delivery_build_hash is null or delivery_build_hash<>?)"
      : "idempotency_key=? and sent_at is null and (delivery_build_hash is null or delivery_build_hash<>?)";
    const whereValues = idempotencyKey === null ? [buildHash] : [idempotencyKey, buildHash];
    const changed = this.database.prepare(
      `select idempotency_key from production_outbox where ${where}`,
    ).all(...whereValues) as Array<{ idempotency_key: string }>;
    if (changed.length === 0) return;
    this.database.prepare(`update production_outbox
      set delivery_build_hash=?,delivery_attempt_count=0,next_delivery_attempt_at=null,delivery_parked_at=null
      where ${where}`).run(buildHash, ...whereValues);
    for (const row of changed) this.notifyOutbox(this.readOutboxAuthority(row.idempotency_key));
  }

  public pendingOutbox(buildHash: ProductionHash, observedAt = now()): readonly ProductionOutboxWrite[] {
    this.bindDeliveryBuild(null, buildHash);
    const rows = this.database.prepare(
      `select idempotency_key,kind,path,method,headers_json,body_blob from production_outbox
       where sent_at is null and delivery_parked_at is null
         and (next_delivery_attempt_at is null or next_delivery_attempt_at<=?)
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
          throw executionFailure("review_required", "PRODUCTION_OUTBOX_RESPONSE_CONFLICT");
        }
        return;
      }
      this.database.prepare(`update production_outbox set response_json=?,response_hash=?,receipt_hash=?,
        sent_at=?,failure_code=null,next_delivery_attempt_at=null,delivery_parked_at=null
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
      order by created_at,idempotency_key`).all() as Array<{ path: string }>;
    const jobIds = rows.map((row) => /\/jobs\/([^/]+)\//u.exec(row.path)?.[1])
      .filter((jobId): jobId is string => Boolean(jobId)).map(decodeURIComponent);
    return Object.freeze([...new Set(jobIds)]);
  }

  public isRemoteRedeliveryPending(jobId: string): boolean {
    const jobPath = `%/jobs/${encodeURIComponent(jobId)}/%`;
    const row = this.database.prepare(`select 1
      from production_tasks t
      where t.job_id=? and t.status='recovery_pending' and t.staged_result_json is null
        and exists(
          select 1 from production_outbox retired
          where retired.path like ? and retired.failure_code='HISTORICAL_FAILED_COMPLETION_RETIRED'
        )
        and not exists(
          select 1 from production_outbox pending
          where pending.path like ? and pending.sent_at is null
        )
      limit 1`).get(jobId, jobPath, jobPath);
    return Boolean(row);
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
      sent_at=coalesce(sent_at,?),failure_code=null,next_delivery_attempt_at=null,delivery_parked_at=null
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

  public markRemoteAbsentHistorical(jobId: string): boolean {
    const task = this.database.prepare("select status from production_tasks where job_id=?")
      .get(jobId) as { status: LegacyProductionTaskStatus } | undefined;
    if (!task || task.status !== "completed") return false;
    this.database.prepare(`update production_outbox set failure_code='REMOTE_JOB_ABSENT_HISTORICAL',
      sent_at=coalesce(sent_at,?),next_delivery_attempt_at=null,delivery_parked_at=null
      where path like ? and response_hash is null`
    ).run(now(), `%/jobs/${encodeURIComponent(jobId)}/%`);
    return true;
  }

  private recordDeliveryFailure(
    idempotencyKey: string,
    buildHash: ProductionHash,
    code: string,
  ): void {
    const timestamp = now();
    const transaction = this.database.transaction(() => {
      const row = this.database.prepare(`select delivery_build_hash,delivery_attempt_count,sent_at
        from production_outbox where idempotency_key=?`).get(idempotencyKey) as Readonly<{
        delivery_build_hash: ProductionHash | null; delivery_attempt_count: number; sent_at: string | null;
      }> | undefined;
      if (!row) throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
      if (row.sent_at) return;
      if (row.delivery_build_hash !== buildHash) {
        throw executionFailure("review_required", "PRODUCTION_OUTBOX_DELIVERY_BUILD_MISMATCH");
      }
      const attemptCount = row.delivery_attempt_count + 1;
      const parked = attemptCount >= OUTBOX_DELIVERY_MAX_ATTEMPTS;
      const delay = OUTBOX_DELIVERY_BACKOFF_MS[attemptCount - 1];
      const nextAttemptAt = parked || delay === undefined
        ? null : new Date(Date.parse(timestamp) + delay).toISOString();
      this.database.prepare(`update production_outbox
        set failure_code=?,delivery_attempt_count=?,next_delivery_attempt_at=?,delivery_parked_at=?
        where idempotency_key=? and sent_at is null`).run(
        code, attemptCount, nextAttemptAt, parked ? timestamp : null, idempotencyKey,
      );
    });
    transaction();
    this.notifyOutbox(this.readOutboxAuthority(idempotencyKey));
  }

  public deliverOutbox<T>(
    idempotencyKey: string,
    buildHash: ProductionHash,
    send: () => Promise<T>,
  ): Promise<T> {
    const operation = async (): Promise<T> => {
      this.bindDeliveryBuild(idempotencyKey, buildHash);
      const authority = this.readOutboxAuthority(idempotencyKey);
      if (!authority) throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
      if (authority.state === "delivered") return this.readOutboxResponse(idempotencyKey) as T;
      if (authority.state === "parked") {
        throw executionFailure("review_required", "PRODUCTION_OUTBOX_DELIVERY_PARKED");
      }
      if (authority.nextDeliveryAttemptAt && authority.nextDeliveryAttemptAt > now()) {
        throw executionFailure("recovery_pending", "PRODUCTION_OUTBOX_DELIVERY_BACKOFF_ACTIVE");
      }
      try {
        const response = await send();
        this.markOutboxSent(idempotencyKey, response);
        return response;
      } catch (error) {
        const code = failureCode(error, "OUTBOX_DELIVERY_FAILED");
        if (OUTBOX_STALE_RETIRE_CODES.has(code)) this.retireStaleOutbox(idempotencyKey, code);
        else this.recordDeliveryFailure(idempotencyKey, buildHash, code);
        throw error;
      }
    };
    const result = this.outboxDeliveryTail.then(operation, operation);
    this.outboxDeliveryTail = result.then(() => undefined, () => undefined);
    return result;
  }

  private retireStaleOutbox(idempotencyKey: string, remoteCode: string): void {
    this.database.prepare(`update production_outbox
      set failure_code=?,sent_at=coalesce(sent_at,?),next_delivery_attempt_at=null,delivery_parked_at=null
      where idempotency_key=? and response_hash is null`
    ).run(`STALE_LEASE_OUTBOX_RETIRED:${remoteCode}`.slice(0, 240), now(), idempotencyKey);
    this.notifyOutbox(this.readOutboxAuthority(idempotencyKey));
  }

  public readOutboxAuthority(idempotencyKey: string): ProductionOutboxAuthority | null {
    const row = this.database.prepare(`select idempotency_key,kind,path,sent_at,failure_code,response_hash,receipt_hash,
      delivery_build_hash,delivery_attempt_count,next_delivery_attempt_at,delivery_parked_at
      from production_outbox where idempotency_key=?`).get(idempotencyKey) as Readonly<{
      idempotency_key: string; kind: ProductionOutboxWrite["kind"]; path: string; sent_at: string | null;
      failure_code: string | null; response_hash: ProductionHash | null; receipt_hash: ProductionHash | null;
      delivery_build_hash: ProductionHash | null; delivery_attempt_count: number;
      next_delivery_attempt_at: string | null; delivery_parked_at: string | null;
    }> | undefined;
    if (!row) return null;
    const match = /\/jobs\/([^/]+)\//u.exec(row.path);
    if (!match?.[1]) throw new Error("PRODUCTION_OUTBOX_JOB_ID_MISSING");
    return Object.freeze({
      idempotencyKey: row.idempotency_key, jobId: decodeURIComponent(match[1]), kind: row.kind,
      state: row.sent_at && row.response_hash ? "delivered"
        : row.delivery_parked_at ? "parked" : row.failure_code ? "failed" : "pending",
      deliveryBuildHash: row.delivery_build_hash, deliveryAttemptCount: row.delivery_attempt_count,
      nextDeliveryAttemptAt: row.next_delivery_attempt_at, parkedAt: row.delivery_parked_at,
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
