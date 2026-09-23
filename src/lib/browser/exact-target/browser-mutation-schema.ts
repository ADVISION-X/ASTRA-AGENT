import Database from "better-sqlite3";
import { createHash } from "node:crypto";

export const identityColumns = `command_id,logical_mutation_id,exact_call_identity_hash,job_id,result_revision,attempt_id,
  lease_version,execution_fence_hash,delivery_priority_replay_grant_hash,
  product_step_id,call_id,child_capability_id,effect_scope,action_ordinal,
  target_ref,document_ref,action_id,positive_postcondition_hash,negative_postcondition_hash,
  request_hash,payload_hash`;

export const mutationAuthorityHash = (row: unknown): `sha256:${string}` => {
  let hashInput = row;
  if (row && typeof row === "object" && !Array.isArray(row)) {
    const normalized = { ...row as Record<string, unknown> };
    if (normalized.native_cause_code === null) delete normalized.native_cause_code;
    if (normalized.delivery_priority_replay_grant_hash === null) {
      delete normalized.delivery_priority_replay_grant_hash;
    }
    hashInput = normalized;
  }
  return `sha256:${createHash("sha256").update(JSON.stringify(hashInput)).digest("hex")}`;
};

const currentTableSql = `
  create table browser_mutations (
    command_id text primary key,
    logical_mutation_id text,
    exact_call_identity_hash text not null,
    job_id text not null,
    result_revision integer not null check(result_revision >= 0),
    attempt_id text not null,
    lease_version integer not null,
    execution_fence_hash text not null,
    delivery_priority_replay_grant_hash text,
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
    physical_input_count integer not null default 0 check(physical_input_count between 0 and 4),
    download_guid_hash text,
    download_completed integer not null default 0 check(download_completed in (0,1)),
    media_identity_revalidated integer not null default 0 check(media_identity_revalidated in (0,1)),
    reason text,
    native_cause_code text,
    provider_recovery_payload text,
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
      on browser_mutations(job_id,exact_call_identity_hash,state);
  `);
};

// Target claims share the Browser Owner database. The claim is durable before
// its acknowledgement permits the first governed page command.
export const ensureTargetClaimSchema = (database: Database.Database): void => {
  const existing = database.prepare("select name from sqlite_master where type='table' and name='browser_target_claims'").get();
  if (existing) {
    const columns = (database.prepare("pragma table_info(browser_target_claims)").all() as Array<{ name: string }>).map((column) => column.name);
    if (columns.length === 5 && ["target_ref", "job_ref_hash", "tab_id", "claimed_at", "released_at"]
      .every((column) => columns.includes(column))) {
      database.transaction(() => {
        database.exec("alter table browser_target_claims rename to browser_target_claims_old");
        database.exec(`create table browser_target_claims (
          claim_id integer primary key,
          target_ref text not null,
          job_ref_hash text not null,
          tab_id integer not null,
          claim_source text not null check(claim_source in ('authenticated_claim','legacy_wal')),
          claimed_at text not null,
          released_at text,
          release_outcome text check(release_outcome in ('physical_absent','quiesced')),
          release_proof_hash text
        )`);
        database.exec(`insert into browser_target_claims(target_ref,job_ref_hash,tab_id,claim_source,claimed_at,released_at)
          select target_ref,job_ref_hash,tab_id,'legacy_wal',claimed_at,released_at from browser_target_claims_old`);
        database.exec("drop table browser_target_claims_old");
      })();
    } else if (columns.length !== 9 || ["claim_id", "target_ref", "job_ref_hash", "tab_id",
      "claim_source", "claimed_at", "released_at", "release_outcome", "release_proof_hash"]
      .some((column) => !columns.includes(column))) throw new Error("BROWSER_REPAIR_REQUIRED");
  } else {
    database.exec(`create table browser_target_claims (
      claim_id integer primary key,
      target_ref text not null,
      job_ref_hash text not null,
      tab_id integer not null,
      claim_source text not null check(claim_source in ('authenticated_claim','legacy_wal')),
      claimed_at text not null,
      released_at text,
      release_outcome text check(release_outcome in ('physical_absent','quiesced')),
      release_proof_hash text
    )`);
  }
  database.exec("create index if not exists browser_target_claims_job on browser_target_claims(job_ref_hash,released_at)");
  database.exec("create index if not exists browser_target_claims_ref on browser_target_claims(target_ref,released_at)");
};

