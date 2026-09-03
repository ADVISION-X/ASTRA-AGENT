import assert from "../audit/shared/governance-exam-assert.js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { chromium, type BrowserContext } from "playwright";

import {
  runtimeEventIntegrityValid,
  runtimeLogEventShapeValid,
  type RuntimeLogEventV2,
} from "../../src/lib/runtime-logs/index.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../../src/lib/browser/release/unpacked-extension-release-identity.js";
import type { BrowserProfileConfig } from "../../src/lib/browser/profile/browser-profile-config.js";
import { readProductionRuntimeStorageInventory } from
  "../../src/lib/local-runtime/production/runtime-storage-inventory.js";

export const waitForProductionProof = async (
  label: string,
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
): Promise<void> => {
  const deadline = Date.now() + Math.max(1, timeoutMs - 30_000);
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`PRODUCTION_DYNAMIC_PROOF_TIMEOUT:${label}`);
};

export const productionProofChromeOptions = (
  browserProfile: BrowserProfileConfig,
): Parameters<typeof chromium.launchPersistentContext>[1] => {
  assert.equal(browserProfile.extensionId, GRASSEYE_UNPACKED_EXTENSION_ID);
  assert.equal(existsSync(browserProfile.unpackedExtensionDirectory), true,
    "the governed unpacked extension build is required");
  return {
    executablePath: chromium.executablePath(), headless: false,
    args: [
      `--disable-extensions-except=${browserProfile.unpackedExtensionDirectory}`,
      `--load-extension=${browserProfile.unpackedExtensionDirectory}`,
      "--no-first-run", "--no-default-browser-check", "--disable-component-update",
      "--disable-search-engine-choice-screen",
    ],
  };
};

export const requireProductionProofExtensionWorker = async (context: BrowserContext): Promise<void> => {
  const prefix = `chrome-extension://${GRASSEYE_UNPACKED_EXTENSION_ID}/`;
  if (!context.serviceWorkers().some((worker) => worker.url().startsWith(prefix))) {
    const worker = await context.waitForEvent("serviceworker");
    assert.equal(worker.url().startsWith(prefix), true);
  }
};

export const sentProductionCheckpointPrefix = (
  productionDatabasePath: string,
  jobId: string,
): Readonly<{ attemptId: string | null; acceptedSeq1: boolean; progressSeq2: boolean; progressSeq3: boolean }> => {
  if (!existsSync(productionDatabasePath)) {
    return { attemptId: null, acceptedSeq1: false, progressSeq2: false, progressSeq3: false };
  }
  const database = new Database(productionDatabasePath, { readonly: true, fileMustExist: true });
  try {
    const jobPathMarker = `/jobs/${encodeURIComponent(jobId)}/`;
    const rows = database.prepare(`select body_blob,sent_at from production_outbox
      where kind='checkpoint' and instr(path,?)>0 order by created_at,idempotency_key`
    ).all(jobPathMarker) as Array<{ body_blob: Buffer; sent_at: string | null }>;
    const sent = rows.filter((row) => row.sent_at).map((row) =>
      JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>);
    const attempts = [...new Set(sent.map((row) => String(row.attempt_id ?? "")).filter(Boolean))];
    const attemptId = attempts.length === 1 ? attempts[0]! : null;
    const has = (seq: number, kind: string): boolean => sent.some((row) =>
      row.attempt_id === attemptId && row.checkpoint_seq === seq && row.checkpoint_kind === kind);
    return { attemptId, acceptedSeq1: has(1, "accepted"), progressSeq2: has(2, "progress"),
      progressSeq3: has(3, "progress") };
  } finally { database.close(); }
};

export const assertProductionProofJobsAreNew = (
  productionDatabasePath: string,
  jobIds: readonly string[],
): void => {
  if (!existsSync(productionDatabasePath)) return;
  const database = new Database(productionDatabasePath, { readonly: true, fileMustExist: true });
  try {
    const placeholders = jobIds.map(() => "?").join(",");
    const row = database.prepare(`select count(*) as count from production_tasks where job_id in (${placeholders})`)
      .get(...jobIds) as { count: number };
    assert.equal(row.count, 0, "historical local tasks cannot be reused as Dynamic Proof");
  } finally { database.close(); }
};

