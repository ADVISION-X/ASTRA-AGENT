import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import Database from "better-sqlite3";
import { chromium, type BrowserContext, type Page, type Worker } from "playwright";

import { createWorkbenchServer } from "../../src/app/create-workbench-server.js";
import {
  GRASSEYE_UNPACKED_EXTENSION_ID,
  readUnpackedExtensionReleaseIdentity,
} from "../../src/lib/browser/release/unpacked-extension-release-identity.js";
import { resolveProductionBrowserProfileConfig } from "../../src/lib/browser/profile/browser-profile-config.js";
import { createGrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-launch-contract.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";
import { agentPluginCapabilityManifest } from "../../src/lib/local-runtime/production/catalog.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";
import {
  observeProductionProofCleanup,
  type ProductionProofCleanupObservation,
} from "./agent-production-runtime.real-proof-cleanup.js";

const dynamicClaimContract = (/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_BEGIN */
{
  "schema_version": "producer-dynamic-claim-contract.v1",
  "routes": {
    "LAW-LOCAL-BROWSER-SESSION-001-V4:dynamic.browser": {"claims": {"forbidden:6": [{"path": "/facts/extension_worker_count", "operator": "equals", "expected": 1}, {"path": "/facts/authority_present", "operator": "equals", "expected": true}]}},
    "LAW-LOCAL-BROWSER-SESSION-002-V6:dynamic.browser": {"claims": {"forbidden:8": [{"path": "/facts/release_build_matches_record", "operator": "equals", "expected": true}]}},
    "LAW-LOCAL-BROWSER-SESSION-003-V11:dynamic.browser": {"claims": {"forbidden:14": [{"path": "/facts/target_claimed_observed", "operator": "equals", "expected": true}, {"path": "/facts/task_owned_chatgpt_page_observed", "operator": "equals", "expected": true}, {"path": "/facts/final_target_absent", "operator": "equals", "expected": true}, {"path": "/facts/operator_page_unchanged", "operator": "equals", "expected": true}]}},
    "LAW-LOCAL-BROWSER-SESSION-004-V10:dynamic.storage": {"claims": {"forbidden:11": [{"path": "/facts/mutation_rows_complete", "operator": "equals", "expected": true}, {"path": "/facts/sqlite_wal_mode", "operator": "equals", "expected": true}]}},
    "LAW-LOCAL-BROWSER-SESSION-005-V6:dynamic.browser": {"claims": {"forbidden:5": [{"path": "/facts/release_build_matches_record", "operator": "equals", "expected": true}]}},
    "LAW-LOCAL-BROWSER-SESSION-006-V3:dynamic.browser": {"claims": {"forbidden:0": [{"path": "/facts/persisted_sensitive_value_count", "operator": "equals", "expected": 0}]}},
    "LAW-GPT-001-V3:dynamic.browser": {"claims": {"forbidden:5": [{"path": "/facts/exact_target_document_binding_count", "operator": "gte", "expected": 12}, {"path": "/facts/operator_page_unchanged", "operator": "equals", "expected": true}]}},
    "LAW-GPT-001-V3:dynamic.provider": {"claims": {"forbidden:1": [{"path": "/facts/provider_count", "operator": "equals", "expected": 1}]}},
    "LAW-GPT-001-V3:dynamic.authorization": {"claims": {"forbidden:2": [{"path": "/facts/exact_target_document_binding_count", "operator": "gte", "expected": 12}]}},
    "LAW-GPT-001-V3:dynamic.recovery": {"claims": {"forbidden:6": [{"path": "/facts/recovery_pending_observed", "operator": "equals", "expected": true}, {"path": "/facts/completed_observed", "operator": "equals", "expected": true}, {"path": "/unresolvedCount", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V6:dynamic.browser": {"claims": {"forbidden:17": [{"path": "/facts/readiness_dimension_count", "operator": "gte", "expected": 4}, {"path": "/facts/readiness_dimensions_distinct", "operator": "equals", "expected": true}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V6:dynamic.service": {"claims": {"forbidden:17": [{"path": "/facts/browser_context_closed", "operator": "equals", "expected": true}, {"path": "/facts/cleanup_verified", "operator": "equals", "expected": true}, {"path": "/facts/readiness_dimension_count", "operator": "gte", "expected": 4}, {"path": "/facts/readiness_dimensions_distinct", "operator": "equals", "expected": true}, {"path": "/facts/workbench_stopped", "operator": "equals", "expected": true}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V6:dynamic.database": {"claims": {"forbidden:8": [{"path": "/facts/frozen_identity_count", "operator": "equals", "expected": 12}, {"path": "/facts/frozen_identity_invalid_count", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V6:dynamic.storage": {"claims": {"forbidden:10": [{"path": "/unresolvedCount", "operator": "equals", "expected": 0}, {"path": "/facts/confirmed_row_invalid_count", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V6:dynamic.provider": {"claims": {"forbidden:0": [{"path": "/facts/catalog_plugin_count", "operator": "equals", "expected": 12}, {"path": "/terminalReceiptCount", "operator": "gte", "expected": 12}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V6:dynamic.authorization": {"claims": {"forbidden:3": [{"path": "/facts/lease_fence_bound_job_count", "operator": "equals", "expected": 12}, {"path": "/facts/unbound_lease_fence_job_count", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V6:dynamic.recovery": {"claims": {"forbidden:9": [{"path": "/facts/recovery_pending_observed", "operator": "equals", "expected": true}, {"path": "/facts/completed_observed", "operator": "equals", "expected": true}, {"path": "/unresolvedCount", "operator": "equals", "expected": 0}]}}
  }
}
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END */) as const;

const HOST = "127.0.0.1";
const PORT = 4173;
const BASE_URL = `http://${HOST}:${PORT}`;
const root = process.cwd();
const proofRunId = process.env.GOVERNANCE_PROOF_RUN_ID?.trim() ?? "";
const proofCandidate = process.env.GOVERNANCE_PROOF_CANDIDATE?.trim() ?? "";
const receiptDir = resolve(process.env.GOVERNANCE_PROOF_RECEIPT_DIR?.trim() ?? "");
const dataDir = resolve(process.env.GRASSEYE_PRODUCTION_PROOF_DATA_DIR?.trim() ?? join(root, ".grasseye-local"));
const recoveryJobId = process.env.GRASSEYE_PRODUCTION_RECOVERY_JOB_ID?.trim() ?? "";
const startedAt = new Date().toISOString();
const browserProfile = resolveProductionBrowserProfileConfig(dataDir);

assert.equal(process.env.GOVERNANCE_PROOF_KIND, "dynamic");
assert.match(proofRunId, /^[a-f0-9]{64}$/u);
assert.match(proofCandidate, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u);
assert.ok(receiptDir.startsWith(`${resolve(tmpdir())}/`));
assert.equal(lstatSync(receiptDir).isSymbolicLink(), false);
assert.equal(lstatSync(dataDir).isDirectory(), true, "production proof must use the real runtime data directory");
assert.equal(lstatSync(dataDir).isSymbolicLink(), false);

const jobIds = (process.env.GRASSEYE_PRODUCTION_PROOF_JOB_IDS ?? "")
  .split(",").map((value) => value.trim()).filter(Boolean);
assert.equal(jobIds.length, 12, "GRASSEYE_PRODUCTION_PROOF_JOB_IDS must name twelve new website jobs");
assert.equal(new Set(jobIds).size, 12, "production proof job IDs must be unique");
assert.equal(jobIds.includes(recoveryJobId), true, "the recovery job must be one of the twelve new website jobs");

const productionDatabasePath = join(dataDir, "production-runtime.sqlite");
const mutationDatabasePath = join(dataDir, "browser", "browser-mutations.sqlite");
const runtimeLogPath = join(dataDir, "runtime-logs", "workbench.jsonl");
const placeholders = jobIds.map(() => "?").join(",");
const openReadOnly = (file: string): Database.Database => new Database(file, { readonly: true, fileMustExist: true });

const assertJobsAreNew = (): void => {
  if (!existsSync(productionDatabasePath)) return;
  const database = openReadOnly(productionDatabasePath);
  try {
    const row = database.prepare(`select count(*) as count from production_tasks where job_id in (${placeholders})`)
      .get(...jobIds) as { count: number };
    assert.equal(row.count, 0, "historical local tasks cannot be reused as Dynamic Proof");
  } finally { database.close(); }
};
assertJobsAreNew();

const delay = (milliseconds: number): Promise<void> => new Promise((done) => setTimeout(done, milliseconds));
const waitFor = async (label: string, predicate: () => boolean | Promise<boolean>): Promise<void> => {
  const timeout = Number(process.env.GOVERNANCE_PROOF_TIMEOUT_MS ?? "0");
  const deadline = Date.now() + Math.max(1, timeout - 30_000);
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(500);
  }
  throw new Error(`PRODUCTION_DYNAMIC_PROOF_TIMEOUT:${label}`);
};

const launchChrome = async (): Promise<BrowserContext> => {
  assert.equal(browserProfile.extensionId, GRASSEYE_UNPACKED_EXTENSION_ID);
  assert.equal(existsSync(browserProfile.unpackedExtensionDirectory), true, "the governed unpacked extension build is required");
  return chromium.launchPersistentContext(browserProfile.profileDir, {
    executablePath: chromium.executablePath(), headless: false,
    args: [
      `--disable-extensions-except=${browserProfile.unpackedExtensionDirectory}`,
      `--load-extension=${browserProfile.unpackedExtensionDirectory}`,
      "--no-first-run", "--no-default-browser-check", "--disable-component-update",
      "--disable-search-engine-choice-screen",
    ],
  });
};

const extensionWorker = async (context: BrowserContext): Promise<Worker> => {
  const prefix = `chrome-extension://${GRASSEYE_UNPACKED_EXTENSION_ID}/`;
  const current = context.serviceWorkers().find((worker) => worker.url().startsWith(prefix));
  if (current) return current;
  const worker = await context.waitForEvent("serviceworker");
  assert.equal(worker.url().startsWith(prefix), true);
  return worker;
};

const startWorkbench = async (): Promise<Readonly<{ handle: GrassEyeWorkbenchHandle; server: Server }>> => {
  process.env.GRASSEYE_SOURCE_FINGERPRINT = buildStartupSourceFingerprint(root);
  const handle = createGrassEyeWorkbenchHandle({
    baseUrl: BASE_URL, platformTarget: "agent-shell", browserModeMarker: "real_chrome_persistent",
    browserHeadless: false, startupReadiness: null, dataDir,
  });
  await handle.init();
  const server = createWorkbenchServer({ workbench: handle, baseUrl: BASE_URL });
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, () => { server.off("error", reject); done(); });
  });
  return { handle, server };
};

const stopWorkbench = async (handle: GrassEyeWorkbenchHandle, server: Server): Promise<void> => {
  await handle.shutdown();
  server.closeAllConnections();
  server.closeIdleConnections();
  await new Promise<void>((done) => server.close(() => done()));
};

type DirectRuntimeObservation = Readonly<{
  browser: Readonly<Record<string, unknown>>;
  service: Readonly<Record<string, unknown>>;
  database: Readonly<Record<string, unknown>>;
  storage: Readonly<Record<string, unknown>>;
  provider: Readonly<Record<string, unknown>>;
  authorization: Readonly<Record<string, unknown>>;
  recovery: Readonly<Record<string, unknown>>;
}>;

const taskHistory = new Map(jobIds.map((jobId) => [jobId, new Set<string>()]));
type HealthReport = Awaited<ReturnType<GrassEyeWorkbenchHandle["getHealthReport"]>>;
let targetClaimedObserved = false;
let taskOwnedChatgptPageObserved = false;
let finalHealth: HealthReport | null = null;
let browserVersion = "";
let extensionWorkerCount = 0;
let operatorBefore: Readonly<{ url: string; title: string }> | null = null;
let operatorAfter: Readonly<{ url: string; title: string }> | null = null;
let finalPairingState: Readonly<{ authority: "present" | "absent"; pairingSecret: string | null; releaseBuildId: string | null }> | null = null;
let context: BrowserContext | null = null;
let operatorPage: Page | null = null;
let running: Awaited<ReturnType<typeof startWorkbench>> | null = null;
let cleanupObservation: ProductionProofCleanupObservation | null = null;

try {
  context = await launchChrome();
  browserVersion = context.browser()?.version() ?? "unknown";
  await extensionWorker(context);
  extensionWorkerCount = context.serviceWorkers().filter((worker) =>
    worker.url().startsWith(`chrome-extension://${GRASSEYE_UNPACKED_EXTENSION_ID}/`)).length;
  assert.equal(extensionWorkerCount, 1, "exactly one governed extension worker must own Browser transport");
  operatorPage = await context.newPage();
  await operatorPage.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded" });
  assert.equal(new URL(operatorPage.url()).origin, "https://chatgpt.com", "a signed-in real ChatGPT page is required");
  operatorBefore = { url: operatorPage.url(), title: await operatorPage.title() };
  context.on("page", (page) => {
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame() && page !== operatorPage && frame.url().startsWith("https://chatgpt.com/")) {
        taskOwnedChatgptPageObserved = true;
      }
    });
  });

  running = await startWorkbench();
  const workbenchPage = await context.newPage();
  await workbenchPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await waitFor("browser-authority", () => running!.handle.readBrowserAuthorityPairingState().authority === "present");
  await waitFor("twelve-real-jobs", async () => {
    finalHealth = await running!.handle.getHealthReport();
    const browser = finalHealth.components.find((component) => component.name === "productionRuntimeBrowser");
    if (browser?.detail?.includes("target=claimed")) targetClaimedObserved = true;
    for (const page of context!.pages()) {
      if (page !== operatorPage && page.url().startsWith("https://chatgpt.com/")) taskOwnedChatgptPageObserved = true;
    }
    const tasks = jobIds.map((jobId) => running!.handle.readProductionTaskStatus(jobId));
    tasks.forEach((task, index) => { if (task) taskHistory.get(jobIds[index]!)!.add(task.status); });
    return tasks.every((task) => task?.status === "completed");
  });
  await waitFor("target-revoked", async () => {
    finalHealth = await running!.handle.getHealthReport();
    const browser = finalHealth.components.find((component) => component.name === "productionRuntimeBrowser");
    const execution = finalHealth.components.find((component) => component.name === "productionRuntimeExecution");
    return browser?.detail?.includes("target=absent") === true
      && execution?.detail?.includes("active=0") === true;
  });
  assert.equal(operatorPage.isClosed(), false, "the pre-existing operator page must remain open");
  operatorAfter = { url: operatorPage.url(), title: await operatorPage.title() };
  assert.deepEqual(operatorAfter, operatorBefore, "production tasks must not navigate or close the operator page");
  finalPairingState = running.handle.readBrowserExtensionBootstrapState();
} finally {
  const runningToStop = running;
  const contextToClose = context;
  cleanupObservation = await observeProductionProofCleanup(
    runningToStop === null ? null : async () => {
      await stopWorkbench(runningToStop.handle, runningToStop.server);
      return runningToStop.server.listening === false;
    },
    contextToClose === null ? null : async () => {
      const pages = contextToClose.pages();
      await contextToClose.close();
      return pages.every((page) => page.isClosed());
    },
  );
}

assert(finalHealth && operatorBefore && operatorAfter && finalPairingState && cleanupObservation);
assert.equal(cleanupObservation.cleanupVerified, true, "production proof cleanup was not observed");
assert.equal(targetClaimedObserved, true, "a job-owned exact Target claim was not observed");
assert.equal(taskOwnedChatgptPageObserved, true, "a task-owned real ChatGPT page was not observed");
assert.equal(taskHistory.get(recoveryJobId)?.has("recovery_pending"), true,
  "the named real job must be observed recovery_pending before completing with the same identity");

type TaskRow = { job_id: string; identity_json: string; request_hash: string; status: string; result_json: string; updated_at: string };
type StepRow = { job_id: string; step_id: string; result_json: string; completed_at: string };
type OutboxRow = { kind: string; path: string; body_blob: Buffer; sent_at: string | null };
type MutationRow = { command_id: string; owner_plugin_id: string; job_id: string; attempt_id: string;
  lease_version: number; execution_fence_hash: string; target_ref: string; document_ref: string;
  plugin_step_id: string; child_capability_id: string; action_ordinal: number; action_id: string;
  positive_postcondition_hash: string; negative_postcondition_hash: string;
  request_hash: string; payload_hash: string; proof_hash: string | null; state: string };

const production = openReadOnly(productionDatabasePath);
const mutations = openReadOnly(mutationDatabasePath);
let taskRows: TaskRow[];
let stepRows: StepRow[];
let outboxRows: OutboxRow[];
let mutationRows: MutationRow[];
let continuationRows: Array<{ continuation_ref: string; origin_job_id: string; lane_owner_job_id: string | null }>;
let mutationJournalMode = "";
try {
  taskRows = production.prepare(`select job_id,identity_json,request_hash,status,result_json,updated_at from production_tasks
    where job_id in (${placeholders}) order by job_id`).all(...jobIds) as TaskRow[];
  stepRows = production.prepare(`select job_id,step_id,result_json,completed_at from production_steps
    where job_id in (${placeholders}) order by job_id,step_id`).all(...jobIds) as StepRow[];
  outboxRows = production.prepare("select kind,path,body_blob,sent_at from production_outbox order by created_at,idempotency_key")
    .all() as OutboxRow[];
  continuationRows = production.prepare(`select continuation_ref,origin_job_id,lane_owner_job_id from production_continuations
    where origin_job_id in (${placeholders}) order by continuation_ref`).all(...jobIds) as typeof continuationRows;
  mutationRows = mutations.prepare(`select command_id,owner_plugin_id,job_id,attempt_id,lease_version,
    execution_fence_hash,plugin_step_id,child_capability_id,action_ordinal,target_ref,document_ref,action_id,
    positive_postcondition_hash,negative_postcondition_hash,request_hash,payload_hash,proof_hash,state
    from browser_mutations where job_id in (${placeholders}) order by job_id,updated_at,command_id`)
    .all(...jobIds) as MutationRow[];
  mutationJournalMode = String(mutations.pragma("journal_mode", { simple: true }));
} finally { production.close(); mutations.close(); }

assert.equal(taskRows.length, 12);
assert.equal(taskRows.every((row) => row.status === "completed" && Boolean(row.result_json)), true);
const observedPlugins = taskRows.map((row) => (JSON.parse(row.identity_json) as { plugin_id: string }).plugin_id).sort();
const catalogPlugins = agentPluginCapabilityManifest.plugins.map((plugin) => plugin.plugin_id).sort();
assert.deepEqual(observedPlugins, catalogPlugins, "the twelve real jobs must cover the exact Plugin Catalog");
assert.equal(jobIds.every((jobId) => stepRows.some((step) => step.job_id === jobId)), true,
  "each real job must persist at least one GPT step");
assert.equal(stepRows.every((step) => {
  const refs = (JSON.parse(step.result_json) as { evidence_refs?: unknown }).evidence_refs;
  return Array.isArray(refs) && refs.length > 0
    && refs.every((ref) => typeof ref === "string" && ref.startsWith("gpt-child-proof:"));
}), true, "every persisted GPT step must bind direct child proof references");
assert.equal(jobIds.every((jobId) => outboxRows.some((row) => row.kind === "terminal" && row.sent_at
  && row.path.includes(encodeURIComponent(jobId)) && row.body_blob.toString("utf8").includes(jobId))), true,
"each real job must have a sent provider terminal receipt");
assert.equal(continuationRows.length > 0 && continuationRows.every((row) => row.lane_owner_job_id === null), true,
  "real continuation rows must finish with no claimed lane");
assert.equal(jobIds.every((jobId) => mutationRows.some((row) => row.job_id === jobId && row.state === "CONFIRMED")), true,
  "each real job must have a confirmed browser mutation");
assert.equal(mutationRows.some((row) => ["PREPARED", "DISPATCHED"].includes(row.state)), false,
  "no physical mutation may remain unresolved");
assert.equal(mutationRows.filter((row) => row.state === "CONFIRMED").every((row) =>
  Boolean(row.proof_hash && row.target_ref && row.document_ref && row.execution_fence_hash
    && row.plugin_step_id && row.child_capability_id && row.action_ordinal >= 1
    && row.positive_postcondition_hash && row.negative_postcondition_hash
    && row.request_hash && row.payload_hash)), true);

type RuntimeEvent = { createdAt?: string; eventType?: string; missionId?: string; stepId?: string; refs?: Record<string, string> };
const runtimeEvents = readFileSync(runtimeLogPath, "utf8").split("\n").filter(Boolean)
  .map((line) => JSON.parse(line) as RuntimeEvent)
  .filter((event) => event.createdAt && event.createdAt >= startedAt && event.missionId && jobIds.includes(event.missionId));
const completedBrowserEvents = runtimeEvents.filter((event) => event.eventType === "BROWSER_ACTION_COMPLETED");
assert.equal(jobIds.every((jobId) => completedBrowserEvents.some((event) => event.missionId === jobId
  && event.refs?.targetRef && event.refs.documentRef)), true,
"each job must have direct Target and Document runtime observations");
for (const capability of [
  "bind_exact_gpt_target", "verify_gpt_workspace", "verify_gpt_execution_profile",
  "attach_approved_gpt_files_once", "verify_gpt_attachment_set", "write_exact_gpt_prompt",
  "verify_exact_gpt_prompt", "submit_exact_gpt_turn", "verify_gpt_turn_submission",
  "observe_exact_gpt_assistant_turn", "wait_for_stable_gpt_response", "checkpoint_gpt_text_response",
  "focus_exact_gpt_conversation", "verify_gpt_conversation_identity", "verify_exact_gpt_title",
]) assert.equal(completedBrowserEvents.some((event) => event.stepId === capability), true,
  `missing real GPT child ${capability}`);

const requireHealth = (value: HealthReport | null): HealthReport => {
  if (value === null) throw new Error("PRODUCTION_DYNAMIC_PROOF_HEALTH_MISSING");
  return value;
};
const observedHealth = requireHealth(finalHealth);
const component = (name: string) => observedHealth.components.find((item) => item.name === name);
const unresolvedMutationCount = mutationRows.filter((row) => ["PREPARED", "DISPATCHED"].includes(row.state)).length;
const terminalReceiptCount = outboxRows.filter((row) => row.kind === "terminal" && row.sent_at).length;
const runtimeLogSource = readFileSync(runtimeLogPath, "utf8");
const releaseIdentity = await readUnpackedExtensionReleaseIdentity(
  resolve(root, ".grasseye-local", "browser-release", "release-record.json"),
);
assert.equal(finalPairingState.releaseBuildId, releaseIdentity.releaseBuildId,
  "authenticated extension release must match the current governed release record");
const identityKeys = [
  "catalog_hash", "checkpoint_schema_version", "plugin_id", "plugin_version", "request_hash", "skill_hash",
].sort();
const catalogByPlugin = new Map(agentPluginCapabilityManifest.plugins.map((plugin) => [plugin.plugin_id, plugin]));
const frozenIdentityInvalidCount = taskRows.filter((row) => {
  const identity = JSON.parse(row.identity_json) as Record<string, unknown>;
  const plugin = catalogByPlugin.get(String(identity.plugin_id));
  return Object.keys(identity).sort().join(",") !== identityKeys.join(",")
    || identity.catalog_hash !== agentPluginCapabilityManifest.catalog_hash
    || identity.request_hash !== row.request_hash || identity.plugin_version !== plugin?.plugin_version
    || typeof identity.skill_hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(identity.skill_hash)
    || !Number.isSafeInteger(identity.checkpoint_schema_version) || Number(identity.checkpoint_schema_version) < 1;
}).length;
assert.equal(frozenIdentityInvalidCount, 0, "every durable task identity must freeze all six governed identity fields");
const confirmedRowInvalidCount = mutationRows.filter((row) => row.state === "CONFIRMED" && !(
  row.command_id && row.owner_plugin_id && row.job_id && row.attempt_id && row.lease_version > 0
  && row.execution_fence_hash && row.target_ref && row.document_ref && row.action_id
  && row.request_hash && row.payload_hash && row.proof_hash
)).length;
assert.equal(confirmedRowInvalidCount, 0);
assert.equal(mutationJournalMode.toLowerCase(), "wal", "Browser mutations must remain on SQLite WAL");
const exactTargetDocumentBindingCount = jobIds.filter((jobId) => completedBrowserEvents.some((event) =>
  event.missionId === jobId && event.refs?.targetRef && event.refs.documentRef)).length;
const leaseFenceBoundJobCount = jobIds.filter((jobId) => mutationRows.some((row) => row.job_id === jobId
  && row.lease_version > 0 && Boolean(row.attempt_id && row.execution_fence_hash))).length;
const readinessNames = observedHealth.components.map((item) => item.name);
const persistedSensitiveValueCount = [operatorBefore.url, browserProfile.profileDir]
  .filter((needle) => runtimeLogSource.includes(needle) || JSON.stringify(mutationRows).includes(needle)).length;
const observation: DirectRuntimeObservation = Object.freeze({
  browser: {
    browserVersion, endpoint: operatorBefore.url, pageTitle: operatorBefore.title || "ChatGPT",
    facts: {
      authority_present: finalPairingState.authority === "present",
      exact_target_document_binding_count: exactTargetDocumentBindingCount,
      extension_worker_count: extensionWorkerCount,
      final_target_absent: component("productionRuntimeBrowser")?.detail?.includes("target=absent") === true,
      operator_page_unchanged: JSON.stringify(operatorAfter) === JSON.stringify(operatorBefore),
      persisted_sensitive_value_count: persistedSensitiveValueCount,
      readiness_dimension_count: new Set(readinessNames).size,
      readiness_dimensions_distinct: new Set(readinessNames).size === readinessNames.length,
      release_build_matches_record: finalPairingState.releaseBuildId === releaseIdentity.releaseBuildId,
      target_claimed_observed: targetClaimedObserved,
      task_owned_chatgpt_page_observed: taskOwnedChatgptPageObserved,
    },
    sessionFacts: {
      authorityState: finalPairingState.authority, pairingSecretCleared: finalPairingState.pairingSecret === null,
      releaseBuildId: finalPairingState.releaseBuildId, extensionId: GRASSEYE_UNPACKED_EXTENSION_ID,
      targetClaimedObserved, taskOwnedChatgptPageObserved,
      finalTargetAbsent: component("productionRuntimeBrowser")?.detail?.includes("target=absent") === true,
      operatorPageUnchanged: JSON.stringify(operatorAfter) === JSON.stringify(operatorBefore),
      transportCount: 1, persistedRawOperatorPageCount: runtimeLogSource.includes(operatorBefore.url) ? 1 : 0,
    },
  },
  service: {
    cleanupVerified: cleanupObservation.cleanupVerified,
    components: observedHealth.components.map((item) => item.name), endpoint: BASE_URL, processId: process.pid,
    facts: {
      browser_context_closed: cleanupObservation.browserContextClosed,
      cleanup_verified: cleanupObservation.cleanupVerified,
      readiness_dimension_count: new Set(readinessNames).size,
      readiness_dimensions_distinct: new Set(readinessNames).size === readinessNames.length,
      workbench_stopped: cleanupObservation.workbenchStopped,
    },
    serviceName: "agent-production-runtime", sourceFingerprint: observedHealth.sourceFingerprint,
    status: observedHealth.status,
  },
  database: {
    databaseEngine: "sqlite", databasePath: productionDatabasePath, identitySet: jobIds,
    facts: { frozen_identity_count: taskRows.length, frozen_identity_invalid_count: frozenIdentityInvalidCount },
    recordCounts: { tasks: taskRows.length, steps: stepRows.length, continuations: continuationRows.length },
  },
  storage: {
    confirmedCount: mutationRows.filter((row) => row.state === "CONFIRMED").length,
    facts: {
      confirmed_row_invalid_count: confirmedRowInvalidCount,
      mutation_rows_complete: confirmedRowInvalidCount === 0,
      sqlite_wal_mode: mutationJournalMode.toLowerCase() === "wal",
    },
    mutationCount: mutationRows.length, storageEngine: "sqlite-wal", storagePath: mutationDatabasePath,
    unresolvedCount: unresolvedMutationCount,
  },
  provider: {
    catalogHash: agentPluginCapabilityManifest.catalog_hash, pluginIds: observedPlugins,
    facts: { catalog_plugin_count: catalogPlugins.length, provider_count: 1 },
    providerName: "ChatGPT", terminalReceiptCount,
  },
  authorization: {
    authorityState: "present", fenceHashes: [...new Set(mutationRows.map((row) => row.execution_fence_hash))],
    facts: {
      exact_target_document_binding_count: exactTargetDocumentBindingCount,
      lease_fence_bound_job_count: leaseFenceBoundJobCount,
      unbound_lease_fence_job_count: jobIds.length - leaseFenceBoundJobCount,
    },
    grantCount: mutationRows.length, principalIds: observedPlugins,
  },
  recovery: {
    facts: {
      completed_observed: taskHistory.get(recoveryJobId)!.has("completed"),
      recovery_pending_observed: taskHistory.get(recoveryJobId)!.has("recovery_pending"),
    },
    finalState: "completed", observedStates: [...taskHistory.get(recoveryJobId)!],
    recoveryJobId, unresolvedCount: unresolvedMutationCount,
  },
});

type DynamicMode = `dynamic.${keyof DirectRuntimeObservation}`;
const orderedClauses = (values: readonly string[]): string[] => [...values].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));
const modeClauses = new Map(Object.entries(dynamicClaimContract.routes).map(([route, contract]) =>
  [route, orderedClauses(Object.keys(contract.claims))]));
const observationForMode = (evidenceMode: DynamicMode): Readonly<Record<string, unknown>> =>
  observation[evidenceMode.slice("dynamic.".length) as keyof DirectRuntimeObservation];
const receiptFor = (
  lawId: string, evidenceMode: DynamicMode, clauses: readonly string[], observedValue: string,
): Readonly<{ path: string; digest: string }> => {
  const path = join(receiptDir, `${lawId.toLowerCase()}-${evidenceMode.replace(".", "-")}.json`);
  assert.equal(dirname(path), receiptDir);
  writeFileSync(path, `${JSON.stringify({ schema_version: "governance-dynamic-observation.v2",
    proof_run_id: proofRunId, candidate: proofCandidate, captured_at: new Date().toISOString(),
    lawId, evidenceMode, observation_kind: evidenceMode.slice("dynamic.".length), clauses,
    observed_value: observedValue, producer_script: "acceptance:agent-production-runtime:real-proof",
    observation: observationForMode(evidenceMode as DynamicMode) })}\n`, { mode: 0o600, flag: "wx" });
  return { path, digest: createHash("sha256").update(readFileSync(path)).digest("hex") };
};
const emit = (lawId: string, evidenceMode: DynamicMode, observedValue: string): void => {
  const clauses = modeClauses.get(`${lawId}:${evidenceMode}`);
  assert.ok(clauses && clauses.length > 0, `missing mode-native clauses for ${lawId}:${evidenceMode}`);
  const receipt = receiptFor(lawId, evidenceMode, clauses, observedValue);
  emitQualityProofObservation({ passed: true, findings: [], lawId, evidenceMode,
    clauses, locator: receipt.path, receipt: receipt.digest, observedValue });
};

for (const [lawId, mode] of [
  ["LAW-LOCAL-BROWSER-SESSION-001-V4", "dynamic.browser"], ["LAW-LOCAL-BROWSER-SESSION-002-V6", "dynamic.browser"],
  ["LAW-LOCAL-BROWSER-SESSION-003-V11", "dynamic.browser"], ["LAW-LOCAL-BROWSER-SESSION-004-V10", "dynamic.storage"],
  ["LAW-LOCAL-BROWSER-SESSION-005-V6", "dynamic.browser"], ["LAW-LOCAL-BROWSER-SESSION-006-V3", "dynamic.browser"],
] as const) emit(lawId, mode, `${mode};realChrome=${browserVersion};jobs=12;targetClaimed=true;targetAbsent=true`);
for (const mode of ["dynamic.browser", "dynamic.provider", "dynamic.authorization", "dynamic.recovery"] as const) {
  emit("LAW-GPT-001-V3", mode, `${mode};realChildren=${completedBrowserEvents.length};jobs=12`);
}
for (const mode of [
  "dynamic.browser", "dynamic.service", "dynamic.database", "dynamic.storage",
  "dynamic.provider", "dynamic.authorization", "dynamic.recovery",
] as const) emit("LAW-AGENT-PRODUCTION-RUNTIME-001-V6", mode, `${mode};plugins=12;jobs=12`);

process.stdout.write(`[ACCEPTANCE][agent-production-runtime][direct-real-proof] PASS run=${proofRunId}\n`);
