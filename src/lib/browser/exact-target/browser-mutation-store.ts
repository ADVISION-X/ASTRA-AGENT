import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export type BrowserMutationState = "PREPARED" | "SENT" | "CONFIRMED" | "FAILED" | "UNKNOWN";

export type BrowserMutationIdentity = Readonly<{
  commandId: string;
  ownerPluginId: string;
  jobId: string;
  attemptId: string;
  leaseVersion: number;
  executionFenceHash: `sha256:${string}`;
  targetRef: string;
  documentRef: string;
  actionId: string;
  requestHash: `sha256:${string}`;
  payloadHash: `sha256:${string}`;
}>;

export type BrowserMutationRecoveryState = Readonly<{
  mutation: BrowserMutationIdentity;
  current: BrowserMutationState;
  authorityHash: `sha256:${string}`;
}>;

type MutationRow = Readonly<{
  command_id: string;
  owner_plugin_id: string;
  job_id: string;
  attempt_id: string;
  lease_version: number;
  execution_fence_hash: `sha256:${string}`;
  target_ref: string;
  document_ref: string;
  action_id: string;
  request_hash: `sha256:${string}`;
  payload_hash: `sha256:${string}`;
  state: BrowserMutationState;
}>;

const mutationIdentity = (row: MutationRow): BrowserMutationIdentity => ({
  commandId: row.command_id,
  ownerPluginId: row.owner_plugin_id,
  jobId: row.job_id,
  attemptId: row.attempt_id,
  leaseVersion: row.lease_version,
  executionFenceHash: row.execution_fence_hash,
  targetRef: row.target_ref,
  documentRef: row.document_ref,
  actionId: row.action_id,
  requestHash: row.request_hash,
  payloadHash: row.payload_hash,
});

