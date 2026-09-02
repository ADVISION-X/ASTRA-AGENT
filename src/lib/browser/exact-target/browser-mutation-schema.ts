import Database from "better-sqlite3";
import { createHash } from "node:crypto";

export const identityColumns = `command_id,logical_mutation_id,exact_call_identity_hash,owner_plugin_id,plugin_version,job_id,attempt_id,
  lease_version,execution_fence_hash,product_step_id,call_id,child_capability_id,effect_scope,action_ordinal,
  target_ref,document_ref,action_id,positive_postcondition_hash,negative_postcondition_hash,
  request_hash,payload_hash`;

export const mutationAuthorityHash = (row: unknown): `sha256:${string}` => {
  let hashInput = row;
  if (row && typeof row === "object" && !Array.isArray(row)) {
    const normalized = { ...row as Record<string, unknown> };
    if (normalized.mutation_outcome === null) delete normalized.mutation_outcome;
    hashInput = normalized;
  }
  return `sha256:${createHash("sha256").update(JSON.stringify(hashInput)).digest("hex")}`;
};

const currentTableSql = `
  create table browser_mutations (
    command_id text primary key,
    logical_mutation_id text,
    exact_call_identity_hash text not null,
    owner_plugin_id text not null,
    plugin_version integer not null check(plugin_version >= 1),
    job_id text not null,
    attempt_id text not null,
    lease_version integer not null,
    execution_fence_hash text not null,
    product_step_id text not null,
    call_id text not null,
    child_capability_id text not null,
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
    mutation_outcome text check(mutation_outcome in ('no','dispatched','confirmed')),
    reason text,
    terminal_at text,
    updated_at text not null
  )`;

const createIndexes = (database: Database.Database): void => {
  database.exec(`
    create index if not exists browser_mutations_unresolved
      on browser_mutations(job_id,attempt_id,lease_version,execution_fence_hash,state);
    create index if not exists browser_mutations_logical_identity
      on browser_mutations(job_id,logical_mutation_id,state);
    create index if not exists browser_mutations_exact_call_identity
      on browser_mutations(job_id,attempt_id,owner_plugin_id,plugin_version,exact_call_identity_hash,state);
  `);
};

const addMutationOutcomeWithoutRebuild = (database: Database.Database): void => {
  database.transaction(() => database.exec(
    "alter table browser_mutations add column mutation_outcome text check(mutation_outcome in ('no','dispatched','confirmed'))",
  ))();
};

export const ensureCurrentSchema = (database: Database.Database): void => {
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
  const identity = ["exact_call_identity_hash", "plugin_version", "product_step_id", "call_id",
    "child_capability_id", "effect_scope", "action_ordinal", "positive_postcondition_hash",
    "negative_postcondition_hash", "terminal_at"];
  if (!identity.every((column) => columns.has(column))) {
    const row = database.prepare("select count(*) as count from browser_mutations").get() as { count: number };
    if (row.count !== 0) throw new Error("BROWSER_MUTATION_SCHEMA_REBUILD_REQUIRES_EMPTY_STORE");
    database.transaction(() => {
      database.exec("drop table browser_mutations");
      database.exec(currentTableSql);
    })();
    createIndexes(database);
    return;
  }
  if (!columns.has("mutation_outcome")) addMutationOutcomeWithoutRebuild(database);
  createIndexes(database);
};
