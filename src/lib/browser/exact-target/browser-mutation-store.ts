import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export type BrowserMutationState =
  "PREPARED" | "DISPATCHED" | "CONFIRMED" | "REJECTED" | "FAILED";

export type BrowserMutationIdentity = Readonly<{
  commandId: string;
  logicalMutationId?: `sha256:${string}` | null;
  ownerPluginId: string;
  jobId: string;
  attemptId: string;
  leaseVersion: number;
  executionFenceHash: `sha256:${string}`;
  pluginStepId: string;
  childCapabilityId: string;
  flowVersion: string;
  stepIndex: number;
  effectScope: "target_local" | "provider_effect";
  actionOrdinal: number;
  targetRef: string;
  documentRef: string;
  actionId: string;
  positivePostconditionHash: `sha256:${string}`;
  negativePostconditionHash: `sha256:${string}`;
  requestHash: `sha256:${string}`;
  payloadHash: `sha256:${string}`;
}>;

export type BrowserMutationRecoveryState = Readonly<{
  mutation: BrowserMutationIdentity;
  current: BrowserMutationState;
  authorityHash: `sha256:${string}`;
}>;

export type BrowserMutationReconciliationScope = Readonly<{
  commandId: string;
  ownerPluginId: string;
  jobId: string;
  targetRef: string;
  documentRef: string;
  payloadHash: `sha256:${string}`;
}>;

export type BrowserTurnRecoveryScope = BrowserMutationReconciliationScope & Readonly<{
  pluginStepId: string;
  state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
  effectScope: "target_local" | "provider_effect";
}>;

export type BrowserAtomicStepRecovery = Readonly<{
  state: "dispatched" | "confirmed" | "rejected";
  authorityRef: string;
  authorityHash: `sha256:${string}`;
  targetRef: string;
  documentRef: string;
}>;

type MutationRow = Readonly<{
  command_id: string;
  logical_mutation_id: `sha256:${string}` | null;
  owner_plugin_id: string;
  job_id: string;
  attempt_id: string;
  lease_version: number;
  execution_fence_hash: `sha256:${string}`;
  plugin_step_id: string;
  child_capability_id: string;
  flow_version: string;
  step_index: number;
  effect_scope: "target_local" | "provider_effect";
  action_ordinal: number;
  target_ref: string;
  document_ref: string;
  action_id: string;
  positive_postcondition_hash: `sha256:${string}`;
  negative_postcondition_hash: `sha256:${string}`;
  request_hash: `sha256:${string}`;
  payload_hash: `sha256:${string}`;
  state: BrowserMutationState;
}>;

const identityColumns = `command_id,logical_mutation_id,owner_plugin_id,job_id,attempt_id,
  lease_version,execution_fence_hash,plugin_step_id,child_capability_id,flow_version,step_index,effect_scope,action_ordinal,
  target_ref,document_ref,action_id,positive_postcondition_hash,negative_postcondition_hash,
  request_hash,payload_hash`;

const mutationIdentity = (row: MutationRow): BrowserMutationIdentity => ({
  commandId: row.command_id,
  logicalMutationId: row.logical_mutation_id,
  ownerPluginId: row.owner_plugin_id,
  jobId: row.job_id,
  attemptId: row.attempt_id,
  leaseVersion: row.lease_version,
  executionFenceHash: row.execution_fence_hash,
  pluginStepId: row.plugin_step_id,
  childCapabilityId: row.child_capability_id,
  flowVersion: row.flow_version,
  stepIndex: row.step_index,
  effectScope: row.effect_scope,
  actionOrdinal: row.action_ordinal,
  targetRef: row.target_ref,
  documentRef: row.document_ref,
  actionId: row.action_id,
  positivePostconditionHash: row.positive_postcondition_hash,
  negativePostconditionHash: row.negative_postcondition_hash,
  requestHash: row.request_hash,
  payloadHash: row.payload_hash,
});

