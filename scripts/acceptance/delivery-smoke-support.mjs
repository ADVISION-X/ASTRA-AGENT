import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import { waitForHealth } from "../startup/lib/health-check.mjs";

const ignoredDirs = new Set([".git", ".venv", "dist", "node_modules", ".grasseye-data"]);

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function requireRealPlatformTarget() {
  if (process.env.GRASSEYE_PLATFORM_TARGET !== "tiktok-web") {
    throw new Error("acceptance:delivery-smoke requires GRASSEYE_PLATFORM_TARGET=tiktok-web.");
  }

  return process.env.GRASSEYE_PLATFORM_TARGET;
}

export function getRealPlatformUrl() {
  return process.env.GRASSEYE_REAL_PLATFORM_URL ?? "https://www.tiktok.com/foryou";
}

const isForbiddenTestDirectory = (entryName) => entryName === "tests" || entryName === "__tests__";

const isForbiddenTestFile = (entryName) => /\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(entryName);

const collectEntryViolations = async (rootDir, relativeDir, entry) => {
  if (entry.isDirectory()) {
    if (ignoredDirs.has(entry.name)) {
      return [];
    }

    const relativePath = path.posix.join(relativeDir, entry.name);
    if (isForbiddenTestDirectory(entry.name)) {
      return [relativePath];
    }

    return scanForForbiddenTestFiles(rootDir, relativePath);
  }

  return isForbiddenTestFile(entry.name) ? [path.posix.join(relativeDir, entry.name)] : [];
};

export async function scanForForbiddenTestFiles(rootDir, relativeDir = "") {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const violations = [];

  for (const entry of entries) {
    violations.push(...await collectEntryViolations(rootDir, relativeDir, entry));
  }

  return violations;
}

async function fetchJson(url, init) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.json();
}

async function waitForTaskToSettle(snapshotUrl, maxAttempts = 240) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const snapshot = await fetchJson(snapshotUrl);
    const status = snapshot.agent?.currentTask?.status;
    if (status && ["completed", "paused", "stopped", "review_required", "failed"].includes(status)) {
      return snapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("acceptance:delivery-smoke task did not settle in time");
}

const createRuntimeServerProcess = ({ repoRoot, tempDataDir, platformTarget, realPlatformUrl, port }) =>
  spawn(process.execPath, ["dist/src/app/server.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      GRASSEYE_HOST: "127.0.0.1",
      GRASSEYE_PORT: String(port),
      GRASSEYE_DATA_DIR: path.join(tempDataDir, "runtime-smoke"),
      GRASSEYE_PLATFORM_TARGET: platformTarget,
      GRASSEYE_BROWSER_HEADLESS: "false",
      GRASSEYE_REAL_PLATFORM_URL: realPlatformUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

const attachStderrCollector = (serverProcess) => {
  let stderr = "";
  serverProcess.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  return () => stderr;
};

const assertDeliverySnapshotShape = (runtimeSnapshot) => {
  const delivery = runtimeSnapshot.delivery;

  for (const key of [
    "currentRoundStep",
    "currentUrl",
    "targetUrl",
    "pageReadyStatus",
    "geometryGuardStatus",
    "viewport",
    "calibration",
    "latestScreenshotEvidenceId",
    "latestAiResultId",
    "latestActionLogId",
    "latestRoundTraceStep",
    "latestRoundTraceStatus",
    "latestRoundTraceDetail",
    "noCandidateReason",
    "evidencePacketCount",
    "browseLedgerCount",
    "roundLifecycleEventCount",
    "roundStructuralLogCount",
    "advancedAiExportCount",
    "latestBrowseSummary",
  ]) {
    assert(Object.hasOwn(delivery, key), `runtime snapshot delivery is missing ${key}`);
  }

  assert(runtimeSnapshot.mode.dataMode === "Real Platform", "runtime snapshot must stay in real-platform mode");
  assert(runtimeSnapshot.mode.platformId === "tiktok-web", "runtime snapshot must report the real platform id");
  assert(runtimeSnapshot.agent.currentTask, "runtime snapshot must expose an active or settled task");
  assert(runtimeSnapshot.agent.currentTask.status !== "failed", `real-platform delivery smoke failed: ${runtimeSnapshot.agent.currentTask.note ?? "unknown reason"}`);
  assert(delivery.pageReadyStatus !== "idle", "delivery snapshot must advance beyond idle after starting the task");
  assert(delivery.actionLogCount > 0 || Boolean(delivery.latestActionLogId), "delivery snapshot must expose runtime action proof");
};

const stopRuntimeServer = async (serverProcess, stderr) => {
  serverProcess.kill("SIGINT");
  await new Promise((resolve) => {
    serverProcess.once("exit", resolve);
    setTimeout(resolve, 5000);
  });

  assert(serverProcess.exitCode === 0 || serverProcess.exitCode === null, `delivery smoke server exited abnormally: ${stderr.trim() || "unknown error"}`);
};

export async function verifyRuntimeEndpoints({ repoRoot, tempDataDir, platformTarget, realPlatformUrl, verifyRealCoordinateClick }) {
  const port = 4187;
  const serverProcess = createRuntimeServerProcess({ repoRoot, tempDataDir, platformTarget, realPlatformUrl, port });
  const readStderr = attachStderrCollector(serverProcess);

  try {
    const healthUrl = `http://127.0.0.1:${port}/api/runtime/health`;
    const snapshotUrl = `http://127.0.0.1:${port}/api/runtime/snapshot`;
    const startUrl = `http://127.0.0.1:${port}/api/tasks/start`;
    const health = await waitForHealth({ url: healthUrl, timeoutMs: 30000, intervalMs: 250, serviceProcess: serverProcess });

    assert(Array.isArray(health.components) && health.components.length >= 5, "health endpoint must report the core runtime components");
    await verifyRealCoordinateClick(realPlatformUrl, tempDataDir);
    await fetchJson(startUrl, { method: "POST" });
    assertDeliverySnapshotShape(await waitForTaskToSettle(snapshotUrl));
  } finally {
    await stopRuntimeServer(serverProcess, readStderr());
  }
}