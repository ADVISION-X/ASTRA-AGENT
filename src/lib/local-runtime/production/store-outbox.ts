import { executionFailure, failureCode } from "../../execution-failure.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";
import { hashCanonical, parseTerminalReceipt, parseTerminalReceiptExpectation, type ProductionHash } from "./contracts.js";
import {
  assertReceiptIdentity,
  type LocalReceiptIntent,
  type RemoteReceipt,
} from "./store-outbox-receipt.js";
import { ProductionStoreTaskState } from "./store-task-state.js";
import { productionOutboxAuthorityFromRow } from "./store-authority-validation.js";
import { parseProviderCooldownReceipt } from "./provider-cooldown-receipt.js";
import {
  json,
  now,
  type ProductionOutboxAuthority,
  type ProductionOutboxAuthorityRow,
  type ProductionOutboxWrite,
} from "./store-foundation.js";

const STALE_LEASE_FENCE_CODE = "AI_LEASE_FENCE_STALE";
const STALE_LEASE_FENCE_REMOTE_PROOF = "WEBSITE_HTTP_409:AI_LEASE_FENCE_STALE";
const jobPathMarker = (jobId: string): string => `/jobs/${encodeURIComponent(jobId)}/`;
const headersWithoutExecutionFence = (headersJson: string): string => {
  const headers = JSON.parse(headersJson) as Record<string, string>;
  delete headers["x-ai-execution-fence-hash"];
  return JSON.stringify(headers);
};

const receiptHashOf = (response: Record<string, unknown>): ProductionHash | null =>
  typeof response.receipt_hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(response.receipt_hash)
    ? response.receipt_hash as ProductionHash : null;

const parseLocalProviderCooldownReceipt = (body: Buffer, response: unknown): unknown => {
  const request = JSON.parse(body.toString("utf8")) as Record<string, unknown>;
  return parseProviderCooldownReceipt(response, {
    requestId: String(request.request_id ?? ""),
    incidentRequestId: String(request.incident_request_id ?? ""),
    payloadHash: hashCanonical(request),
    dialogHash: request.dialog_hash as ProductionHash,
    observationHash: request.observation_hash as ProductionHash,
    targetRefHash: request.target_ref_hash as ProductionHash,
    documentRefHash: request.document_ref_hash as ProductionHash,
  });
};