const mutationAuthorityHash = (row: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(row)).digest("hex")}`;

const currentTableSql = `
  create table browser_mutations (
    command_id text primary key,
    logical_mutation_id text,
    owner_plugin_id text not null,
    job_id text not null,
    attempt_id text not null,
    lease_version integer not null,
    execution_fence_hash text not null,
    plugin_step_id text not null,
    child_capability_id text not null,
    flow_version text not null,
    step_index integer not null check(step_index >= 0),
    effect_scope text not null check(effect_scope in ('target_local','provider_effect')),
    action_ordinal integer not null check(action_ordinal >= 1),
    target_ref text not null,
    document_ref text not null,
    action_id text not null,
    positive_postcondition_hash text not null,
    negative_postcondition_hash text not null,
    request_hash text not null,
    payload_hash text not null,
    proof_hash text,
    state text not null check(state in ('PREPARED','DISPATCHED','CONFIRMED','REJECTED','FAILED')),
    reason text,
    updated_at text not null
  )`;

const createIndexes = (database: Database.Database): void => {
  database.exec(`
    create index if not exists browser_mutations_unresolved
      on browser_mutations(job_id,attempt_id,lease_version,execution_fence_hash,state);
    create index if not exists browser_mutations_logical_identity
      on browser_mutations(job_id,logical_mutation_id,state);
  `);
};

const ensureCurrentSchema = (database: Database.Database): void => {
  const table = database.prepare(
    "select sql from sqlite_master where type='table' and name='browser_mutations'",
  ).get() as { sql?: string } | undefined;
  if (!table) {
    database.exec(currentTableSql);
    createIndexes(database);
    return;
  }
  const columns = new Set((database.prepare("pragma table_info(browser_mutations)").all() as Array<{ name: string }>)
    .map((column) => column.name));
  const atomicIdentityColumns = ["plugin_step_id", "child_capability_id", "action_ordinal",
    "positive_postcondition_hash", "negative_postcondition_hash"];
  if (atomicIdentityColumns.every((column) => columns.has(column))) {
    database.transaction(() => {
      if (!columns.has("flow_version")) {
        database.exec("alter table browser_mutations add column flow_version text not null default 'gpt-turn-flow.v1'");
      }
      if (!columns.has("step_index")) {
        database.exec("alter table browser_mutations add column step_index integer not null default 0 check(step_index >= 0)");
      }
      if (!columns.has("effect_scope")) {
        database.exec("alter table browser_mutations add column effect_scope text not null default 'target_local' check(effect_scope in ('target_local','provider_effect'))");
      }
      database.prepare(`update browser_mutations set effect_scope='provider_effect'
        where child_capability_id in ('attach_approved_gpt_files_once','submit_exact_gpt_turn_once')`).run();
    })();
    createIndexes(database);
    return;
  }
  const row = database.prepare("select count(*) as count from browser_mutations").get() as { count: number };
  if (row.count !== 0) throw new Error("BROWSER_MUTATION_SCHEMA_REBUILD_REQUIRES_EMPTY_STORE");
  database.transaction(() => {
    database.exec("drop table browser_mutations");
    database.exec(currentTableSql);
    createIndexes(database);
  })();
};

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
    const row = database.prepare(
      `select ${identityColumns},proof_hash,state,reason,updated_at
       from browser_mutations where command_id=?`,
    ).get(commandId);
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
    ensureCurrentSchema(this.database);
    this.database.prepare(
      "update browser_mutations set state='FAILED',reason='BROWSER_COMMAND_NOT_DISPATCHED',updated_at=? where state='PREPARED'",
    ).run(new Date().toISOString());
  }

  public prepare(input: BrowserMutationIdentity): void {
    if (!input.pluginStepId || !input.childCapabilityId
      || !Number.isInteger(input.actionOrdinal) || input.actionOrdinal < 1
      || !input.positivePostconditionHash || !input.negativePostconditionHash) {
      throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_REQUIRED");
    }
    this.database.transaction(() => {
      if (input.logicalMutationId) {
        const existing = this.database.prepare(
          `select command_id from browser_mutations
           where job_id=? and logical_mutation_id=? and state in ('DISPATCHED','CONFIRMED','REJECTED') limit 1`,
        ).get(input.jobId, input.logicalMutationId);
        if (existing) throw new Error("BROWSER_LOGICAL_MUTATION_REPLAY_FORBIDDEN");
      }
      this.database.prepare(
        `insert into browser_mutations(
          ${identityColumns},state,updated_at
        ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PREPARED',?)`,
      ).run(
        input.commandId, input.logicalMutationId ?? null, input.ownerPluginId, input.jobId,
        input.attemptId, input.leaseVersion, input.executionFenceHash, input.pluginStepId,
        input.childCapabilityId, input.flowVersion, input.stepIndex, input.effectScope,
        input.actionOrdinal, input.targetRef, input.documentRef,
        input.actionId, input.positivePostconditionHash, input.negativePostconditionHash,
        input.requestHash, input.payloadHash, new Date().toISOString(),
      );
    })();
  }

  public markDispatched(commandId: string): void {
    this.transition(commandId, "PREPARED", "DISPATCHED", null, null);
  }

  public markReceiptMissing(commandId: string, proofHash: `sha256:${string}` | null = null): void {
    const result = this.database.prepare(
      `update browser_mutations set reason='BROWSER_COMMAND_RECEIPT_MISSING',
       proof_hash=coalesce(?,proof_hash),updated_at=? where command_id=? and state='DISPATCHED'`,
    ).run(proofHash, new Date().toISOString(), commandId);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }

  public markConfirmed(commandId: string, proofHash: `sha256:${string}`): void {
    this.transition(commandId, "DISPATCHED", "CONFIRMED", "direct-postcondition-passed", proofHash);
  }

  public markRejected(commandId: string, proofHash: `sha256:${string}`): void {
    this.transition(commandId, "DISPATCHED", "REJECTED", "BROWSER_POSTCONDITION_FAILED", proofHash);
  }

  public markFailedBeforeDispatch(commandId: string, reason: string): void {
    this.transition(commandId, "PREPARED", "FAILED", reason, null);
  }

  public resolve(input: Readonly<{
    commandId: string;
    ownerPluginId: string;
    targetRef: string;
    state: "CONFIRMED" | "REJECTED";
    proofHash: `sha256:${string}`;
  }>): void {
    const result = this.database.prepare(
      `update browser_mutations set state=?,proof_hash=?,reason=?,updated_at=?
       where command_id=? and owner_plugin_id=? and target_ref=? and state='DISPATCHED'`,
    ).run(input.state, input.proofHash, `owning-plugin:${input.ownerPluginId}`,
      new Date().toISOString(), input.commandId, input.ownerPluginId, input.targetRef);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }

  public dispatchedForBinding(input: Readonly<{
    jobId: string; attemptId: string; leaseVersion: number; executionFenceHash: string;
  }>): readonly string[] {
    const rows = this.database.prepare(
      `select command_id from browser_mutations where job_id=? and attempt_id=? and lease_version=?
       and execution_fence_hash=? and state='DISPATCHED' order by updated_at,command_id`,
    ).all(input.jobId, input.attemptId, input.leaseVersion, input.executionFenceHash) as readonly { command_id: string }[];
    return Object.freeze(rows.map((row) => row.command_id));
  }

  public dispatchedForJob(input: Readonly<{ jobId: string; ownerPluginId: string }>): readonly string[] {
    const rows = this.database.prepare(
      `select command_id from browser_mutations where job_id=? and owner_plugin_id=?
       and state='DISPATCHED' order by updated_at,command_id`,
    ).all(input.jobId, input.ownerPluginId) as readonly { command_id: string }[];
    return Object.freeze(rows.map((row) => row.command_id));
  }

  public hasMutationForJob(jobId: string): boolean {
    return Boolean(this.database.prepare(
      "select 1 from browser_mutations where job_id=? limit 1",
    ).get(jobId));
  }

  public canReconstructGptTurnStep(input: Readonly<{
    jobId: string;
    ownerPluginId: string;
    pluginStepId: string;
  }>): boolean {
    const unsafe = this.database.prepare(
      `select 1 from browser_mutations
       where job_id=? and owner_plugin_id=? and plugin_step_id=?
         and (state='DISPATCHED' or (effect_scope='provider_effect' and state in ('CONFIRMED','REJECTED')))
       limit 1`,
    ).get(input.jobId, input.ownerPluginId, input.pluginStepId);
    return !unsafe;
  }

  public reconciliationScope(input: Readonly<{
    jobId: string; ownerPluginId: string;
  }>): BrowserMutationReconciliationScope | null {
    const rows = this.database.prepare(
      `select command_id,owner_plugin_id,job_id,target_ref,document_ref,payload_hash
       from browser_mutations where state='DISPATCHED' and job_id=? and owner_plugin_id=?
       order by updated_at,command_id limit 2`,
    ).all(input.jobId, input.ownerPluginId) as ReadonlyArray<{
      command_id: string; owner_plugin_id: string; job_id: string; target_ref: string;
      document_ref: string; payload_hash: `sha256:${string}`;
    }>;
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error("BROWSER_RECONCILIATION_SCOPE_AMBIGUOUS");
    const row = rows[0]!;
    return Object.freeze({
      commandId: row.command_id, ownerPluginId: row.owner_plugin_id, jobId: row.job_id,
      targetRef: row.target_ref, documentRef: row.document_ref, payloadHash: row.payload_hash,
    });
  }

  public turnRecoveryScope(input: Readonly<{
    jobId: string; ownerPluginId: string; pluginStepId: string;
  }>): BrowserTurnRecoveryScope | null {
    const rows = this.database.prepare(
      `select command_id,owner_plugin_id,job_id,plugin_step_id,target_ref,document_ref,payload_hash,state,effect_scope
       from browser_mutations
       where job_id=? and owner_plugin_id=? and plugin_step_id=?
         and (state='DISPATCHED' or (effect_scope='provider_effect' and state in ('CONFIRMED','REJECTED')))
       order by updated_at desc,command_id desc limit 2`,
    ).all(input.jobId, input.ownerPluginId, input.pluginStepId) as ReadonlyArray<{
      command_id: string; owner_plugin_id: string; job_id: string; plugin_step_id: string;
      target_ref: string; document_ref: string; payload_hash: `sha256:${string}`;
      state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
      effect_scope: "target_local" | "provider_effect";
    }>;
    if (rows.length === 0) return null;
    const targetRefs = new Set(rows.map((row) => row.target_ref));
    if (targetRefs.size !== 1) throw new Error("BROWSER_RECONCILIATION_SCOPE_AMBIGUOUS");
    const row = rows[0]!;
    return Object.freeze({
      commandId: row.command_id, ownerPluginId: row.owner_plugin_id, jobId: row.job_id,
      pluginStepId: row.plugin_step_id, targetRef: row.target_ref, documentRef: row.document_ref,
      payloadHash: row.payload_hash, state: row.state, effectScope: row.effect_scope,
    });
  }

  public atomicStepRecovery(input: Readonly<{
    jobId: string;
    ownerPluginId: string;
    pluginStepId: string;
    childCapabilityId: string;
    flowVersion: string;
    stepIndex: number;
    inputHash: `sha256:${string}`;
    actionOrdinal: number;
    targetRef: string;
    effectScope: "target_local" | "provider_effect";
  }>): BrowserAtomicStepRecovery | null {
    const targetClause = input.effectScope === "target_local" ? "and target_ref=?" : "";
    const parameters = [
      input.jobId, input.ownerPluginId, input.pluginStepId, input.childCapabilityId,
      input.flowVersion, input.stepIndex, input.inputHash, input.actionOrdinal, input.effectScope,
      ...(input.effectScope === "target_local" ? [input.targetRef] : []),
    ];
    const rows = this.database.prepare(
      `select command_id,target_ref,document_ref,state
       from browser_mutations
       where job_id=? and owner_plugin_id=? and plugin_step_id=? and child_capability_id=?
         and flow_version=? and step_index=? and request_hash=? and action_ordinal=? and effect_scope=?
         ${targetClause} and state in ('DISPATCHED','CONFIRMED','REJECTED')
       order by updated_at desc,command_id desc limit 2`,
    ).all(...parameters) as ReadonlyArray<{
      command_id: string;
      target_ref: string;
      document_ref: string;
      state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
    }>;
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error("BROWSER_RECONCILIATION_SCOPE_AMBIGUOUS");
    const row = rows[0]!;
    return Object.freeze({
      state: row.state.toLowerCase() as BrowserAtomicStepRecovery["state"],
      authorityRef: `browser-mutation:${row.command_id}`,
      authorityHash: this.authorityHash(row.command_id),
      targetRef: row.target_ref,
      documentRef: row.document_ref,
    });
  }

  public readDispatched(commandId: string): BrowserMutationIdentity | null {
    const row = this.database.prepare(
      `select ${identityColumns},state from browser_mutations where command_id=? and state='DISPATCHED'`,
    ).get(commandId) as MutationRow | undefined;
    return row ? Object.freeze(mutationIdentity(row)) : null;
  }

  public readState(commandId: string): BrowserMutationState | null {
    const row = this.database.prepare(
      "select state from browser_mutations where command_id=?",
    ).get(commandId) as { state: BrowserMutationState } | undefined;
    return row?.state ?? null;
  }

  public authorityHash(commandId: string): `sha256:${string}` {
    const row = this.database.prepare(
      `select ${identityColumns},proof_hash,state,reason,updated_at
       from browser_mutations where command_id=?`,
    ).get(commandId);
    if (!row) throw new Error("BROWSER_MUTATION_RECORD_MISSING");
    return mutationAuthorityHash(row);
  }

  public reconciliationStates(): readonly BrowserMutationRecoveryState[] {
    const rows = this.database.prepare(
      `select ${identityColumns},state from browser_mutations order by updated_at,command_id`,
    ).all() as MutationRow[];
    return Object.freeze(rows.map((row) => Object.freeze({
      mutation: mutationIdentity(row), current: row.state, authorityHash: this.authorityHash(row.command_id),
    })));
  }

  public close(): void { this.database.close(); }

  private transition(commandId: string, from: BrowserMutationState, to: BrowserMutationState,
    reason: string | null, proofHash: `sha256:${string}` | null): void {
    const result = this.database.prepare(
      `update browser_mutations set state=?,reason=?,proof_hash=?,updated_at=?
       where command_id=? and state=?`,
    ).run(to, reason, proofHash, new Date().toISOString(), commandId, from);
    if (result.changes !== 1) throw new Error("BROWSER_MUTATION_STATE_CONFLICT");
  }
}
