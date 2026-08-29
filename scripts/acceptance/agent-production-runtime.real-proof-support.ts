import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  runtimeEventIntegrityValid,
  runtimeLogEventShapeValid,
  type RuntimeLogEventV2,
} from "../../src/lib/runtime-logs/index.js";

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
