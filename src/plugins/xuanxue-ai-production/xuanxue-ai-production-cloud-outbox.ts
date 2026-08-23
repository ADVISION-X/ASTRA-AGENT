import type Database from "better-sqlite3";
import { createHash } from "node:crypto";

export type XuanxueAiProductionCloudWriteKind = "checkpoint" | "artifact" | "terminal" | "cancel" | "handover";

export interface XuanxueAiProductionCloudOutboxWrite {
  readonly requestId: string;
  readonly jobId: string;
  readonly writeKind: XuanxueAiProductionCloudWriteKind;
  readonly method: "POST" | "PUT";
  readonly pathname: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Readonly<Record<string, unknown>> | null;
  readonly bodyFile: string | null;
  readonly payloadHash: `sha256:${string}`;
}

interface OutboxRow {
  request_id: string; job_id: string; write_kind: XuanxueAiProductionCloudWriteKind;
  method: "POST" | "PUT"; pathname: string; headers_json: string;
  body_json: string | null; body_file: string | null; payload_hash: `sha256:${string}`;
}

const fromRow = (row: OutboxRow): XuanxueAiProductionCloudOutboxWrite => ({
  requestId: row.request_id, jobId: row.job_id, writeKind: row.write_kind,
  method: row.method, pathname: row.pathname,
  headers: Object.freeze(JSON.parse(row.headers_json) as Record<string, string>),
  body: row.body_json ? Object.freeze(JSON.parse(row.body_json) as Record<string, unknown>) : null,
  bodyFile: row.body_file, payloadHash: row.payload_hash,
});

export class XuanxueAiProductionCloudOutbox {
  public constructor(private readonly database: Database.Database) {}

  private enqueueWithinTransaction(write: XuanxueAiProductionCloudOutboxWrite): XuanxueAiProductionCloudOutboxWrite {
    const prior = this.database.prepare(
      "select request_id,job_id,write_kind,method,pathname,headers_json,body_json,body_file,payload_hash from production_cloud_outbox where request_id=?",
    ).get(write.requestId) as OutboxRow | undefined;
    if (prior) {
      const existing = fromRow(prior);
      if (existing.payloadHash !== write.payloadHash || existing.jobId !== write.jobId || existing.writeKind !== write.writeKind) {
        throw new Error("XUANXUE_AI_PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT");
      }
      return existing;
    }
    this.database.prepare(`insert into production_cloud_outbox(
      request_id,job_id,write_kind,method,pathname,headers_json,body_json,body_file,
      payload_hash,state,created_at
    ) values(?,?,?,?,?,?,?,?,?,'pending',?)`).run(
      write.requestId, write.jobId, write.writeKind, write.method, write.pathname,
      JSON.stringify(write.headers), write.body ? JSON.stringify(write.body) : null,
      write.bodyFile, write.payloadHash, new Date().toISOString(),
    );
    return write;
  }

  public enqueue(write: XuanxueAiProductionCloudOutboxWrite): XuanxueAiProductionCloudOutboxWrite {
    return this.database.transaction(() => this.enqueueWithinTransaction(write))();
  }

  public pending(): readonly XuanxueAiProductionCloudOutboxWrite[] {
    const rows = this.database.prepare(`select request_id,job_id,write_kind,method,pathname,
      headers_json,body_json,body_file,payload_hash from production_cloud_outbox
      where state='pending' order by created_at,request_id`).all() as OutboxRow[];
    return Object.freeze(rows.map(fromRow));
  }

  private persistClaimIdentityWithinTransaction(input: {
    jobId: string; attemptId: string; leaseVersion: number; createdAt: string;
    grant: Readonly<Record<string, unknown>>;
  }): void {
    const grantJson = JSON.stringify(input.grant);
    const grantHash = `sha256:${createHash("sha256").update(grantJson).digest("hex")}`;
    const prior = this.database.prepare(`select grant_hash from production_cloud_claim_ledger
      where job_id=? and attempt_id=? and lease_version=?`).get(
      input.jobId, input.attemptId, input.leaseVersion,
    ) as { grant_hash?: string } | undefined;
    if (prior && prior.grant_hash !== grantHash) throw new Error("XUANXUE_AI_PRODUCTION_CLAIM_LEDGER_CONFLICT");
    if (!prior) this.database.prepare(`insert into production_cloud_claim_ledger(
      job_id,attempt_id,lease_version,created_at,grant_json,grant_hash,persisted_at
    ) values(?,?,?,?,?,?,?)`).run(
      input.jobId, input.attemptId, input.leaseVersion, input.createdAt,
      grantJson, grantHash, new Date().toISOString(),
    );
  }