const mutationAuthorityHash = (row: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(row)).digest("hex")}`;

export const resolveStoredBrowserMutationAuthority = (
  dataDir: string,
  authorityRef: string,
  authorityHash: `sha256:${string}`,
): "verified" | "missing" | "mismatch" => {
  if (!authorityRef.startsWith("browser-mutation:")) return "missing";
  const commandId = authorityRef.slice("browser-mutation:".length);
  const file = join(dataDir, "browser", "browser-mutations.sqlite");
  if (!commandId || !existsSync(file)) return "missing";
  let database: Database.Database | null = null;
  try {
    database = new Database(file, { readonly: true, fileMustExist: true });
    const row = database.prepare(`select command_id,owner_plugin_id,job_id,attempt_id,
      lease_version,execution_fence_hash,target_ref,document_ref,action_id,request_hash,payload_hash,
      proof_hash,state,reason,updated_at from browser_mutations where command_id=?`).get(commandId);
    if (!row) return "missing";
    return mutationAuthorityHash(row) === authorityHash ? "verified" : "mismatch";
  } catch {
    return "missing";
  } finally {
    database?.close();
  }
};

export class BrowserMutationStore {
  private readonly database: Database.Database;

  public constructor(dataDir: string) {
    const file = join(dataDir, "browser", "browser-mutations.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    this.database = new Database(file);
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("synchronous = FULL");
    this.database.exec(`
      create table if not exists browser_mutations (
        command_id text primary key,
        owner_plugin_id text not null,
        job_id text not null,
        attempt_id text not null,
        lease_version integer not null,
        execution_fence_hash text not null,
        target_ref text not null,
        document_ref text not null,
        action_id text not null,
        request_hash text not null,
        payload_hash text not null,
        proof_hash text,
        state text not null check(state in ('PREPARED','SENT','CONFIRMED','FAILED','UNKNOWN')),
        reason text,
        updated_at text not null
      );
      create index if not exists browser_mutations_unresolved
        on browser_mutations(job_id,attempt_id,lease_version,execution_fence_hash,state);
    `);
    this.database.transaction(() => {
      const now = new Date().toISOString();
      this.database.prepare("update browser_mutations set state='UNKNOWN',reason='BROWSER_OUTCOME_UNKNOWN',updated_at=? where state='SENT'").run(now);
      this.database.prepare("update browser_mutations set state='FAILED',reason='BROWSER_COMMAND_NOT_SENT',updated_at=? where state='PREPARED'").run(now);
    })();
  }

  public prepare(input: BrowserMutationIdentity): void {
    this.database.prepare(`insert into browser_mutations(
      command_id,owner_plugin_id,job_id,attempt_id,lease_version,execution_fence_hash,
      target_ref,document_ref,action_id,request_hash,payload_hash,state,updated_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,'PREPARED',?)`).run(
      input.commandId, input.ownerPluginId, input.jobId, input.attemptId,
      input.leaseVersion, input.executionFenceHash, input.targetRef, input.documentRef,
      input.actionId, input.requestHash, input.payloadHash, new Date().toISOString(),
    );
  }

  public markSent(commandId: string): void {
    this.transition(commandId, "PREPARED", "SENT", null, null);
  }

  public markUnknown(commandId: string, reason: string, proofHash: `sha256:${string}` | null = null): void {
    const result = this.database.prepare(`update browser_mutations
      set state='UNKNOWN',reason=?,proof_hash=coalesce(?,proof_hash),updated_at=?
      where command_id=? and state in ('SENT','UNKNOWN')`).run(
      reason, proofHash, new Date().toISOString(), commandId,
    );
    if (result.changes !== 1) throw new Error("BROWSER_OUTCOME_UNKNOWN");
  }

  public markFailedBeforeSend(commandId: string, reason: string): void {
    this.transition(commandId, "PREPARED", "FAILED", reason, null);
  }

  public resolve(input: Readonly<{
    commandId: string;
    ownerPluginId: string;
    targetRef: string;
    state: "CONFIRMED" | "FAILED";
    proofHash: `sha256:${string}`;
  }>): void {
    const result = this.database.prepare(`update browser_mutations
      set state=?,proof_hash=?,reason=?,updated_at=?
      where command_id=? and owner_plugin_id=? and target_ref=? and state='UNKNOWN'`).run(
      input.state, input.proofHash, `owning-plugin:${input.ownerPluginId}`,
      new Date().toISOString(), input.commandId, input.ownerPluginId, input.targetRef,
    );
    if (result.changes !== 1) throw new Error("BROWSER_OUTCOME_UNKNOWN");
  }

  public unknownForBinding(input: Readonly<{
    jobId: string;
    attemptId: string;
    leaseVersion: number;
    executionFenceHash: string;
  }>): readonly string[] {
    const rows = this.database.prepare(`select command_id from browser_mutations
      where job_id=? and attempt_id=? and lease_version=? and execution_fence_hash=? and state='UNKNOWN'
      order by updated_at,command_id`).all(
      input.jobId, input.attemptId, input.leaseVersion, input.executionFenceHash,
    ) as readonly { command_id: string }[];
    return Object.freeze(rows.map((row) => row.command_id));
  }

  public readUnknown(commandId: string): BrowserMutationIdentity | null {
    const row = this.database.prepare(`select command_id,owner_plugin_id,job_id,attempt_id,
      lease_version,execution_fence_hash,target_ref,document_ref,action_id,request_hash,payload_hash,state
      from browser_mutations where command_id=? and state='UNKNOWN'`).get(commandId) as MutationRow | undefined;
    return row ? Object.freeze(mutationIdentity(row)) : null;
  }

  public authorityHash(commandId: string): `sha256:${string}` {
    const row = this.database.prepare(`select command_id,owner_plugin_id,job_id,attempt_id,
      lease_version,execution_fence_hash,target_ref,document_ref,action_id,request_hash,payload_hash,
      proof_hash,state,reason,updated_at from browser_mutations where command_id=?`).get(commandId);
    if (!row) throw new Error("BROWSER_OUTCOME_UNKNOWN");
    return mutationAuthorityHash(row);
  }

  public reconciliationStates(): readonly BrowserMutationRecoveryState[] {
    const rows = this.database.prepare(`select command_id,owner_plugin_id,job_id,attempt_id,
      lease_version,execution_fence_hash,target_ref,document_ref,action_id,request_hash,payload_hash,state
      from browser_mutations order by updated_at,command_id`).all() as MutationRow[];
    return Object.freeze(rows.map((row) => Object.freeze({
      mutation: mutationIdentity(row),
      current: row.state,
      authorityHash: this.authorityHash(row.command_id),
    })));
  }

  public close(): void {
    this.database.close();
  }

  private transition(
    commandId: string,
    from: BrowserMutationState,
    to: BrowserMutationState,
    reason: string | null,
    proofHash: `sha256:${string}` | null,
  ): void {
    const result = this.database.prepare(`update browser_mutations
      set state=?,reason=?,proof_hash=?,updated_at=? where command_id=? and state=?`).run(
      to, reason, proofHash, new Date().toISOString(), commandId, from,
    );
    if (result.changes !== 1) throw new Error("BROWSER_OUTCOME_UNKNOWN");
  }
}
