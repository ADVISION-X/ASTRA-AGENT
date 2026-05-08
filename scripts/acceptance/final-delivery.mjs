import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { waitForHealth } from "../startup/lib/health-check.mjs";

const ignoredDirs = new Set([".git", ".venv", "dist", "node_modules", ".grasseye-data"]);
const TERMINAL_TASK_STATUSES = new Set(["completed", "paused", "stopped", "review_required", "failed"]);
const PHASE_FIVE = "phase-05-final-delivery-debug";
const TASK_TEMPLATE_BY_PLATFORM = {
  "facebook-web": "facebook-seeding-video-discovery",
  "tiktok-web": "tiktok-seeding-video-discovery",
};
const HEALTH_COMPONENT_NAMES = ["console", "agent", "browserController", "dataStore"];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireRealPlatformTarget() {
  const platformTarget = process.env.GRASSEYE_PLATFORM_TARGET?.trim() || "tiktok-web";
  assert(platformTarget === "tiktok-web" || platformTarget === "facebook-web", "acceptance:final-delivery requires GRASSEYE_PLATFORM_TARGET=tiktok-web or facebook-web.");
  return platformTarget;
}

function getRealPlatformUrl(platformTarget) {
  if (process.env.GRASSEYE_REAL_PLATFORM_URL?.trim()) {
    return process.env.GRASSEYE_REAL_PLATFORM_URL.trim();
  }

  return platformTarget === "facebook-web"
    ? "https://www.facebook.com/reel/"
    : "https://www.tiktok.com/foryou";
}

function getTaskStartPayload(platformTarget) {
  const taskTemplateId = process.env.GRASSEYE_TASK_TEMPLATE_ID?.trim() || TASK_TEMPLATE_BY_PLATFORM[platformTarget];
  assert(taskTemplateId, `acceptance:final-delivery could not resolve a taskTemplateId for ${platformTarget}.`);
  return {
    commandSource: "acceptance:final-delivery",
    humanGoal: `Run the active ${platformTarget} seeded discovery mission for final-delivery verification.`,
    maxRounds: 1,
    maxMinutes: 2,
    operatorNote: "phase-five final-delivery runtime acceptance",
    taskTemplateId,
  };
}

async function collectEntryViolations(rootDir, relativeDir, entry) {
  if (entry.isDirectory()) {
    if (ignoredDirs.has(entry.name)) {
      return [];
    }

    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.name === "tests" || entry.name === "__tests__") {
      return [relativePath];
    }

    return scanForForbiddenTestFiles(rootDir, relativePath);
  }

  return /\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(entry.name) ? [path.posix.join(relativeDir, entry.name)] : [];
}

async function scanForForbiddenTestFiles(rootDir, relativeDir = "") {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const violations = [];

  for (const entry of entries) {
    violations.push(...await collectEntryViolations(rootDir, relativeDir, entry));
  }

  return violations;
}

async function fetchJson(url, init) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "content-type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    const failureBody = await response.text();
    throw new Error(`${url} returned HTTP ${response.status}: ${failureBody || "empty response body"}`);
  }

  return response.json();
}

function createStartupProcess({ repoRoot, tempDataDir, platformTarget, realPlatformUrl }) {
  return spawn(process.execPath, ["scripts/startup/launch-grasseye.mjs"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      GRASSEYE_HOST: "127.0.0.1",
      GRASSEYE_PORT: "4173",
      GRASSEYE_PLATFORM_TARGET: platformTarget,
      GRASSEYE_BROWSER_HEADLESS: "false",
      GRASSEYE_DATA_DIR: path.join(tempDataDir, "final-delivery-runtime"),
      GRASSEYE_REAL_PLATFORM_URL: realPlatformUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function attachStreamCollector(stream) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
  });
  return () => buffer;
}

function matchesRunId(event, runId) {
  return event?.runId === runId || event?.traceId === runId || getRefValue(event?.refs, "runId") === runId;
}

