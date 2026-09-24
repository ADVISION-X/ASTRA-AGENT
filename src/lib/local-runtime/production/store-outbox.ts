import { executionFailure, failureCode } from "../../execution-failure.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";
import { hashCanonical, parseTerminalReceipt, parseTerminalReceiptExpectation, sha256,
  WebsiteAgentResultSchema, type ProductionHash, type WebsiteAgentResult } from "./contracts.js";
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
const RESULT_OBJECT_CONFLICT_REMOTE_PROOF = "WEBSITE_HTTP_409:AI_PRODUCTION_RESULT_OBJECT_CONFLICT";
const jobPathMarker = (jobId: string): string => `/jobs/${encodeURIComponent(jobId)}/`;
const resultPayloadIntentIdentity = (jobId: string, attemptId: string,
  contentHash: ProductionHash): Readonly<{ requestId: string; path: string }> => {
  const requestId = `aipresult_${hashCanonical({ job_id: jobId, attempt_id: attemptId,
    role: "result_payload", content_hash: contentHash }).slice(7, 47)}`;
  const attemptHash = hashCanonical({ attempt_id: attemptId }).slice(7, 23);
  const artifactId = `airesult_${jobId.replace(/[^A-Za-z0-9_-]/gu, "_").slice(-64)}_${attemptHash}_result_payload_${contentHash.slice(-16)}`;
  return Object.freeze({ requestId,
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(jobId)}/artifacts/result_payload/${encodeURIComponent(artifactId)}` });
};
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
  public readUploadedResultEnvelope(jobId: string, attemptId: string): WebsiteAgentResult | null {
    const attemptHash = hashCanonical({ attempt_id: attemptId }).slice(7, 23);
    const rows = this.database.prepare(`select body_blob from production_outbox
      where kind='artifact' and instr(path,?)>0
        and instr(path,'/artifacts/result_envelope/')>0
        and instr(path,?)>0 order by created_at desc,idempotency_key desc`
    ).all(jobPathMarker(jobId), `_${attemptHash}_result_envelope_`) as Array<{ body_blob: Buffer }>;
    for (const row of rows) {
      let parsed: unknown;
      try { parsed = JSON.parse(row.body_blob.toString("utf8")); }
      catch { throw executionFailure("failed", "PRODUCTION_RESULT_ENVELOPE_CORRUPT"); }
      const result = WebsiteAgentResultSchema.safeParse(parsed);
      if (!result.success || result.data.job_id !== jobId) {
        throw executionFailure("failed", "PRODUCTION_RESULT_ENVELOPE_CORRUPT");
      }
      return result.data;
    }
    return null;
  }

  public readResultOutboxHistoryEvidence(jobId: string, attemptId: string): Readonly<{
    historyHash: ProductionHash; rowCount: number; candidateCount: number;
  }> {
    const rows = this.database.prepare(`select idempotency_key,kind,path,body_blob from production_outbox
      where instr(path,?)>0 and kind in ('artifact','terminal')
      order by idempotency_key`).all(jobPathMarker(jobId)) as Array<{
        idempotency_key: string; kind: string; path: string; body_blob: Buffer;
      }>;
    const facts = rows.map((row) => ({
      idempotencyKey: row.idempotency_key, kind: row.kind, path: row.path,
      bodyHash: sha256(row.body_blob),
    }));
    const attemptHash = hashCanonical({ attempt_id: attemptId }).slice(7, 23);
    return Object.freeze({
      historyHash: hashCanonical(facts),
      rowCount: rows.length,
      candidateCount: rows.filter((row) => {
        if (row.kind !== "terminal") return row.path.includes("/artifacts/result_envelope/")
          && row.path.includes(`_${attemptHash}_result_envelope_`);
        let terminalAttemptId: unknown = null;
        try {
          const body: unknown = JSON.parse(row.body_blob.toString("utf8"));
          if (typeof body === "object" && body !== null && "attempt_id" in body
            && typeof body.attempt_id === "string" && body.attempt_id.length > 0) {
            terminalAttemptId = body.attempt_id;
          }
        } catch {
          // A corrupt terminal body remains an unresolved candidate for this job.
          terminalAttemptId = null;
        }
        return terminalAttemptId === null || terminalAttemptId === attemptId;
      }).length,
    });
  }

  public readResultPayloadSlotConflict(jobId: string, attemptId: string): Readonly<{
    old_request_id: string; old_payload_hash: ProductionHash; old_receipt_hash: ProductionHash;
    new_request_id: string; new_payload_hash: ProductionHash;
  }> | null {
    const attemptHash = hashCanonical({ attempt_id: attemptId }).slice(7, 23);
    const rows = this.database.prepare(`select idempotency_key,path,body_blob,sent_at,receipt_hash,last_error,response_json
      from production_outbox where kind='artifact' and instr(path,?)>0
        and instr(path,'/artifacts/result_payload/')>0 and instr(path,?)>0`
    ).all(jobPathMarker(jobId), `_${attemptHash}_result_payload_`) as Array<{
      idempotency_key: string;
      path: string;
      body_blob: Buffer; sent_at: string | null; receipt_hash: string | null;
      last_error: string | null; response_json: string | null;
    }>;
    const accepted = rows.filter((row) => row.sent_at !== null && row.receipt_hash !== null
      && row.response_json !== null);
    const conflicted = rows.filter((row) => row.sent_at === null
      && row.last_error === RESULT_OBJECT_CONFLICT_REMOTE_PROOF);
    for (const old of accepted) for (const next of conflicted) {
      if (old.body_blob.equals(next.body_blob)) continue;
      let receipt: Record<string, unknown>;
      try { receipt = JSON.parse(old.response_json!) as Record<string, unknown>; }
      catch { continue; }
      const oldHash = sha256(old.body_blob);
      const nextHash = sha256(next.body_blob);
      const oldIdentity = resultPayloadIntentIdentity(jobId, attemptId, oldHash);
      const nextIdentity = resultPayloadIntentIdentity(jobId, attemptId, nextHash);
      if (old.idempotency_key !== oldIdentity.requestId || old.path !== oldIdentity.path
        || next.idempotency_key !== nextIdentity.requestId || next.path !== nextIdentity.path) continue;
      if (receipt.role !== "result_payload" || receipt.sha256 !== oldHash
        || receipt.receipt_hash !== old.receipt_hash
        || receipt.artifact_id !== decodeURIComponent(old.path.split("/").at(-1) ?? "")
        || typeof receipt.object_ref !== "string"
        || receipt.media_type !== "application/json"
        || receipt.byte_length !== old.body_blob.byteLength) continue;
      return Object.freeze({
        old_request_id: old.idempotency_key, old_payload_hash: oldHash,
        old_receipt_hash: old.receipt_hash as ProductionHash,
        new_request_id: next.idempotency_key, new_payload_hash: nextHash,
      });
    }
    return null;
  }

  public readStagedTerminalReceipts(jobId: string, attemptId: string,
    result: WebsiteAgentResult): readonly ProductionHash[] {
    const rows = this.database.prepare(`select body_blob from production_outbox
      where kind='terminal' and instr(path,?)>0 order by created_at desc,idempotency_key desc`
    ).all(jobPathMarker(jobId)) as Array<{ body_blob: Buffer }>;
    for (const row of rows) {
      let body: Record<string, unknown>;
      try { body = JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>; }
      catch { continue; }
      if (body.job_id !== jobId || body.attempt_id !== attemptId
        || body.payload_hash !== hashCanonical(result)) continue;
      const receipts = body.result_object_receipts;
      if (!Array.isArray(receipts) || receipts.length < 2
        || receipts.some((receipt) => typeof receipt !== "string"
          || !/^sha256:[a-f0-9]{64}$/u.test(receipt))) break;
      return Object.freeze([...receipts] as ProductionHash[]);
    }
    throw executionFailure("failed", "PRODUCTION_STAGED_TERMINAL_INTENT_MISSING");
  }

  public hydrateCurrentResultArtifacts(jobId: string, attemptId: string,
    result: WebsiteAgentResult, remoteReceipts: readonly RemoteReceipt[]): void {
    const expected = this.readStagedTerminalReceipts(jobId, attemptId, result);
    const selected = remoteReceipts.filter((receipt) => receipt.write_kind === "artifact"
      && expected.includes(receipt.response_json.receipt_hash as ProductionHash));
    if (selected.length !== expected.length
      || new Set(selected.map((receipt) => receipt.response_json.receipt_hash)).size !== expected.length) {
      throw executionFailure("failed", "PRODUCTION_RESULT_ARTIFACT_READBACK_INCOMPLETE");
    }
    this.hydrateRemoteOutboxReceipts(jobId, selected);
    const delivered = this.database.prepare(`select receipt_hash from production_outbox
      where kind='artifact' and instr(path,?)>0 and sent_at is not null
        and receipt_hash is not null`).all(jobPathMarker(jobId)) as Array<{ receipt_hash: string }>;
    if (expected.some((receipt) => !delivered.some((row) => row.receipt_hash === receipt))) {
      throw executionFailure("failed", "PRODUCTION_RESULT_ARTIFACT_READBACK_INCOMPLETE");
    }
  }

  public stageResultAndEnqueueTerminal(input: Readonly<{
    jobId: string;
    attemptId: string;
    result: WebsiteAgentResult;
    terminal: ProductionOutboxWrite;
    websiteStagedArtifactReceipts?: readonly Readonly<{ role: string; receipt_hash: ProductionHash }>[];
  }>): void {
    if (input.terminal.kind !== "terminal") throw executionFailure("failed", "PRODUCTION_TERMINAL_INTENT_INVALID");
    this.database.transaction(() => {
      let terminal: Record<string, unknown>;
      try { terminal = JSON.parse(Buffer.from(input.terminal.body).toString("utf8")) as Record<string, unknown>; }
      catch { throw executionFailure("failed", "PRODUCTION_TERMINAL_INTENT_INVALID"); }
      const expected = parseTerminalReceiptExpectation(terminal);
      const firstRaw = this.readAttemptFailureRaw(input.jobId);
      const sourceFact = terminal.terminal_source_first_fact;
      const sourceMatches = firstRaw === null ? sourceFact === null : Boolean(sourceFact
        && typeof sourceFact === "object" && !Array.isArray(sourceFact)
        && (sourceFact as Record<string, unknown>).raw_json === firstRaw
        && (sourceFact as Record<string, unknown>).hash === sha256(Buffer.from(firstRaw, "utf8")));
      const receipts = terminal.result_object_receipts;
      const delivered = this.database.prepare(`select path,body_blob,response_json,receipt_hash
        from production_outbox where kind='artifact' and instr(path,?)>0
          and sent_at is not null and response_hash is not null
          and receipt_hash is not null`).all(jobPathMarker(input.jobId)) as {
        path: string; body_blob: Buffer; response_json: string; receipt_hash: string;
      }[];
      const selected = Array.isArray(receipts) ? delivered.filter((row) => receipts.includes(row.receipt_hash)) : [];
      const attemptHash = hashCanonical({ attempt_id: input.attemptId }).slice(7, 23);
      const selectedRoles: string[] = [];
      const receiptRowsValid = selected.length === (Array.isArray(receipts) ? receipts.length : -1)
        && selected.every((row) => {
          let response: Record<string, unknown>;
          try { response = JSON.parse(row.response_json) as Record<string, unknown>; }
          catch { return false; }
          const role = response.role;
          const artifactId = response.artifact_id;
          const roleAttemptHash = role === "generated_image"
            ? hashCanonical({ attempt_id: input.attemptId, role }).slice(7, 23) : attemptHash;
          if (typeof role !== "string" || typeof artifactId !== "string"
            || !["result_payload", "result_envelope", "generated_image"].includes(role)
            || !artifactId.includes(roleAttemptHash)
            || !row.path.includes(`/artifacts/${role}/${encodeURIComponent(artifactId)}`)
            || response.receipt_hash !== row.receipt_hash) return false;
          selectedRoles.push(role);
          if (role === "result_payload") return row.receipt_hash === input.result.result_object_receipt.receipt_hash
            && response.sha256 === input.result.result_payload_hash;
          if (role === "result_envelope") {
            try { return json(JSON.parse(row.body_blob.toString("utf8"))) === json(input.result); }
            catch { return false; }
          }
          return true;
        });
      const remoteReceipts = input.websiteStagedArtifactReceipts;
      const remoteReceiptValid = remoteReceipts !== undefined && Array.isArray(receipts)
        && remoteReceipts.length === receipts.length
        && remoteReceipts.every((item) => receipts.includes(item.receipt_hash))
        && remoteReceipts.filter((item) => item.role === "result_payload").length === 1
        && remoteReceipts.filter((item) => item.role === "result_envelope").length === 1
        && remoteReceipts.find((item) => item.role === "result_payload")?.receipt_hash
          === input.result.result_object_receipt.receipt_hash;
      if (expected.job_id !== input.jobId || terminal.attempt_id !== input.attemptId
        || terminal.payload_hash !== hashCanonical(input.result)
        || input.result.evidence_refs.length === 0 || !sourceMatches
        || !Array.isArray(receipts) || receipts.length < 2 || receipts.length > 4
        || new Set(receipts).size !== receipts.length
        || !(receiptRowsValid
          && selectedRoles.filter((role) => role === "result_payload").length === 1
          && selectedRoles.filter((role) => role === "result_envelope").length === 1)
          && !remoteReceiptValid) {
        throw executionFailure("failed", "PRODUCTION_TERMINAL_INTENT_INVALID");
      }
      this.stageResult(input.jobId, input.attemptId, input.result);
      this.persistOutboxWrite(input.terminal);
    })();
    this.notifyOutbox(this.readOutboxAuthority(input.terminal.idempotency_key));
  }
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
    this.persistOutboxWrite(write);
    this.notifyOutbox(this.readOutboxAuthority(write.idempotency_key));
  }

  private persistOutboxWrite(write: ProductionOutboxWrite): void {
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
      return;
    }
    this.database.prepare(`insert into production_outbox(
      idempotency_key,kind,path,method,headers_json,body_blob,created_at
    ) values(?,?,?,?,?,?,?)`).run(
      write.idempotency_key, write.kind, write.path, write.method, headers, bytes, now(),
    );
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
        and (last_error is null or (kind='provider_cooldown'
          and last_error<>'BUSINESS_ADMITTED')) limit 1`
    ).get(jobPathMarker(jobId)));
  }

  public hasProviderCooldownHistory(): boolean {
    return Boolean(this.database.prepare(
      "select 1 from production_outbox where kind='provider_cooldown' and coalesce(last_error,'')<>'BUSINESS_ADMITTED' limit 1",
    ).get());
  }

  public hasUndeliveredProviderCooldown(): boolean {
    return Boolean(this.database.prepare(`select 1 from production_outbox
      where kind='provider_cooldown' and sent_at is null
        and coalesce(last_error,'')<>'BUSINESS_ADMITTED' limit 1`).get());
  }

  public latestProviderCooldownServerNow(): string | null {
    const row = this.database.prepare(`select response_json from production_outbox
      where kind='provider_cooldown' and sent_at is not null and response_json is not null
      order by rowid desc limit 1`).get() as
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
      order by rowid desc limit 1`).get() as
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
        and coalesce(last_error,'')<>'BUSINESS_ADMITTED'
        and (json_extract(cast(body_blob as text),'$.phase')='clearance'
          or exists(select 1 from production_outbox clearance
            where clearance.kind='provider_cooldown'
              and json_extract(cast(clearance.body_blob as text),'$.phase')='clearance'
              and json_extract(cast(clearance.body_blob as text),'$.incident_request_id')=
                json_extract(cast(production_outbox.body_blob as text),'$.incident_request_id')))
      order by production_outbox.rowid`).all() as Array<{ idempotency_key: string }>;
    return Object.freeze(rows.map((row) => row.idempotency_key));
  }

  public pendingProviderCooldownIncidentBodies(): readonly Readonly<Record<string, unknown>>[] {
    const rows = this.database.prepare(`select body_blob from production_outbox
      where kind='provider_cooldown'
        and coalesce(last_error,'')<>'BUSINESS_ADMITTED'
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
    const rows = this.database.prepare(`select body_blob from production_outbox notice
      where notice.kind='provider_cooldown'
        and coalesce(notice.last_error,'')<>'BUSINESS_ADMITTED'
        and (notice.sent_at is null
          or (json_extract(cast(notice.body_blob as text),'$.phase')='incident'
            and not exists(select 1 from production_outbox clearance
              where clearance.kind='provider_cooldown' and clearance.sent_at is not null
                and json_extract(cast(clearance.body_blob as text),'$.phase')='clearance'
                and json_extract(cast(clearance.body_blob as text),'$.clearance')='confirmed_absent'
                and json_extract(cast(clearance.body_blob as text),'$.incident_request_id')=
                  json_extract(cast(notice.body_blob as text),'$.incident_request_id'))))
      order by notice.created_at,notice.idempotency_key`).all() as Array<{ body_blob: Buffer }>;
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
    const resultObjectConflictRejected = transport?.code === "AI_PRODUCTION_RESULT_OBJECT_CONFLICT"
      && transport.httpStatus === 409;
    const code = staleFenceRejected
      ? STALE_LEASE_FENCE_REMOTE_PROOF
      : resultObjectConflictRejected ? RESULT_OBJECT_CONFLICT_REMOTE_PROOF
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
