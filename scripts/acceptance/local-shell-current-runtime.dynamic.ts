import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";

import { chromium, type Browser } from "playwright";

import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";

const root = process.cwd();
const proofRunId = process.env.GOVERNANCE_PROOF_RUN_ID?.trim() ?? "";
const proofCandidate = process.env.GOVERNANCE_PROOF_CANDIDATE?.trim() ?? "";
assert.equal(process.env.GOVERNANCE_PROOF_KIND, "dynamic");
assert.match(proofRunId, /^[a-f0-9]{64}$/u);
assert.match(proofCandidate, /^[a-f0-9]{64}$/u);

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

type Health = { status: string; sourceFingerprint: string; components?: Array<{ name?: string; ok?: boolean }> };
const waitForCurrentHealth = async (baseUrl: string, child: ChildProcess, output: () => string): Promise<Health> => {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`CURRENT_RUNTIME_EXITED:${output()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        const health = await response.json() as Health;
        if (["healthy", "degraded"].includes(health.status)) return health;
      }
    } catch { /* retry until the real startup entrypoint finishes */ }
    await delay(500);
  }
  throw new Error(`CURRENT_RUNTIME_HEALTH_TIMEOUT:${output()}`);
};

const port = await freePort();
const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-current-runtime-"));
const baseUrl = `http://127.0.0.1:${port}`;
let stdout = "";
let stderr = "";
let browser: Browser | undefined;
let observation: Readonly<{ health: Health; listenerPid: number; browserVersion: string; screenshotSha256: string }> | undefined;
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
  assert.equal(await page.title(), "GrassEye AGENT Workbench");
  assert.deepEqual({
    shell: await page.locator("[data-app-shell]").count(), sidebar: await page.locator("[data-app-shell-sidebar]").count(),
    workspace: await page.locator("main[data-app-shell-workspace]").count(), inspector: await page.locator("[data-app-shell-inspector]").count(),
    console: await page.locator("[data-runtime-console]").count(), retired: await page.locator("[data-user-demand-startup], [data-legacy-app]").count(),
  }, { shell: 1, sidebar: 1, workspace: 1, inspector: 1, console: 1, retired: 0 });
  const screenshot = path.join(dataDir, "current-app-shell.png");
  await page.screenshot({ path: screenshot, fullPage: true, type: "png" });
  observation = Object.freeze({ health, listenerPid, browserVersion: browser.version(),
    screenshotSha256: createHash("sha256").update(readFileSync(screenshot)).digest("hex") });
} finally {
  await browser?.close();
  await stopLaunch(launch);
  assert.deepEqual(listenerPids(port), [], "the current runtime listener must be cleaned up");
  await rm(dataDir, { recursive: true, force: true });
}

assert(observation);
const runtimeValue = `run=${proofRunId};candidate=${proofCandidate};pid=${observation.listenerPid};health=${observation.health.status}`;
const browserValue = `${runtimeValue};browser=${observation.browserVersion};screenshotSha256=${observation.screenshotSha256}`;
emitQualityProofObservation({ lawId: "LAW-LOCAL-APP-SHELL-001-V5", evidenceMode: "dynamic.browser", locator: `${baseUrl}/`, observedValue: browserValue });
emitQualityProofObservation({ lawId: "LAW-LOCAL-APP-SHELL-001-V5", evidenceMode: "dynamic.service", locator: `${baseUrl}/api/health`, observedValue: runtimeValue });
emitQualityProofObservation({ lawId: "LAW-LOCAL-APP-SHELL-003-V2", evidenceMode: "dynamic.service", locator: `${baseUrl}/api/health#components`, observedValue: `${runtimeValue};components=${observation.health.components?.length ?? 0}` });
emitQualityProofObservation({ lawId: "LAW-STARTUP-ENTRYPOINT-001-V4", evidenceMode: "dynamic.service", locator: `process:${observation.listenerPid}`, observedValue: `${runtimeValue};startup=grasseye:start;cleanup=verified` });
emitQualityProofObservation({ lawId: "LAW-STARTUP-ENTRYPOINT-002-V1", evidenceMode: "dynamic.service", locator: `tcp://127.0.0.1:${port}`, observedValue: `${runtimeValue};listenerOwner=${root};cleanup=verified` });
emitQualityProofObservation({ lawId: "LAW-WORKBENCH-API-BOUNDARY-001-V4", evidenceMode: "dynamic.browser", locator: `${baseUrl}/`, observedValue: `${browserValue};knownRoute=/` });