async function waitForRuntimeLogEvidence(logsUrl, { runId, maxAttempts = 240, intervalMs = 500, serviceProcess } = {}) {
  let lastMatchCount = 0;
  let lastFailure = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (serviceProcess && serviceProcess.exitCode !== null) {
      throw new Error(`grasseye:start exited before runtime logs arrived with code ${serviceProcess.exitCode}.`);
    }

    try {
      const runtimeLogs = await fetchJson(logsUrl);
      const matchedLogs = Array.isArray(runtimeLogs) ? runtimeLogs.filter((event) => matchesRunId(event, runId)) : [];
      lastMatchCount = matchedLogs.length;
      lastFailure = null;
      if (matchedLogs.some((event) => ["COMMAND_ACCEPTED", "COMMAND_RESPONSE_SENT", "COMMAND_RECEIPT_TIMEOUT_AFTER_ACCEPTED", "AI_REQUEST_DEBUG", "AI_RESPONSE_DEBUG", "AI_ERROR_DEBUG"].includes(event.eventType))) {
        return matchedLogs;
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`acceptance:final-delivery runtime log evidence did not arrive in time; runId=${runId}; matchedLogs=${lastMatchCount}; lastFailure=${lastFailure ?? "none"}`);
}

function getRefValue(refs, key) {
  if (!Array.isArray(refs)) {
    return null;
  }
  const prefix = `${key}=`;
  const matched = refs.find((ref) => typeof ref === "string" && ref.startsWith(prefix));
  return matched ? matched.slice(prefix.length) : null;
}

function buildPhaseFiveBlockerFindings(runtimeLogs) {
  const findings = [];
  const aiRuntimeCalls = new Map();
  const acceptedIndicesByRun = new Map();
  const forensicsRequests = new Map();
  const forensicsTerminals = new Set();

  runtimeLogs.forEach((event, index) => {
    if (event.eventType === "COMMAND_ACCEPTED" && event.runId) {
      acceptedIndicesByRun.set(event.runId, index);
    }

    if (event.eventType === "COMMAND_REJECTED" && event.runId && acceptedIndicesByRun.has(event.runId)) {
      const acceptedIndex = acceptedIndicesByRun.get(event.runId);
      if (acceptedIndex < index) {
        findings.push(`run ${event.runId} emitted COMMAND_REJECTED after COMMAND_ACCEPTED.`);
      }
    }

    if (["AI_REQUEST_DEBUG", "AI_RESPONSE_DEBUG", "AI_ERROR_DEBUG"].includes(event.eventType) && event.runtimeCallId) {
      const record = aiRuntimeCalls.get(event.runtimeCallId) ?? { request: false, response: false, error: false, event };
      if (event.eventType === "AI_REQUEST_DEBUG") {
        record.request = true;
      }
      if (event.eventType === "AI_RESPONSE_DEBUG") {
        record.response = true;
      }
      if (event.eventType === "AI_ERROR_DEBUG") {
        record.error = true;
        if (!event.implementationStatus || !event.errorKind || !event.runtimeCallId || !(event.diagnosticPayloadRef || event.rawResponseRef || event.rawResponseHash)) {
          findings.push(`AI_ERROR_DEBUG for runtimeCallId=${event.runtimeCallId} is missing required diagnostic fields.`);
        }
      }
      aiRuntimeCalls.set(event.runtimeCallId, record);
    }

    if (event.abilityGroupId === "page-state") {
      for (const fieldName of ["sessionId", "runId", "stepId", "activationSnapshotRef", "capabilityCallId"]) {
        if (!event[fieldName]) {
          findings.push(`page-state event ${event.eventId} is missing ${fieldName}.`);
        }
      }
    }

    if (event.eventType === "FORENSICS_RECORD_WRITE_REQUESTED") {
      const idempotencyKey = getRefValue(event.refs, "idempotencyKey");
      const sourceEventId = getRefValue(event.refs, "sourceEventId");
      if (!idempotencyKey || !sourceEventId) {
        findings.push(`FORENSICS_RECORD_WRITE_REQUESTED ${event.eventId} is missing sourceEventId or idempotencyKey.`);
      } else {
        forensicsRequests.set(idempotencyKey, sourceEventId);
      }
    }

    if (["FORENSICS_RECORD_WRITTEN", "FORENSICS_RECORD_WRITE_REVIEW_REQUIRED"].includes(event.eventType)) {
      const idempotencyKey = getRefValue(event.refs, "idempotencyKey");
      const sourceEventId = getRefValue(event.refs, "sourceEventId");
      if (!idempotencyKey || !sourceEventId) {
        findings.push(`${event.eventType} ${event.eventId} is missing sourceEventId or idempotencyKey.`);
      } else {
        forensicsTerminals.add(idempotencyKey);
      }
    }
  });

  for (const [runtimeCallId, record] of aiRuntimeCalls.entries()) {
    if (record.request && !record.response && !record.error) {
      findings.push(`AI runtimeCallId=${runtimeCallId} has AI_REQUEST_DEBUG without AI_RESPONSE_DEBUG or AI_ERROR_DEBUG.`);
    }
  }

  for (const [idempotencyKey, sourceEventId] of forensicsRequests.entries()) {
    if (!forensicsTerminals.has(idempotencyKey)) {
      findings.push(`Forensics write closure missing terminal event for sourceEventId=${sourceEventId}.`);
    }
  }

  return findings;
}

async function stopStartupProcess(startupProcess) {
  if (startupProcess.exitCode !== null) {
    return;
  }
  startupProcess.kill("SIGINT");
  await new Promise((resolve) => {
    startupProcess.once("exit", resolve);
    setTimeout(resolve, 10000);
  });
}

async function main() {
  const repoRoot = process.cwd();
  const platformTarget = requireRealPlatformTarget();
  const realPlatformUrl = getRealPlatformUrl(platformTarget);
  const taskStartPayload = getTaskStartPayload(platformTarget);
  const tempDataDir = await mkdtemp(path.join(os.tmpdir(), "grasseye-final-delivery-"));
  const forbiddenTests = await scanForForbiddenTestFiles(repoRoot);
  assert(forbiddenTests.length === 0, `forbidden test files detected: ${forbiddenTests.join(", ")}`);

  const startupProcess = createStartupProcess({ repoRoot, tempDataDir, platformTarget, realPlatformUrl });
  const readStdout = attachStreamCollector(startupProcess.stdout);
  const readStderr = attachStreamCollector(startupProcess.stderr);

  try {
    const healthUrl = "http://127.0.0.1:4173/api/runtime/health";
    const snapshotUrl = "http://127.0.0.1:4173/api/runtime/snapshot";
    const startUrl = "http://127.0.0.1:4173/api/tasks/start";
    const logsUrl = "http://127.0.0.1:4173/api/runtime/logs?tail=1500";
    const actionsUrl = "http://127.0.0.1:4173/api/runtime/actions?tail=500";

    const health = await waitForHealth({ url: healthUrl, timeoutMs: 60000, intervalMs: 250, serviceProcess: startupProcess });
    const startResult = await fetchJson(startUrl, { method: "POST", body: JSON.stringify(taskStartPayload) });

    const runId = startResult.runtimeProof?.runId ?? null;
    assert(runId, "task-start dispatch must return runtimeProof.runId for final-delivery verification.");
    await waitForRuntimeLogEvidence(logsUrl, { runId, serviceProcess: startupProcess });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const snapshot = await fetchJson(snapshotUrl);
    const runtimeLogs = (await fetchJson(logsUrl)).filter((event) => matchesRunId(event, runId));
    const runtimeActions = await fetchJson(actionsUrl);
    const runnerSummary = JSON.parse(await readFile(path.join(repoRoot, "scripts", "audit", "generated", "runner-summary.json"), "utf8"));

    assert(health.kind === "app-shell-health", `runtime health must expose kind=app-shell-health, got ${String(health.kind)}`);
    assert(Array.isArray(health.components) && HEALTH_COMPONENT_NAMES.every((name) => health.components.some((component) => component?.name === name)), "runtime health must expose console, agent, browserController, and dataStore components.");
    assert(startResult.status === "success", `task-start dispatch must succeed, got ${String(startResult.status)}.`);
    assert(snapshot.browser?.dataMode === "Real Platform", "final-delivery runtime must stay in real-platform mode.");
    assert(snapshot.browser?.platformId === platformTarget, `final-delivery runtime must report platformId=${platformTarget}.`);
    assert(Array.isArray(runtimeLogs) && runtimeLogs.length > 0, "final-delivery runtime log tail is empty.");
    assert(Array.isArray(runtimeActions), "final-delivery runtime action tail must be readable.");
    assert(runnerSummary.phase === PHASE_FIVE, `runner-summary must report ${PHASE_FIVE}, got ${String(runnerSummary.phase)}`);

    const blockerFindings = buildPhaseFiveBlockerFindings(runtimeLogs);
    assert(blockerFindings.length === 0, `phase-five blocker scan failed:\n- ${blockerFindings.join("\n- ")}`);

    process.stdout.write("acceptance:final-delivery: PASS\n");
  } finally {
    await stopStartupProcess(startupProcess);
    await rm(tempDataDir, { recursive: true, force: true });
    const stderr = readStderr().trim();
    if (startupProcess.exitCode !== null && startupProcess.exitCode !== 0 && startupProcess.exitCode !== 130) {
      throw new Error(`grasseye:start exited abnormally: ${stderr || readStdout().trim() || "unknown error"}`);
    }
  }
}

await main();