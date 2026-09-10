import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";

import { chromium, type Browser } from "playwright";
import Database from "better-sqlite3";

import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";

const dynamicClaimContract = (/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_BEGIN */
{
  "schema_version": "producer-dynamic-claim-contract.v1",
  "routes": {
    "LAW-LOCAL-APP-SHELL-001-V6:dynamic.browser": {"claims": {"forbidden:5": [{"path": "/facts/browser_command_surface_count", "operator": "equals", "expected": 0}]}},
    "LAW-LOCAL-APP-SHELL-001-V6:dynamic.service": {"claims": {"forbidden:4": [{"path": "/facts/listener_count", "operator": "equals", "expected": 1}], "forbidden:8": [{"path": "/facts/readiness_component_count", "operator": "gte", "expected": 2}, {"path": "/facts/readiness_components_distinct", "operator": "equals", "expected": true}]}},
    "LAW-LOCAL-APP-SHELL-003-V4:dynamic.service": {"claims": {"forbidden:0": [{"path": "/facts/readiness_component_count", "operator": "gte", "expected": 2}, {"path": "/facts/readiness_components_distinct", "operator": "equals", "expected": true}]}},
    "LAW-STARTUP-ENTRYPOINT-001-V4:dynamic.service": {"claims": {"forbidden:5": [{"path": "/facts/production_task_count", "operator": "equals", "expected": 0}, {"path": "/facts/shell_http_available", "operator": "equals", "expected": true}]}},
    "LAW-STARTUP-ENTRYPOINT-002-V4:dynamic.service": {"claims": {"forbidden:0": [{"path": "/facts/foreign_repository_child_process_count", "operator": "equals", "expected": 0}]}}
  }
}
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END */) as const;

const root = process.cwd();
const proofRunId = process.env.GOVERNANCE_PROOF_RUN_ID?.trim() ?? "";
const proofCandidate = process.env.GOVERNANCE_PROOF_CANDIDATE?.trim() ?? "";
const proofReceiptDir = path.resolve(process.env.GOVERNANCE_PROOF_RECEIPT_DIR?.trim() ?? "");
assert.equal(process.env.GOVERNANCE_PROOF_KIND, "dynamic");
assert.match(proofRunId, /^[a-f0-9]{64}$/u);
assert.match(proofCandidate, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u);
assert.ok(proofReceiptDir.startsWith(`${path.resolve(tmpdir())}/`));
mkdirSync(proofReceiptDir, { recursive: true, mode: 0o700 });

const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));
const freePort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
};

const listenerPids = (port: number): number[] => {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
  if (result.status === 1 && !result.stdout.trim()) return [];
  assert.equal(result.status, 0, result.stderr);
  return [...new Set(result.stdout.split(/\r?\n/u).map(Number).filter((pid) => Number.isInteger(pid) && pid > 0))];
};

const processField = (pid: number, field: "command" | "cwd"): string => {
  if (field === "command") return spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }).stdout.trim();
  const result = spawnSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8" });
  return result.stdout.split(/\r?\n/u).find((line) => line.startsWith("n"))?.slice(1).trim() ?? "";
};
const descendantPids = (parentPid: number): number[] => {
  const found = new Set<number>();
  const pending = [parentPid];
  while (pending.length > 0) {
    const current = pending.shift()!;
    const result = spawnSync("pgrep", ["-P", String(current)], { encoding: "utf8" });
    if (result.status !== 0 && !(result.status === 1 && !result.stdout.trim())) throw new Error(result.stderr);
    for (const pid of result.stdout.split(/\r?\n/u).map(Number).filter((value) => Number.isInteger(value) && value > 0)) {
      if (!found.has(pid)) { found.add(pid); pending.push(pid); }
    }
  }
  return [...found];
};
const productionTaskCount = (directory: string): number => {
  const databasePath = path.join(directory, "production-runtime.sqlite");
  if (!existsSync(databasePath)) return 0;
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try { return (database.prepare("select count(*) as count from production_tasks").get() as { count: number }).count; }
  finally { database.close(); }
};

const stopLaunch = async (child: ChildProcess): Promise<void> => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  const graceful = await Promise.race([exited.then(() => true), delay(10_000).then(() => false)]);
  if (!graceful) {
    child.kill("SIGKILL");
    await exited;
    throw new Error("CURRENT_RUNTIME_CLEANUP_REQUIRED_SIGKILL");
  }
};

type Health = { status: string; sourceFingerprint: string; components?: Array<{ name?: string; ok?: boolean; detail?: string }> };
const waitForCurrentHealth = async (baseUrl: string, child: ChildProcess, output: () => string): Promise<Health> => {
  let lastFailure = "health endpoint not ready";
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`CURRENT_RUNTIME_EXITED:${output()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        const health = await response.json() as Health;
        if (["healthy", "degraded"].includes(health.status)) return health;
      }
      lastFailure = `health endpoint returned ${response.status}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }
  throw new Error(`CURRENT_RUNTIME_HEALTH_TIMEOUT:${lastFailure}:${output()}`);
};