const requiredColumns = [...identityColumns.split(",").map((column) => column.trim()),
  "proof_hash", "state", "mutation_outcome", "physical_input_count", "download_guid_hash",
  "download_completed", "media_identity_revalidated", "reason", "native_cause_code",
  "provider_recovery_payload",
  "terminal_at", "updated_at"];

const requiredIndexes = new Set([
  "browser_mutations_unresolved", "browser_mutations_logical_identity",
  "browser_mutations_exact_call_identity",
]);

const normalizedSql = (value: string): string => value
  .toLocaleLowerCase("en-US").replaceAll(/\s+/gu, " ").trim();

const physicalInputConstraint = (sql: string | undefined): 2 | 4 | null => {
  if (!sql) return null;
  const normalized = normalizedSql(sql);
  if (normalized.includes("check(physical_input_count between 0 and 4)")) return 4;
  if (normalized.includes("check(physical_input_count between 0 and 2)")) return 2;
  return null;
};

const currentColumnsAndIndexes = (database: Database.Database): boolean => {
  const columns = (database.prepare("pragma table_info(browser_mutations)").all() as Array<{ name: string }>)
    .map((column) => column.name);
  if (columns.length !== requiredColumns.length
    || requiredColumns.some((column) => !columns.includes(column))) return false;
  const indexes = new Set((database.prepare(
    "select name from sqlite_master where type='index' and tbl_name='browser_mutations' and name not like 'sqlite_autoindex_%'",
  ).all() as Array<{ name: string }>).map((index) => index.name));
  return indexes.size === requiredIndexes.size
    && [...requiredIndexes].every((index) => indexes.has(index));
};

const migratePhysicalInputConstraint = (database: Database.Database): void => {
  const migrationTable = "browser_mutations_physical_input_v2";
  const exists = database.prepare(
    "select 1 from sqlite_master where type='table' and name=?",
  ).get(migrationTable);
  if (exists) throw new Error("BROWSER_REPAIR_REQUIRED");
  database.transaction(() => {
    for (const index of requiredIndexes) database.exec(`drop index ${index}`);
    database.exec(`alter table browser_mutations rename to ${migrationTable}`);
    database.exec(currentTableSql);
    database.exec(`insert into browser_mutations(${requiredColumns.join(",")})
      select ${requiredColumns.join(",")} from ${migrationTable}`);
    const before = database.prepare(`select count(*) as count from ${migrationTable}`).get() as { count: number };
    const after = database.prepare("select count(*) as count from browser_mutations").get() as { count: number };
    if (before.count !== after.count) throw new Error("BROWSER_REPAIR_REQUIRED");
    database.exec(`drop table ${migrationTable}`);
    createIndexes(database);
  })();
};

export const ensureCurrentSchema = (database: Database.Database): void => {
  const table = database.prepare(
    "select sql from sqlite_master where type='table' and name='browser_mutations'",
  ).get() as { sql?: string } | undefined;
  if (!table) {
    database.exec(currentTableSql);
    createIndexes(database);
    ensureTargetClaimSchema(database);
    return;
  }
  const columnRowsBefore = database.prepare("pragma table_info(browser_mutations)").all() as Array<{ name: string }>;
  const columnsBefore = columnRowsBefore.map((column) => column.name);
  if (!columnsBefore.includes("delivery_priority_replay_grant_hash")) {
    const oldRequired = requiredColumns.filter((column) =>
      column !== "delivery_priority_replay_grant_hash");
    if (columnsBefore.length !== oldRequired.length
      || oldRequired.some((column) => !columnsBefore.includes(column))) {
      throw new Error("BROWSER_REPAIR_REQUIRED");
    }
    database.exec(`alter table browser_mutations
      add column delivery_priority_replay_grant_hash text`);
  }
  if (!currentColumnsAndIndexes(database)) throw new Error("BROWSER_REPAIR_REQUIRED");
  const constraint = physicalInputConstraint(table.sql);
  if (constraint === 2) migratePhysicalInputConstraint(database);
  else if (constraint !== 4) throw new Error("BROWSER_REPAIR_REQUIRED");
  if (!currentColumnsAndIndexes(database)) throw new Error("BROWSER_REPAIR_REQUIRED");
  ensureTargetClaimSchema(database);
};