export type ProductionProofTaskRow = Readonly<{
  created_at: string; identity_json: string; job_id: string; request_hash: string;
  result_json: string; status: string; task_json: string; updated_at: string;
}>;
export type ProductionProofOutboxRow = Readonly<{
  kind: string; path: string; body_blob: Buffer; sent_at: string | null;
}>;
export const observeProductionRuntimeDatabase = async (input: Readonly<{
  dataDir: string; databasePath: string; jobIds: readonly string[];
}>) => {
  const database = new Database(input.databasePath, { readonly: true, fileMustExist: true });
  const placeholders = input.jobIds.map(() => "?").join(",");
  try {
    const taskRows = database.prepare(`select created_at,identity_json,job_id,request_hash,result_json,status,
      task_json,updated_at from production_tasks where job_id in (${placeholders}) order by job_id`
    ).all(...input.jobIds) as ProductionProofTaskRow[];
    const outboxRows = database.prepare(`select kind,path,body_blob,sent_at from production_outbox
      order by created_at,idempotency_key`).all() as ProductionProofOutboxRow[];
    const continuationRows = database.prepare(`select continuation_ref,origin_job_id,lane_owner_job_id
      from production_continuations where origin_job_id in (${placeholders}) order by continuation_ref`
    ).all(...input.jobIds) as Array<{
      continuation_ref: string; origin_job_id: string; lane_owner_job_id: string | null;
    }>;
    const count = (sql: string): number => Number((database.prepare(sql).get() as { count: number }).count);
    const incompleteFrontierCount = count(`select count(*) as count from production_continuations
      where reservation_kind='persisted' and frontier_ref is not null and current_checkpoint_json is null`);
    const requiredRuntimeSchemaColumnCount = count(`select count(*) as count
      from pragma_table_info('production_continuations') where name in
      ('semantic_contract_hash','semantic_admission_receipt_json')`);
    const unscheduledOutboxCount = count(`select count(*) as count from production_outbox where sent_at is null
      and response_hash is null and last_error is not null and next_delivery_at is null
      and last_error<>'PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED'`);
    const tables = (database.prepare(`select name from sqlite_master where type='table'
      and name like 'production_%' order by name`).all() as Array<{ name: string }>).map((row) => row.name);
    const runtimeSchemaExact = JSON.stringify(tables) === JSON.stringify([
      "production_attempt_failures", "production_checkpoints", "production_continuations",
      "production_leases", "production_outbox", "production_tasks",
    ]) && String(database.pragma("integrity_check", { simple: true })).toLowerCase() === "ok"
      && (database.pragma("foreign_key_check") as unknown[]).length === 0
      && String(database.pragma("journal_mode", { simple: true })).toLowerCase() === "wal";
    const storageInventory = await readProductionRuntimeStorageInventory(input.dataDir, {
      task_ids: taskRows.map((row) => row.job_id),
      outbox_responsibility_count: count("select count(*) as count from production_outbox"),
      pending_outbox_count: count("select count(*) as count from production_outbox where sent_at is null"),
      continuation_count: count("select count(*) as count from production_continuations"),
      active_lease_count: count("select count(*) as count from production_leases where state='active'"),
    });
    return Object.freeze({ taskRows, outboxRows, continuationRows, incompleteFrontierCount,
      requiredRuntimeSchemaColumnCount, unscheduledOutboxCount, runtimeSchemaExact, storageInventory });
  } finally { database.close(); }
};

export type ProductionProofCleanupObservation = Readonly<{
  browserContextClosed: boolean;
  cleanupVerified: boolean;
  workbenchStopped: boolean;
}>;
type CleanupCheck = Readonly<{ label: string; run: (() => Promise<boolean>) | null }>;