  public persistClaimIdentity(input: {
    jobId: string; attemptId: string; leaseVersion: number; createdAt: string;
    grant: Readonly<Record<string, unknown>>;
  }): void {
    this.database.transaction(() => this.persistClaimIdentityWithinTransaction(input))();
  }

  public pendingClaimRequest(): Readonly<{ requestId: string; payload: Record<string, unknown>; payloadHash: string }> | null {
    const row = this.database.prepare(`select request_id,payload_json,payload_hash from production_cloud_claim_requests
      where state='pending' order by created_at,request_id limit 1`).get() as { request_id: string; payload_json: string; payload_hash: string } | undefined;
    return row ? Object.freeze({ requestId: row.request_id, payload: Object.freeze(JSON.parse(row.payload_json) as Record<string, unknown>), payloadHash: row.payload_hash }) : null;
  }

  public beginClaimRequest(input: { requestId: string; payload: Record<string, unknown>; payloadHash: string }): void {
    const prior = this.pendingClaimRequest();
    if (prior) {
      if (prior.requestId !== input.requestId || prior.payloadHash !== input.payloadHash) throw new Error("XUANXUE_AI_PRODUCTION_CLAIM_REQUEST_PENDING");
      return;
    }
    this.database.prepare(`insert into production_cloud_claim_requests(
      request_id,payload_json,payload_hash,state,created_at
    ) values(?,?,?,'pending',?)`).run(input.requestId,JSON.stringify(input.payload),input.payloadHash,new Date().toISOString());
  }

  public commitClaimReceipt(input: {
    requestId: string;
    response: unknown;
    claims: readonly {
      jobId: string; attemptId: string; leaseVersion: number; createdAt: string;
      grant: Readonly<Record<string, unknown>>;
    }[];
  }): void {
    this.database.transaction(() => {
      const pending = this.database.prepare(
        "select request_id from production_cloud_claim_requests where request_id=? and state='pending'",
      ).get(input.requestId) as { request_id: string } | undefined;
      if (!pending) throw new Error("XUANXUE_AI_PRODUCTION_CLAIM_REQUEST_ACK_MISSING");
      for (const claim of input.claims) this.persistClaimIdentityWithinTransaction(claim);
      const result = this.database.prepare(
        "delete from production_cloud_claim_requests where request_id=? and state='pending'",
      ).run(input.requestId);
      if (result.changes !== 1) throw new Error("XUANXUE_AI_PRODUCTION_CLAIM_REQUEST_ACK_MISSING");
      void input.response;
    })();
  }

  public enqueueCheckpoint(input: {
    jobId: string;
    attemptId: string;
    leaseVersion: number;
    buildWrite: (checkpointSequence: number) => XuanxueAiProductionCloudOutboxWrite;
  }): XuanxueAiProductionCloudOutboxWrite {
    return this.database.transaction(() => {
      this.database.prepare(`insert into production_cloud_job_state(job_id,attempt_id,lease_version,checkpoint_sequence)
        values(?,?,?,0) on conflict(job_id,attempt_id,lease_version) do nothing`).run(
        input.jobId, input.attemptId, input.leaseVersion,
      );
      const row = this.database.prepare(`update production_cloud_job_state set checkpoint_sequence=checkpoint_sequence+1
        where job_id=? and attempt_id=? and lease_version=? returning checkpoint_sequence`).get(
        input.jobId, input.attemptId, input.leaseVersion,
      ) as { checkpoint_sequence: number } | undefined;
      if (!row) throw new Error("XUANXUE_AI_PRODUCTION_CHECKPOINT_SEQUENCE_STATE_MISSING");
      const write = input.buildWrite(row.checkpoint_sequence);
      if (write.jobId !== input.jobId || write.writeKind !== "checkpoint" && write.writeKind !== "handover") {
        throw new Error("XUANXUE_AI_PRODUCTION_CHECKPOINT_OUTBOX_BINDING_INVALID");
      }
      return this.enqueueWithinTransaction(write);
    })();
  }

  public acknowledge(requestId: string, response: unknown): string | null {
    const prior = this.database.prepare("select body_file from production_cloud_outbox where request_id=? and state='pending'")
      .get(requestId) as { body_file: string | null } | undefined;
    if (!prior) throw new Error("XUANXUE_AI_PRODUCTION_OUTBOX_ACK_MISSING");
    const result = this.database.prepare("delete from production_cloud_outbox where request_id=? and state='pending'").run(requestId);
    if (result.changes !== 1) throw new Error("XUANXUE_AI_PRODUCTION_OUTBOX_ACK_MISSING");
    void response;
    return prior.body_file;
  }
}