const assertHydratedReceipt = (local: LocalReceiptIntent, response: Record<string, unknown>): void => {
  if (local.kind === "provider_cooldown") {
    parseLocalProviderCooldownReceipt(local.body_blob, response);
    return;
  }
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
    const existing = this.database.prepare(`select kind,path,method,headers_json,body_blob,sent_at,last_error
      from production_outbox where idempotency_key=?`).get(write.idempotency_key) as Readonly<{
      kind: string; path: string; method: string; headers_json: string; body_blob: Buffer;
      sent_at: string | null; last_error: string | null;
    }> | undefined;
    if (existing) {
      if (existing.kind !== write.kind || existing.path !== write.path || existing.method !== write.method
        || !existing.body_blob.equals(bytes)
        || headersWithoutExecutionFence(existing.headers_json) !== headersWithoutExecutionFence(headers)) {
        throw executionFailure("failed", "PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT");
      }
      if (existing.headers_json !== headers && !existing.sent_at
        && existing.last_error !== "WEBSITE_ATTEMPT_REPLACED") {
        this.database.prepare(`update production_outbox set headers_json=?,last_error=null
          where idempotency_key=? and sent_at is null`).run(headers, write.idempotency_key);
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
      ) : existing.kind === "provider_cooldown"
        ? parseLocalProviderCooldownReceipt(existing.body_blob, response) : response;
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
        sent_at=?,last_error=null
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

  public hasUnsentOutbox(jobId: string): boolean {
    return Boolean(this.database.prepare(`select 1 from production_outbox
      where instr(path,?)>0 and sent_at is null
        and (last_error is null or kind='provider_cooldown') limit 1`
    ).get(jobPathMarker(jobId)));
  }

  public hasProviderCooldownHistory(): boolean {
    return Boolean(this.database.prepare(
      "select 1 from production_outbox where kind='provider_cooldown' limit 1",
    ).get());
  }

  public hasUndeliveredProviderCooldown(): boolean {
    return Boolean(this.database.prepare(`select 1 from production_outbox
      where kind='provider_cooldown' and sent_at is null limit 1`).get());
  }

  public latestProviderCooldownServerNow(): string | null {
    const row = this.database.prepare(`select response_json from production_outbox
      where kind='provider_cooldown' and sent_at is not null and response_json is not null
      order by created_at desc,idempotency_key desc limit 1`).get() as
      { response_json: string } | undefined;
    if (!row) return null;
    try {
      const response = JSON.parse(row.response_json) as Record<string, unknown>;
      return typeof response.server_now === "string" && Number.isFinite(Date.parse(response.server_now))
        ? response.server_now : null;
    } catch { return null; }
  }

  public latestProviderCooldownClearance(): "pending_unknown" | "confirmed_absent" | "not_cleared" | null {
    const row = this.database.prepare(`select response_json from production_outbox
      where kind='provider_cooldown' and sent_at is not null and response_json is not null
      order by created_at desc,idempotency_key desc limit 1`).get() as
      { response_json: string } | undefined;
    if (!row) return null;
    try {
      const clearance = (JSON.parse(row.response_json) as Record<string, unknown>).clearance;
      return clearance === "pending_unknown" || clearance === "confirmed_absent"
        || clearance === "not_cleared" ? clearance : null;
    } catch { return null; }
  }

  public pendingProviderCooldownRequestIds(): readonly string[] {
    const rows = this.database.prepare(`select idempotency_key from production_outbox
      where kind='provider_cooldown' and sent_at is null
        and (json_extract(cast(body_blob as text),'$.phase')='clearance'
          or exists(select 1 from production_outbox clearance
            where clearance.kind='provider_cooldown'
              and json_extract(cast(clearance.body_blob as text),'$.phase')='clearance'
              and json_extract(cast(clearance.body_blob as text),'$.incident_request_id')=
                json_extract(cast(production_outbox.body_blob as text),'$.incident_request_id')))
      order by created_at,idempotency_key`).all() as Array<{ idempotency_key: string }>;
    return Object.freeze(rows.map((row) => row.idempotency_key));
  }

  public pendingProviderCooldownIncidentBodies(): readonly Readonly<Record<string, unknown>>[] {
    const rows = this.database.prepare(`select body_blob from production_outbox
      where kind='provider_cooldown'
        and json_extract(cast(body_blob as text),'$.phase')='incident'
        and not exists(select 1 from production_outbox clearance
          where clearance.kind='provider_cooldown'
            and json_extract(cast(clearance.body_blob as text),'$.phase')='clearance'
            and json_extract(cast(clearance.body_blob as text),'$.clearance')='confirmed_absent'
            and json_extract(cast(clearance.body_blob as text),'$.incident_request_id')=
              json_extract(cast(production_outbox.body_blob as text),'$.incident_request_id'))
      order by created_at,idempotency_key`).all() as Array<{ body_blob: Buffer }>;
    return Object.freeze(rows.map((row) => Object.freeze(
      JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>,
    )));
  }

  public providerCooldownSessionRecoveryIdentity(): Readonly<{
    workerInstanceId: string;
    sessionOpenRequestId: string;
  }> | null {
    const rows = this.database.prepare(`select body_blob from production_outbox
      where kind='provider_cooldown' and sent_at is null
      order by created_at,idempotency_key`).all() as Array<{ body_blob: Buffer }>;
    const bodies = rows.map((row) =>
      JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>);
    if (bodies.length === 0) return null;
    const identities = bodies.map((body) => ({
      workerInstanceId: body.worker_instance_id,
      sessionOpenRequestId: body.session_open_request_id,
    }));
    if (identities.some((identity) => typeof identity.workerInstanceId !== "string"
      || !identity.workerInstanceId || typeof identity.sessionOpenRequestId !== "string"
      || !identity.sessionOpenRequestId)
      || identities.some((identity) => identity.workerInstanceId !== identities[0]!.workerInstanceId
        || identity.sessionOpenRequestId !== identities[0]!.sessionOpenRequestId)) {
      throw executionFailure("failed", "PROVIDER_COOLDOWN_SESSION_RECOVERY_IDENTITY_INVALID");
    }
    return Object.freeze({
      workerInstanceId: identities[0]!.workerInstanceId as string,
      sessionOpenRequestId: identities[0]!.sessionOpenRequestId as string,
    });
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
    assertHydratedReceipt(local, receipt.response_json);
    this.database.prepare(`update production_outbox set response_json=?,response_hash=?,receipt_hash=?,
      sent_at=coalesce(sent_at,?),last_error=null
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

  private recordDeliveryFailure(
    idempotencyKey: string,
    error: unknown,
  ): void {
    const transport = typedRuntimeTransportFailure(error);
    const staleFenceRejected = transport?.code === STALE_LEASE_FENCE_CODE
      && transport.httpStatus === 409;
    const code = staleFenceRejected
      ? STALE_LEASE_FENCE_REMOTE_PROOF
      : failureCode(error, "OUTBOX_DELIVERY_FAILED");
    const changed = this.database.prepare(`update production_outbox
      set last_error=? where idempotency_key=? and sent_at is null`
    ).run(code, idempotencyKey);
    if (changed.changes === 0 && !this.readOutboxAuthority(idempotencyKey)) {
      throw new Error("PRODUCTION_OUTBOX_INTENT_MISSING");
    }
    this.notifyOutbox(this.readOutboxAuthority(idempotencyKey));
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
      if (authority.lastError && authority.kind !== "provider_cooldown") {
        throw executionFailure("failed", authority.lastError);
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
      sent_at,last_error,response_json,response_hash,receipt_hash
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