type RouteManifest = Readonly<{ plugins: readonly Readonly<{
  plugin_id: string;
  accepts: readonly Readonly<{ product_id: string; action_id: string }>[];
}>[] }>;
export type ProductionProofRouteRow = Readonly<{
  created_at: string;
  identity_json: string;
  job_id: string;
  task_json: string;
}>;
export type ProductionProofRouteCoverage = Readonly<{
  pluginIds: readonly string[];
  primaryCount: number;
  reviewCount: number;
  routeCount: number;
}>;
const routeKey = (productId: string, actionId: string): string => `${productId}\0${actionId}`;
const denominatorInvalid = (detail: string): never => {
  throw new Error(`PRODUCTION_DYNAMIC_ROUTE_DENOMINATOR_INVALID:${detail}`);
};
const objectJson = (source: string, label: string): Record<string, unknown> => {
  let value: unknown;
  try { value = JSON.parse(source); } catch { return denominatorInvalid(`${label}:json`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) return denominatorInvalid(`${label}:object`);
  return value as Record<string, unknown>;
};

const expectedRouteOwners = (manifest: RouteManifest): Map<string, string> => {
  const expected = new Map<string, string>();
  for (const plugin of manifest.plugins) for (const route of plugin.accepts) {
    const key = routeKey(route.product_id, route.action_id);
    if (expected.has(key)) denominatorInvalid(`manifest-duplicate:${route.product_id}:${route.action_id}`);
    expected.set(key, plugin.plugin_id);
  }
  if (manifest.plugins.length !== 12 || expected.size !== 39) denominatorInvalid("manifest-count");
  return expected;
};

const observeRouteRow = (
  row: ProductionProofRouteRow, expected: ReadonlyMap<string, string>, seen: Set<string>,
): "primary" | "review" => {
  if (!Number.isFinite(Date.parse(row.created_at))) denominatorInvalid(`created-at:${row.job_id}`);
  const task = objectJson(row.task_json, `${row.job_id}:task`);
  const identity = objectJson(row.identity_json, `${row.job_id}:identity`);
  if (task.job_id !== row.job_id || typeof task.product_id !== "string" || typeof task.action_id !== "string"
    || typeof identity.plugin_id !== "string") denominatorInvalid(`identity:${row.job_id}`);
  const productId = String(task.product_id);
  const actionId = String(task.action_id);
  const key = routeKey(productId, actionId);
  const owner = expected.get(key);
  if (!owner) denominatorInvalid(`extra:${productId}:${actionId}`);
  if (seen.has(key)) denominatorInvalid(`duplicate:${productId}:${actionId}`);
  if (identity.plugin_id !== owner) denominatorInvalid(`owner:${productId}:${actionId}`);
  seen.add(key);
  return actionId === "accuracy_challenge" || actionId === "quality_reflection" ? "review" : "primary";
};

const assertFirstRoute = (row: ProductionProofRouteRow): void => {
  const task = objectJson(row.task_json, `${row.job_id}:first-task`);
  if (!["localization_report_translation", "localization_article_translation"].includes(String(task.product_id))
    || task.action_id === "accuracy_challenge" || task.action_id === "quality_reflection") {
    denominatorInvalid("first-route-not-localization-primary");
  }
};

export const assertProductionProofRouteCoverage = (
  rows: readonly ProductionProofRouteRow[], manifest: RouteManifest,
): ProductionProofRouteCoverage => {
  const expected = expectedRouteOwners(manifest);
  if (rows.length !== expected.size) denominatorInvalid(`row-count:${rows.length}`);
  const seen = new Set<string>();
  let primaryCount = 0;
  let reviewCount = 0;
  const orderedRows = [...rows].sort((left, right) => left.created_at.localeCompare(right.created_at)
    || left.job_id.localeCompare(right.job_id));
  for (const row of orderedRows) {
    if (observeRouteRow(row, expected, seen) === "review") reviewCount += 1;
    else primaryCount += 1;
  }
  for (const key of expected.keys()) if (!seen.has(key)) denominatorInvalid(`missing:${key.replace("\0", ":")}`);
  if (primaryCount !== 13 || reviewCount !== 26) denominatorInvalid(`relation-count:${primaryCount}:${reviewCount}`);
  assertFirstRoute(orderedRows[0]!);
  return Object.freeze({
    pluginIds: Object.freeze([...new Set(rows.map((row) =>
      String(objectJson(row.identity_json, `${row.job_id}:identity`).plugin_id)))].sort()),
    primaryCount, reviewCount, routeCount: seen.size,
  });
};

export const observeProductionProofCleanup = async (
  workbench: CleanupCheck["run"], browserContext: CleanupCheck["run"],
): Promise<ProductionProofCleanupObservation> => {
  const failures: Error[] = [];
  const attempt = async ({ label, run }: CleanupCheck): Promise<boolean> => {
    if (run === null) return true;
    try {
      if (await run()) return true;
      failures.push(new Error(`${label}:post-condition-false`));
    } catch (error) {
      failures.push(error instanceof Error ? error : new Error(`${label}:${String(error)}`));
    }
    return false;
  };
  const workbenchStopped = await attempt({ label: "workbench", run: workbench });
  const browserContextClosed = await attempt({ label: "browser-context", run: browserContext });
  if (failures.length > 0) throw new AggregateError(failures, "AGENT_PRODUCTION_DYNAMIC_PROOF_CLEANUP_FAILED");
  return Object.freeze({
    browserContextClosed, cleanupVerified: workbenchStopped && browserContextClosed, workbenchStopped,
  });
};

type BrowserStart = Extract<RuntimeLogEventV2, { kind: "span.started" }>;
type RuntimeLogProofFacts = Readonly<{
  authorityHashCount: number;
  eventCount: number;
  forbiddenTaskStateFieldCount: number;
  integrityValid: boolean;
  mutationEventCount: number;
  openSpanCount: number;
  producerCount: number;
  sealed: boolean;
}>;
export type ProductionProofRuntimeLogs = Readonly<{
  completedBrowserEvents: readonly BrowserStart[];
  facts: RuntimeLogProofFacts;
  source: string;
}>;

export const observeProductionProofRuntimeLogs = (input: Readonly<{
  directory: string;
  jobIds: readonly string[];
  startedAt: string;
}>): ProductionProofRuntimeLogs => {
  const files = readdirSync(join(input.directory, "agent")).filter((name) => name.endsWith(".jsonl")).sort()
    .map((name) => join(input.directory, "agent", name));
  assert.equal(files.length > 0, true, "the active V2 segment layout must contain agent runtime events");
  const source = files.map((path) => readFileSync(path, "utf8")).join("");
  const parsed = source.split("\n").filter(Boolean).map((line) => JSON.parse(line) as unknown);
  assert.equal(parsed.every(runtimeLogEventShapeValid), true, "runtime segments must contain only V2 events");
  const events = (parsed as RuntimeLogEventV2[]).filter((event) => event.emittedAt >= input.startedAt);
  assert.equal(events.length > 0, true, "the current proof run must write runtime events");
  const runs = new Map<string, RuntimeLogEventV2[]>();
  for (const event of events) runs.set(event.producerRunId, [...(runs.get(event.producerRunId) ?? []), event]);
  const integrityValid = [...runs.values()].every((runEvents) =>
    runEvents.sort((left, right) => left.producerSeq - right.producerSeq).every((event, index) =>
      runtimeEventIntegrityValid(event) && event.producerSeq === index + 1
        && event.previousEventHash === (runEvents[index - 1]?.eventHash ?? null)));
  const browserStarts = events.filter((event): event is BrowserStart => event.kind === "span.started"
    && event.operation === "browser.command"
    && event.typedIdentity.kind === "browser-command");
  const successfulBrowserSpans = new Set(events.filter((event): event is Extract<RuntimeLogEventV2,
  { kind: "span.terminal" }> => event.kind === "span.terminal"
    && event.operation === "browser.command" && event.outcome === "succeeded").map((event) => event.spanId));
  const completedBrowserEvents = browserStarts.filter((event) => successfulBrowserSpans.has(event.spanId));
  assert.equal(input.jobIds.every((jobId) => completedBrowserEvents.some((event) =>
    event.typedIdentity.kind === "browser-command" && event.typedIdentity.jobId === jobId)), true,
  "each job must have a completed typed Browser span");
  const mutationEvents = events.filter((event): event is Extract<RuntimeLogEventV2, { kind: "event" }> =>
    event.kind === "event" && event.code.startsWith("BROWSER_MUTATION_"));
  const openSpans = new Set(events.filter((event) => event.kind === "span.started")
    .map((event) => `${event.producerRunId}:${event.spanId}`));
  for (const event of events.filter((current) => current.kind === "span.terminal")) {
    openSpans.delete(`${event.producerRunId}:${event.spanId}`);
  }
  const facts = Object.freeze({
    authorityHashCount: events.filter((event) => "authorityHash" in event && event.authorityHash !== undefined).length,
    eventCount: events.length, integrityValid,
    forbiddenTaskStateFieldCount: parsed.filter((event) => {
      if (!event || typeof event !== "object") return false;
      const record = event as Record<string, unknown>;
      return "stateKey" in record || "previous" in record || "current" in record || "recovery" in record;
    }).length,
    mutationEventCount: mutationEvents.length,
    openSpanCount: openSpans.size, producerCount: runs.size,
    sealed: events.some((event) => event.kind === "event" && event.code === "PRODUCER_STOPPED"),
  });
  assert.equal(facts.integrityValid, true, "runtime V2 event hashes and producer chains must be intact");
  assert.equal(facts.openSpanCount, 0, "the runtime proof must leave no open Span");
  assert.equal(facts.sealed, true, "the runtime producer must stop with a sealed lifecycle");
  return Object.freeze({ completedBrowserEvents, facts, source });
};
