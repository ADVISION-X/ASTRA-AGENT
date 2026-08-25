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
import { createTerminalStructuredLogger } from "./lib/terminal-structured-log.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const host = process.env.GRASSEYE_HOST ?? "127.0.0.1";
const port = Number(process.env.GRASSEYE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const expectedSourceFingerprint = buildStartupSourceFingerprint(rootDir);
const terminalLogger = createTerminalStructuredLogger();
const startupRunId = new Date().toISOString();
const {
  toFailureReason,
  logEvent,
  logPass,
  logFail,
  logStartupReady,
} = createStartupLogHelpers({ terminalLogger, runId: startupRunId, baseUrl });

async function ensureDependencies(root) {
  const startedAt = Date.now();
  logEvent("STARTUP", "bootstrap", "dependency_check", "started", "checking dependency readiness");
  const dependencyState = await assessDependencyState({
    rootDir: root,
  });

  logEvent("STARTUP", "bootstrap", "dependency_runtime", "detected", `node=${dependencyState.nodeVersion} npm=${dependencyState.npmVersion}`);

  if (dependencyState.requiresInstall) {
    throw new Error(`DEPENDENCY_STATE_NOT_READY: ${dependencyState.reasons.join(" | ")}. Run npm install explicitly, then restart.`);
  }

  logPass("STARTUP", "bootstrap", "dependency_check", "passed", "dependency readiness passed", {
    durationMs: Date.now() - startedAt,
  });
}

async function runUpdatePreflight(root, flags) {
  if (!flags.updateRequested) return;
  const startedAt = Date.now();
  logEvent("STARTUP", "bootstrap", "update_preflight_check", "started", "running controlled update preflight");
  const dependencyState = await assessDependencyState({ rootDir: root, updateRequested: true });
  if (!dependencyState.safeToUpdate) {
    throw new Error(`UPDATE_PREFLIGHT_FAILED: ${dependencyState.unsafeUpdateRanges.join(", ")}`);
  }

  logEvent("STARTUP", "bootstrap", "dependency_update", "started", "running controlled dependency refresh");
  await installDependencies({ rootDir: root, updateRequested: true });

  logPass("STARTUP", "bootstrap", "update_preflight_check", "passed", "update preflight passed", {
    durationMs: Date.now() - startedAt,
  });
}

async function clearWorkbenchPort() {
  const portStart = Date.now();
  logEvent("STARTUP", "bootstrap", "port_clear", "started", `clearing ${host}:${port}`);
  await clearPortListeners({
    host,
    port,
    rootDir,
    allowedCommandFragments: ["src/app/server.ts"],
    logger: (message) => logEvent("STARTUP", "bootstrap", "port_clear_detail", "event", message),
  });
  logPass("STARTUP", "bootstrap", "port_clear", "passed", `port ${host}:${port} is ready`, {
    durationMs: Date.now() - portStart,
  });
}

async function verifyBrowserRuntime() {
  const preflightStart = Date.now();
  logEvent(
    "STARTUP",
    "bootstrap",
    "browser_runtime_preflight",
    "started",
    "running read-only Browser Runtime preflight",
  );
  const result = await runBrowserRuntimePreflight();
  if (result.status !== "READY") {
    logFail(
      "STARTUP",
      "bootstrap",
      "browser_runtime_preflight",
      "failed",
      "Browser Runtime preflight blocked cold start",
      {
        failureReason: result.code,
        actionableMessage: result.actionableMessage,
        ...(result.missingEnvironmentVariables
          ? { refs: [`missingEnvironmentVariables=${result.missingEnvironmentVariables.join(",")}`] }
          : {}),
        durationMs: Date.now() - preflightStart,
      },
    );
    throw new Error(`${result.code}: ${result.actionableMessage}`);
  }
  logPass(
    "STARTUP",
    "bootstrap",
    "browser_runtime_preflight",
    "passed",
    "read-only Browser Runtime preflight passed",
    {
      durationMs: Date.now() - preflightStart,
      refs: [`runtimeMode=${process.env.GRASSEYE_BROWSER_RUNTIME_MODE?.trim() || "production"}`],
    },
  );
}

async function prepareBrowserRuntimeArtifact(root) {
  const startedAt = Date.now();
  logEvent("STARTUP", "bootstrap", "browser_artifact_sync", "started", "checking the fixed Browser extension artifact against current governed sources");
  const result = await ensureCurrentBrowserRuntimeArtifact({ rootDir: root });
  if (result.rebuilt) {
    logPass("STARTUP", "bootstrap", "browser_artifact_sync", "passed", "rebuilt the stale fixed extension artifact; the installed unpacked extension will reload after the Workbench publishes the new build identity", {
      durationMs: Date.now() - startedAt,
    });
    return;
  }
  logPass("STARTUP", "bootstrap", "browser_artifact_sync", "passed", "the fixed extension artifact already matches current governed sources", {
    durationMs: Date.now() - startedAt,
  });
}

async function startService(root) {
  const serviceStart = Date.now();
  logEvent("SERVICE", "app_server", "app_server", "starting", `starting local app shell on ${baseUrl}`);
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
    onStdoutLine: (line, scriptName) => terminalLogger.relayServiceStdoutLine(line, scriptName),
    onStderrLine: (line, scriptName) => terminalLogger.relayServiceStderrLine(line, scriptName),
  });
  logPass("SERVICE", "app_server", "app_server", "ready", `local app shell process started for ${baseUrl}`, {
    durationMs: Date.now() - serviceStart,
  });
  return serviceHandle;
}

