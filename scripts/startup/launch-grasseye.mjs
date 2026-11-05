import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASTRA_LOCAL_HOST, ASTRA_LOCAL_PORT } from "../../src/lib/browser/profile/browser-application-identity.ts";
import { resolveProductionLocalDataDir } from "../../src/lib/local-runtime/default-data-dir.ts";

import {
  assessDependencyState,
  installDependencies,
} from "./lib/dependency-check.mjs";
import { openWorkbenchPage } from "./lib/open-workbench-page.mjs";
import { clearPortListeners } from "./lib/process-control.mjs";
import { startLocalService } from "./lib/service-process.mjs";
import { waitForWorkbenchHealth } from "./lib/service-readiness.mjs";
import { buildStartupSourceFingerprint } from "./lib/source-fingerprint.mjs";
import { runBrowserRuntimePreflight } from "./lib/browser-runtime-preflight.mjs";
import { ensureCurrentBrowserRuntimeArtifact } from "./lib/browser-runtime-artifact.mjs";
import { handleStartupBootstrapFailure } from "./lib/startup-failure-handler.mjs";
import { createStartupLogHelpers } from "./lib/startup-log-helpers.mjs";
import { parseFlags, registerSignalHandlers } from "./lib/startup-main-support.mjs";
import {
  productionDependencyPath,
  verifyProductionDependency,
} from "./lib/production-contract-preflight.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const host = process.env.GRASSEYE_HOST ?? ASTRA_LOCAL_HOST;
const port = Number(process.env.GRASSEYE_PORT ?? ASTRA_LOCAL_PORT);
if (host !== ASTRA_LOCAL_HOST || port !== ASTRA_LOCAL_PORT) throw new Error("ASTRA_LOCAL_IDENTITY_MISMATCH: use 127.0.0.1:4174 in this repository's .env.local");
const baseUrl = `http://${host}:${port}`;
const startupDataDir = resolveProductionLocalDataDir();
if (path.dirname(startupDataDir) !== rootDir) throw new Error("ASTRA_REPOSITORY_MISMATCH");
const expectedSourceFingerprint = buildStartupSourceFingerprint(rootDir);
const startupRunId = new Date().toISOString();
const {
  toFailureReason,
  startStartupStep,
  completeStartupStep,
  failOpenStartupSteps,
  failStartupStep,
  logStartupShellReady,
  logStartupStopped,
  relayServiceStdoutLine,
  relayServiceStderrLine,
} = createStartupLogHelpers({ runId: startupRunId, dataDir: startupDataDir });

async function ensureDependencies(root) {
  const startedAt = Date.now();
  startStartupStep("dependency_check");
  const dependencyState = await assessDependencyState({
    rootDir: root,
  });

  completeStartupStep("dependency_runtime");

  if (dependencyState.requiresInstall) {
    throw new Error(`DEPENDENCY_STATE_NOT_READY: ${dependencyState.reasons.join(" | ")}. Run npm install explicitly, then restart.`);
  }

  completeStartupStep("dependency_check");
}

async function verifyProductionContract(root) {
  startStartupStep("production_contract_preflight");
  await verifyProductionDependency({ agentDependencyPath: productionDependencyPath({ agentRoot: root }) });
  completeStartupStep("production_contract_preflight");
}

async function runUpdatePreflight(root, flags) {
  if (!flags.updateRequested) return;
  const startedAt = Date.now();
  startStartupStep("update_preflight_check");
  const dependencyState = await assessDependencyState({ rootDir: root, updateRequested: true });
  if (!dependencyState.safeToUpdate) {
    throw new Error(`UPDATE_PREFLIGHT_FAILED: ${dependencyState.unsafeUpdateRanges.join(", ")}`);
  }

  startStartupStep("dependency_update");
  await installDependencies({ rootDir: root, updateRequested: true });

  completeStartupStep("dependency_update");
  completeStartupStep("update_preflight_check");
}

async function clearWorkbenchPort() {
  const portStart = Date.now();
  startStartupStep("port_clear");
  await clearPortListeners({
    host,
    port,
    rootDir,
    allowedCommandFragments: ["src/app/server.ts"],
    logger: () => completeStartupStep("port_clear_detail"),
  });
  completeStartupStep("port_clear");
}

async function verifyBrowserRuntime() {
  startStartupStep("browser_runtime_preflight");
  const result = await runBrowserRuntimePreflight();
  if (result.status !== "READY") {
    failStartupStep("browser_runtime_preflight", new Error(result.code));
    throw new Error(`${result.code}: ${result.actionableMessage}`);
  }
  completeStartupStep("browser_runtime_preflight");
}

