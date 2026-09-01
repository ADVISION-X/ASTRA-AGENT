import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assessDependencyState,
  installDependencies,
} from "./lib/dependency-check.mjs";
import { openWorkbenchPage } from "./lib/open-workbench-page.mjs";
import { clearPortListeners } from "./lib/process-control.mjs";
import { startLocalService, stopLocalService } from "./lib/service-process.mjs";
import { waitForWorkbenchHealth } from "./lib/service-readiness.mjs";
import { buildStartupSourceFingerprint } from "./lib/source-fingerprint.mjs";
import { runBrowserRuntimePreflight } from "./lib/browser-runtime-preflight.mjs";
import { ensureCurrentBrowserRuntimeArtifact } from "./lib/browser-runtime-artifact.mjs";
import { handleStartupBootstrapFailure } from "./lib/startup-failure-handler.mjs";
import { createStartupLogHelpers } from "./lib/startup-log-helpers.mjs";
import { parseFlags, registerSignalHandlers } from "./lib/startup-main-support.mjs";
import {
  productionContractProjectionPaths,
  verifyProductionContractProjection,
} from "./lib/production-contract-preflight.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const host = process.env.GRASSEYE_HOST ?? "127.0.0.1";
const port = Number(process.env.GRASSEYE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const expectedSourceFingerprint = buildStartupSourceFingerprint(rootDir);
const startupRunId = new Date().toISOString();
const startupDataDir = process.env.GRASSEYE_DATA_DIR ?? path.join(rootDir, ".grasseye-local");
const websiteRootDir = path.resolve(
  process.env.XUANSHU_WEBSITE_REPOSITORY_ROOT?.trim() || path.join(rootDir, "..", "xuanxue-web"),
);
const {
  toFailureReason,
  startStartupStep,
  completeStartupStep,
  failOpenStartupSteps,
  failStartupStep,
  logStartupReady,
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
  await verifyProductionContractProjection(productionContractProjectionPaths({
    agentRoot: root,
    websiteRoot: websiteRootDir,
  }));
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

async function startService(root) {
  startStartupStep("app_server");
  const serviceHandle = await startLocalService({
    rootDir: root,
    preStartScripts: [],
    scriptName: "internal:app-server:dev",
    env: {
      GRASSEYE_LOG_MODE: "TRACE",
      GRASSEYE_HOST: host,
      GRASSEYE_PORT: String(port),
      GRASSEYE_SOURCE_FINGERPRINT: expectedSourceFingerprint,
    },
    onStdoutLine: relayServiceStdoutLine,
    onStderrLine: relayServiceStderrLine,
  });
  completeStartupStep("app_server");
  return serviceHandle;
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

function isControlledServiceExit(exit, shuttingDown) {
  return shuttingDown || exit.signal === "SIGTERM" || exit.code === 143;
}

function toExitFailureReason(exit) {
  return exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? "unknown"}`;
}

function createShutdownHandler(state) {
  return async function shutdown(signal) {
    if (state.shuttingDown) {
      return;
    }
    state.shuttingDown = true;
    startStartupStep("service_shutdown");
    if (state.serviceHandle) {
      await stopLocalService(state.serviceHandle.child, signal);
    }
    completeStartupStep("service_shutdown");
  };
}

function classifyServiceExit(exit, shuttingDown) {
  if (!isControlledServiceExit(exit, shuttingDown)) {
    const failureReason = toExitFailureReason(exit);
    failStartupStep("service_exit", new Error(failureReason));
    process.exitCode = exit.code ?? 1;
    return;
  }
  if (!shuttingDown) {
    completeStartupStep("service_exit");
  }
}

async function performLaunch(flags, root, onServiceStarted) {
  await verifyProductionContract(root);
  await ensureDependencies(root);
  await runUpdatePreflight(root, flags);
  await clearWorkbenchPort();
  await prepareBrowserRuntimeArtifact(root);
  await verifyBrowserRuntime();
  const serviceHandle = await startService(root);
  onServiceStarted(serviceHandle);
  await verifyAppHealth();
  await openReadyPage(flags);
  logStartupReady();
  return serviceHandle;
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

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const state = { serviceHandle: undefined, shuttingDown: false };
  const shutdown = createShutdownHandler(state);

  registerSignalHandlers(shutdown);

  try {
    state.serviceHandle = await performLaunch(flags, rootDir, (serviceHandle) => {
      state.serviceHandle = serviceHandle;
    });
    if (!state.serviceHandle) {
      return;
    }
    const exit = await state.serviceHandle.waitForExit();
    classifyServiceExit(exit, state.shuttingDown);
    return;
  } catch (error) {
    await handleStartupBootstrapFailure({
      rootDir, runId: startupRunId, baseUrl, failureReason: toFailureReason(error),
      failOpenStartupSteps, failStartupStep, shutdown,
    });
  }
}

await main();
logStartupStopped();