async function verifyAppHealth() {
  await waitForWorkbenchHealth({
    baseUrl,
    toFailureReason,
    expectedSourceFingerprint,
    onStarted: ({ healthUrl }) => {
      logEvent("APP", "app_shell", "APP_SHELL_HEALTH_CHECK_STARTED", "started", `probing local workbench health at ${healthUrl}`);
    },
    onPassed: ({ healthUrl, contentType, status, attempt, durationMs }) => {
      if (status === "degraded") {
        logEvent(
          "APP",
          "app_shell",
          "APP_SHELL_DIAGNOSTIC_READY",
          "degraded",
          `local diagnostic shell is ready at ${healthUrl}; execution dependencies remain blocked`,
          {
            refs: [`healthUrl=${healthUrl}`, `contentType=${contentType}`, `healthStatus=${status}`, `attempt=${attempt}`],
            durationMs,
          },
        );
        return;
      }
      logPass("APP", "app_shell", "APP_SHELL_HEALTH_PASSED", "passed", `local workbench health passed at ${healthUrl}`, {
        refs: [`healthUrl=${healthUrl}`, `contentType=${contentType}`, `healthStatus=${status}`, `attempt=${attempt}`],
        durationMs,
      });
    },
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
    logEvent("SERVICE", "app_server", "SERVICE_STOP_REQUESTED", "started", `stopping local service with ${signal}`);
    if (state.serviceHandle) {
      await stopLocalService(state.serviceHandle.child, signal);
    }
    logPass("SERVICE", "app_server", "SERVICE_SHUTDOWN_COMPLETED", "passed", `local service stopped with ${signal}`);
  };
}

function classifyServiceExit(exit, shuttingDown) {
  if (!isControlledServiceExit(exit, shuttingDown)) {
    const failureReason = toExitFailureReason(exit);
    logFail("SERVICE", "app_server", "SERVICE_UNEXPECTED_EXIT", "failed", "local service exited unexpectedly", {
      failureReason,
    });
    logFail("SERVICE", "app_server", "SERVICE_EXIT_CLASSIFICATION", "failed", "classified local service exit", {
      failureReason,
    });
    process.exitCode = exit.code ?? 1;
    return;
  }
  if (!shuttingDown) {
    logPass("SERVICE", "app_server", "SERVICE_EXIT_CLASSIFICATION", "passed", "classified local service exit as controlled shutdown", {
      refs: [exit.signal ? `signal=${exit.signal}` : `code=${exit.code ?? "unknown"}`],
    });
  }
}

async function performLaunch(flags, root, onServiceStarted) {
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
    logEvent("APP", "local_workbench", "open_workbench", "skipped", `automatic open skipped; workbench url=${baseUrl}`);
    return;
  }

  const log = (message) => {
    terminalLogger.event({
      phase: "APP",
      component: "local_workbench",
      eventType: "open_workbench_detail",
      status: "event",
      message,
    });
  };

  try {
    const openResult = await openWorkbenchPage(baseUrl);
    log(`Opened ${baseUrl} in ${openResult.browserName} (${openResult.browserPath})`);
    logPass("APP", "local_workbench", "open_workbench", "passed", `opened local workbench via ${openResult.browserName}`, {
      refs: [`browserPath=${openResult.browserPath}`],
    });
  } catch (error) {
    logFail("APP", "local_workbench", "open_workbench", "failed", `automatic open failed; open ${baseUrl} manually`, {
      failureReason: toFailureReason(error),
    });
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
    await handleStartupBootstrapFailure({ rootDir, runId: startupRunId, baseUrl, failureReason: toFailureReason(error), logFail, shutdown });
  }
}

await main();