async function prepareBrowserRuntimeArtifact(root) {
  startStartupStep("browser_artifact_sync");
  const result = await ensureCurrentBrowserRuntimeArtifact({ rootDir: root });
  if (result.rebuilt !== true && result.rebuilt !== false) throw new Error("BROWSER_ARTIFACT_RESULT_INVALID");
  completeStartupStep("browser_artifact_sync");
}

async function verifyAppHealth() {
  await waitForWorkbenchHealth({
    baseUrl,
    toFailureReason,
    expectedSourceFingerprint,
    onStarted: () => startStartupStep("health_check"),
    onPassed: () => completeStartupStep("health_check"),
  });
}

async function openReadyPage(flags) {
  if (flags.skipOpen) {
    completeStartupStep("open_workbench");
    return;
  }

  const log = () => completeStartupStep("open_workbench_detail");

  try {
    const openResult = await openWorkbenchPage(baseUrl);
    log(`Opened ${baseUrl} in ${openResult.browserName} (${openResult.browserPath})`);
    if (!openResult.browserName || !openResult.browserPath) throw new Error("WORKBENCH_OPEN_RESULT_INVALID");
    completeStartupStep("open_workbench");
  } catch (error) {
    failStartupStep("open_workbench", error);
  }
}

function startService(root) {
  startStartupStep("app_server");
  return startLocalService({
    rootDir: root,
    env: { GRASSEYE_LOG_MODE: "TRACE", GRASSEYE_HOST: host, GRASSEYE_PORT: String(port), GRASSEYE_DATA_DIR: startupDataDir,
      GRASSEYE_SOURCE_FINGERPRINT: expectedSourceFingerprint },
    onStdoutLine: relayServiceStdoutLine, onStderrLine: relayServiceStderrLine,
  });
}

function classifyServiceExit(exit) {
  if (exit.code === 0 && exit.signal === null) {
    completeStartupStep("service_exit");
    return;
  }
  failStartupStep("service_exit", new Error(`SERVICE_EXIT_INCOMPLETE:${exit.signal ?? exit.code ?? "unknown"}`));
  process.exitCode = exit.code && exit.code > 0 ? exit.code : 1;
}

function createShutdownHandler(state) {
  return signal => {
    state.shuttingDown = true;
    state.signal ??= signal;
    if (!state.serviceHandle) return Promise.resolve();
    state.closing ??= state.serviceHandle.stop(state.signal).then(exit => {
      classifyServiceExit(exit);
      if (exit.code === 0 && exit.signal === null) completeStartupStep("service_shutdown");
      else failStartupStep("service_shutdown", new Error("SERVICE_SHUTDOWN_INCOMPLETE"));
    });
    return state.closing;
  };
}

async function performLaunch(flags, root, state, shutdown) {
  const stages = [() => verifyProductionContract(root), () => ensureDependencies(root),
    () => runUpdatePreflight(root, flags), clearWorkbenchPort,
    () => prepareBrowserRuntimeArtifact(root), verifyBrowserRuntime];
  for (const stage of stages) {
    if (state.shuttingDown) return;
    await stage();
  }
  if (state.shuttingDown) return;
  state.serviceHandle = startService(root);
  await state.serviceHandle.started;
  completeStartupStep("app_server");
  if (state.shuttingDown) { await shutdown(state.signal); return; }
  await verifyAppHealth();
  if (state.shuttingDown) return;
  await openReadyPage(flags);
  if (!state.shuttingDown) logStartupShellReady();
}

async function main() {
  const state = { serviceHandle: undefined, shuttingDown: false, closing: undefined, signal: undefined };
  const shutdown = createShutdownHandler(state);
  registerSignalHandlers(shutdown);
  try {
    await performLaunch(parseFlags(process.argv.slice(2)), rootDir, state, shutdown);
    if (state.serviceHandle) {
      const exit = await state.serviceHandle.waitForExit();
      if (state.closing) await state.closing;
      else classifyServiceExit(exit);
    }
  } catch (error) {
    if (state.shuttingDown) {
      await shutdown(state.signal);
      failOpenStartupSteps(new Error("STARTUP_STOP_REQUESTED"));
      if (!process.exitCode) logStartupStopped();
      return;
    }
    await handleStartupBootstrapFailure({ rootDir, runId: startupRunId, baseUrl,
      failureReason: toFailureReason(error), failOpenStartupSteps, failStartupStep, shutdown });
  }
  if (!process.exitCode) logStartupStopped();
}

await main();