const port = await freePort();
const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-current-runtime-"));
const baseUrl = `http://127.0.0.1:${port}`;
let stdout = "";
let stderr = "";
let browser: Browser | undefined;
let observation: Readonly<{
  health: Health; listenerPid: number; browserVersion: string; pageTitle: string; screenshotSha256: string;
  browserCommandSurfaceCount: number; foreignRepositoryChildProcessCount: number; productionTaskCount: number;
}> | undefined;
const browserReceiptPath = path.join(proofReceiptDir, "app-shell-browser.json");
const shellHealthReceiptPath = path.join(proofReceiptDir, "shell-health.json");
const degradedHealthReceiptPath = path.join(proofReceiptDir, "degraded-health.json");
const startupProcessReceiptPath = path.join(proofReceiptDir, "startup-process.json");
const startupListenerReceiptPath = path.join(proofReceiptDir, "startup-listener.json");
const launch = spawn(process.execPath, ["--env-file-if-exists=.env.local", "scripts/startup/launch-grasseye.mjs", "--no-open"], {
  cwd: root,
  env: { ...process.env, GRASSEYE_DATA_DIR: dataDir, GRASSEYE_HOST: "127.0.0.1", GRASSEYE_PORT: String(port), GRASSEYE_SKIP_OPEN: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
launch.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
launch.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

try {
  const health = await waitForCurrentHealth(baseUrl, launch, () => `${stdout}\n${stderr}`);
  assert.equal(health.sourceFingerprint, buildStartupSourceFingerprint(root));
  assert.match(stdout, /waiting_for_human_command ready/u);
  const pids = listenerPids(port);
  assert.equal(pids.length, 1, "the current runtime must have one listener");
  const listenerPid = pids[0]!;
  assert.equal(processField(listenerPid, "cwd"), root);
  assert.match(processField(listenerPid, "command"), /src\/app\/server\.ts/u);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const pageTitle = await page.title();
  assert.equal(pageTitle, "GrassEye AGENT Workbench");
  assert.deepEqual({
    shell: await page.locator("[data-app-shell]").count(), sidebar: await page.locator("[data-app-shell-sidebar]").count(),
    workspace: await page.locator("main[data-app-shell-workspace]").count(), inspector: await page.locator("[data-app-shell-inspector]").count(),
    console: await page.locator("[data-runtime-console]").count(), retired: await page.locator("[data-user-demand-startup], [data-legacy-app]").count(),
  }, { shell: 1, sidebar: 1, workspace: 1, inspector: 1, console: 1, retired: 0 });
  const browserCommandSurfaceCount = await page.locator(
    "[data-browser-command], [data-browser-action], form[action*='browser']",
  ).count();
  assert.equal(browserCommandSurfaceCount, 0);
  const screenshot = path.join(dataDir, "current-app-shell.png");
  await page.screenshot({ path: screenshot, fullPage: true, type: "png" });
  const foreignRepositoryChildProcessCount = descendantPids(launch.pid!).filter((pid) => {
    const cwd = processField(pid, "cwd");
    return cwd.length > 0 && cwd !== root && !cwd.startsWith(`${root}/`);
  }).length;
  assert.equal(foreignRepositoryChildProcessCount, 0);
  const observedProductionTaskCount = productionTaskCount(dataDir);
  assert.equal(observedProductionTaskCount, 0);
  observation = Object.freeze({ health, listenerPid, browserVersion: browser.version(), pageTitle,
    screenshotSha256: createHash("sha256").update(readFileSync(screenshot)).digest("hex"),
    browserCommandSurfaceCount, foreignRepositoryChildProcessCount,
    productionTaskCount: observedProductionTaskCount });
} finally {
  await browser?.close();
  await stopLaunch(launch);
  assert.deepEqual(listenerPids(port), [], "the current runtime listener must be cleaned up");
  await rm(dataDir, { recursive: true, force: true });
}

assert(observation);
const runtimeValue = `run=${proofRunId};candidate=${proofCandidate};pid=${observation.listenerPid};health=${observation.health.status}`;
const browserValue = `${runtimeValue};browser=${observation.browserVersion};screenshotSha256=${observation.screenshotSha256}`;
const componentNames = observation.health.components?.map((component) => component.name ?? "unnamed-component") ?? [];
const serviceObservation = (serviceName: string) => ({
  cleanupVerified: listenerPids(port).length === 0, components: componentNames, endpoint: baseUrl,
  facts: {
    foreign_repository_child_process_count: observation.foreignRepositoryChildProcessCount,
    listener_count: 1,
    production_task_count: observation.productionTaskCount,
    readiness_component_count: new Set(componentNames).size,
    readiness_components_distinct: new Set(componentNames).size === componentNames.length,
    shell_http_available: true,
  },
  processId: observation.listenerPid, serviceName, sourceFingerprint: observation.health.sourceFingerprint,
  status: observation.health.status,
});
const receiptPayload = (input: {
  clauses: string[];
  evidenceMode: "dynamic.browser" | "dynamic.service";
  lawId: string;
  observation: Readonly<Record<string, unknown>>;
  observedValue: string;
}) => ({
  schema_version: "governance-dynamic-observation.v2", proof_run_id: proofRunId, candidate: proofCandidate,
  captured_at: new Date().toISOString(), lawId: input.lawId, evidenceMode: input.evidenceMode,
  observation_kind: input.evidenceMode.slice("dynamic.".length), clauses: input.clauses,
  observed_value: input.observedValue, producer_script: "proof:local-shell-current-runtime",
  observation: input.observation,
});
const writeReceipt = (receiptPath: string, input: Parameters<typeof receiptPayload>[0]): void => {
  writeFileSync(receiptPath, `${JSON.stringify(receiptPayload(input))}\n`, { mode: 0o600, flag: "wx" });
};
const clausesFor = (lawId: string, evidenceMode: string): string[] => Object.keys(
  (dynamicClaimContract.routes as Readonly<Record<string, { claims: Readonly<Record<string, unknown>> }>>)
    [`${lawId}:${evidenceMode}`]!.claims,
).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
const browserClauses = clausesFor("LAW-LOCAL-APP-SHELL-001-V6", "dynamic.browser");
const shellClauses = clausesFor("LAW-LOCAL-APP-SHELL-001-V6", "dynamic.service");
const degradedClauses = clausesFor("LAW-LOCAL-APP-SHELL-003-V4", "dynamic.service");
const startupProcessClauses = clausesFor("LAW-STARTUP-ENTRYPOINT-001-V4", "dynamic.service");
const startupListenerClauses = clausesFor("LAW-STARTUP-ENTRYPOINT-002-V4", "dynamic.service");
const degradedValue = `${runtimeValue};components=${componentNames.length}`;
const startupProcessValue = `${runtimeValue};startup=grasseye:start;cleanup=verified`;
const startupListenerValue = `${runtimeValue};listenerOwner=${root};cleanup=verified`;
writeReceipt(browserReceiptPath, {
  clauses: browserClauses, evidenceMode: "dynamic.browser", lawId: "LAW-LOCAL-APP-SHELL-001-V6",
  observedValue: browserValue,
  observation: { browserVersion: observation.browserVersion, endpoint: baseUrl, pageTitle: observation.pageTitle,
    facts: { browser_command_surface_count: observation.browserCommandSurfaceCount },
    sessionFacts: { screenshotSha256: observation.screenshotSha256, shellCount: 1, retiredSurfaceCount: 0 } },
});
writeReceipt(shellHealthReceiptPath, { clauses: shellClauses, evidenceMode: "dynamic.service",
  lawId: "LAW-LOCAL-APP-SHELL-001-V6", observedValue: runtimeValue,
  observation: serviceObservation("local-app-shell") });
writeReceipt(degradedHealthReceiptPath, { clauses: degradedClauses, evidenceMode: "dynamic.service",
  lawId: "LAW-LOCAL-APP-SHELL-003-V4", observedValue: degradedValue,
  observation: serviceObservation("local-app-shell-status") });
writeReceipt(startupProcessReceiptPath, { clauses: startupProcessClauses, evidenceMode: "dynamic.service",
  lawId: "LAW-STARTUP-ENTRYPOINT-001-V4", observedValue: startupProcessValue,
  observation: serviceObservation("grasseye-startup-shell") });
writeReceipt(startupListenerReceiptPath, { clauses: startupListenerClauses, evidenceMode: "dynamic.service",
  lawId: "LAW-STARTUP-ENTRYPOINT-002-V4", observedValue: startupListenerValue,
  observation: serviceObservation("grasseye-local-listener") });
const nativeReceipt = (receiptPath: string): string => createHash("sha256").update(readFileSync(receiptPath)).digest("hex");
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-LOCAL-APP-SHELL-001-V6", evidenceMode: "dynamic.browser", clauses: browserClauses,
  locator: browserReceiptPath, receipt: nativeReceipt(browserReceiptPath), observedValue: browserValue });
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-LOCAL-APP-SHELL-001-V6", evidenceMode: "dynamic.service", clauses: shellClauses,
  locator: shellHealthReceiptPath, receipt: nativeReceipt(shellHealthReceiptPath), observedValue: runtimeValue });
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-LOCAL-APP-SHELL-003-V4", evidenceMode: "dynamic.service", clauses: degradedClauses,
  locator: degradedHealthReceiptPath, receipt: nativeReceipt(degradedHealthReceiptPath),
  observedValue: degradedValue });
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-STARTUP-ENTRYPOINT-001-V4", evidenceMode: "dynamic.service", clauses: startupProcessClauses,
  locator: startupProcessReceiptPath, receipt: nativeReceipt(startupProcessReceiptPath),
  observedValue: startupProcessValue });
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-STARTUP-ENTRYPOINT-002-V4", evidenceMode: "dynamic.service", clauses: startupListenerClauses,
  locator: startupListenerReceiptPath, receipt: nativeReceipt(startupListenerReceiptPath),
  observedValue: startupListenerValue });
