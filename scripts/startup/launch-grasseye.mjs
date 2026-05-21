import path from "node:path";
import { fileURLToPath } from "node:url";

import { assessDependencyState, installDependencies } from "./lib/dependency-check.mjs";
import { ensureStartupRegistryReadiness } from "./lib/startup-registry-readiness.mjs";
import { openWorkbenchPage } from "./lib/open-workbench-page.mjs";
import { clearPortListeners, startLocalService, stopLocalService } from "./lib/process-control.mjs";
import { handleStartupBootstrapFailure } from "./lib/startup-failure-handler.mjs";
import { createStartupLogHelpers } from "./lib/startup-log-helpers.mjs";
import { parseFlags, registerSignalHandlers } from "./lib/startup-main-support.mjs";
import { createTerminalStructuredLogger } from "./lib/terminal-structured-log.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const host = process.env.GRASSEYE_HOST ?? "127.0.0.1";
const port = Number(process.env.GRASSEYE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const terminalLogger = createTerminalStructuredLogger();
const startupRunId = new Date().toISOString();
const {
  toFailureReason,
  logEvent,
  logPass,
  logFail,
  logMissionReadinessStarted,
  logMissionReadinessPassed,
  logMissionReadinessDegraded,
  markMissionRuntimeAvailable,
  logStartupReady,
} = createStartupLogHelpers({ terminalLogger, runId: startupRunId, baseUrl });

async function ensureDependencies(root, flags) {
  const startedAt = Date.now();
  logEvent("STARTUP", "bootstrap", "dependency_check", "started", "checking dependency readiness");
  const dependencyState = await assessDependencyState({
    rootDir: root,
    updateRequested: flags.updateRequested,
  });

  logEvent("STARTUP", "bootstrap", "dependency_runtime", "detected", `node=${dependencyState.nodeVersion} npm=${dependencyState.npmVersion}`);

  if (dependencyState.requiresInstall) {
    logEvent("STARTUP", "bootstrap", "dependency_install", "started", "dependency state requires repair", {
      refs: dependencyState.reasons,
    });
    await installDependencies({ rootDir: root });
  }

  const finalState = await assessDependencyState({ rootDir: root });
  if (finalState.requiresInstall) {
    throw new Error(`Dependency state is still not ready after repair: ${finalState.reasons.join(" ")}`);
  }

  logPass("STARTUP", "bootstrap", "dependency_check", "passed", "dependency readiness passed", {
    durationMs: Date.now() - startedAt,
  });
}

async function runUpdatePreflight(root, flags) {
  const startedAt = Date.now();
  logEvent("STARTUP", "bootstrap", "update_preflight_check", "started", flags.updateRequested ? "running controlled update preflight" : "no controlled update requested; validating update preflight");

  if (flags.updateRequested) {
    const dependencyState = await assessDependencyState({ rootDir: root, updateRequested: true });
    if (!dependencyState.safeToUpdate) {
      throw new Error(`UPDATE_PREFLIGHT_FAILED: ${dependencyState.unsafeUpdateRanges.join(", ")}`);
    }

    logEvent("STARTUP", "bootstrap", "dependency_update", "started", "running controlled dependency refresh");
    await installDependencies({ rootDir: root, updateRequested: true });
  }

  logPass("STARTUP", "bootstrap", "update_preflight_check", "passed", "update preflight passed", {
    durationMs: Date.now() - startedAt,
  });
}

async function preparePort() {
  const portStart = Date.now();
  logEvent("STARTUP", "bootstrap", "port_clear", "started", `clearing ${host}:${port}`);
  await clearPortListeners({
    host,
    port,
    logger: (message) => logEvent("STARTUP", "bootstrap", "port_clear_detail", "event", message),
  });
  logPass("STARTUP", "bootstrap", "port_clear", "passed", `port ${host}:${port} is ready`, {
    durationMs: Date.now() - portStart,
  });
}

async function startService(root, aiReadiness) {
  const serviceStart = Date.now();
  logEvent("SERVICE", "app_server", "app_server", "starting", `starting local app shell on ${baseUrl}`);
  const serviceHandle = await startLocalService({
    rootDir: root,
    preStartScripts: [],
    scriptName: "internal:app-server:dev",
    env: {
      GRASSEYE_LOG_MODE: "TRACE",
      GRASSEYE_STARTUP_ONLINE_AI_READINESS_JSON: JSON.stringify(aiReadiness),
    },
    onStdoutLine: (line, scriptName) => terminalLogger.relayServiceStdoutLine(line, scriptName),
    onStderrLine: (line, scriptName) => terminalLogger.relayServiceStderrLine(line, scriptName),
  });
  logPass("SERVICE", "app_server", "app_server", "ready", `local app shell process started for ${baseUrl}`, {
    durationMs: Date.now() - serviceStart,
  });
  return serviceHandle;
}

async function verifyAppHealth(serviceHandle) {
  const healthStart = Date.now();
  logEvent("APP", "app_shell", "APP_SHELL_HEALTH_CHECK_STARTED", "started", `probing Amazon upload workbench at ${baseUrl}`);
  const response = await fetch(baseUrl);
  if (!response.ok) {
    throw new Error(`Amazon upload workbench returned HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "unknown";
  logPass("APP", "app_shell", "APP_SHELL_HEALTH_PASSED", "passed", `Amazon upload workbench reachable at ${baseUrl}`, {
    refs: [`contentType=${contentType}`],
    durationMs: Date.now() - healthStart,
  });
}

async function ensureOnlineAiReadiness() {
  const readiness = {
    component: "online-ai-runtime",
    status: "ready",
    runtimeBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    detail: "Online Gemini API runtime is selected; API key is validated by mission preflight/settings.",
    modelRoles: [{ modelRole: "vision", health: "configured", modelName: "gemini-2.5-flash-lite" }],
    missionRuntimeAvailable: true,
    failureReason: null,
    developmentOnly: false,
    checkedAt: new Date().toISOString(),
  };
  logPass("AI", "online_ai_runtime", "online_ai_runtime_selected", "passed", readiness.detail, {
    refs: readiness.modelRoles.map((role) => `${role.modelRole}=${role.health}:${role.modelName}`),
  });
  return readiness;
}

async function ensureStartupRegistryReadinessGate() {
  const startedAt = Date.now();
  logEvent("STARTUP", "job_flow", "job_flow_check", "started", "checking Amazon job-flow readiness");
  const readiness = await ensureStartupRegistryReadiness({
    logger: (message) => logEvent("STARTUP", "registry_readiness", "registry_readiness_detail", "event", message),
  });
  const refs = Array.isArray(readiness.refs) ? readiness.refs : [];
  const extra = {
    refs,
    durationMs: Date.now() - startedAt,
    ownerResponsible: readiness.ownerResponsible,
    actionableMessage: readiness.actionableMessage ?? undefined,
    failureReason: readiness.failureReason ?? undefined,
  };

  if (readiness.status !== "ready") {
    logFail("STARTUP", "job_flow", "job_flow_check", "failed", "Amazon job-flow readiness failed before app shell start", extra);
    throw new Error(`${readiness.failureReason ?? "STARTUP_REGISTRY_READINESS_FAILED"} actionableMessage=${readiness.actionableMessage ?? "Fix startup registry readiness."}`);
  }

  logPass("STARTUP", "job_flow", "job_flow_check", "passed", "Amazon job-flow readiness passed", extra);
  return readiness;
}

function isControlledServiceExit(exit, shuttingDown) {
  return shuttingDown || exit.signal === "SIGTERM" || exit.code === 143;
}

async function performLaunch(flags, root) {
  await ensureDependencies(root, flags);
  await runUpdatePreflight(root, flags);
  logMissionReadinessStarted();

  // Registry readiness is a hard gate — throw on failure.
  try {
    await ensureStartupRegistryReadinessGate();
  } catch (error) {
    logMissionReadinessDegraded(toFailureReason(error));
    throw error;
  }

  const aiReadiness = await ensureOnlineAiReadiness();
  logMissionReadinessPassed(aiReadiness);

  await preparePort();
  const serviceHandle = await startService(root, aiReadiness);
  await verifyAppHealth(serviceHandle);
  await openReadyPage(flags);
  markMissionRuntimeAvailable(aiReadiness);
  logStartupReady();
  return serviceHandle;
}

async function openReadyPage(flags) {
  if (flags.skipOpen) {
    logEvent("APP", "amazon_upload_workbench", "open_workbench", "skipped", `automatic open skipped; workbench url=${baseUrl}`);
    return;
  }

  const log = (message) => {
    terminalLogger.event({
      phase: "APP",
      component: "amazon_upload_workbench",
      eventType: "open_workbench_detail",
      status: "event",
      message,
    });
  };

  try {
    const openResult = await openWorkbenchPage(baseUrl);
    log(`Opened ${baseUrl} in ${openResult.browserName} (${openResult.browserPath})`);
    logPass("APP", "amazon_upload_workbench", "open_workbench", "passed", `opened Amazon upload workbench via ${openResult.browserName}`, {
      refs: [`browserPath=${openResult.browserPath}`],
    });
  } catch (error) {
    logFail("APP", "amazon_upload_workbench", "open_workbench", "failed", `automatic open failed; open ${baseUrl} manually`, {
      failureReason: toFailureReason(error),
    });
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  let serviceHandle;
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logEvent("SERVICE", "app_server", "SERVICE_STOP_REQUESTED", "started", `stopping local service with ${signal}`);
    if (serviceHandle) {
      await stopLocalService(serviceHandle.child, signal);
    }
    logPass("SERVICE", "app_server", "SERVICE_SHUTDOWN_COMPLETED", "passed", `local service stopped with ${signal}`);
  };

  registerSignalHandlers(shutdown);

  try {
    serviceHandle = await performLaunch(flags, rootDir);
    const exit = await serviceHandle.waitForExit();
    if (!isControlledServiceExit(exit, shuttingDown)) {
      logFail("SERVICE", "app_server", "SERVICE_UNEXPECTED_EXIT", "failed", "local service exited unexpectedly", {
        failureReason: exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? "unknown"}`,
      });
      logFail("SERVICE", "app_server", "SERVICE_EXIT_CLASSIFICATION", "failed", "classified local service exit", {
        failureReason: exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? "unknown"}`,
      });
      process.exitCode = exit.code ?? 1;
    } else if (!shuttingDown) {
      logPass("SERVICE", "app_server", "SERVICE_EXIT_CLASSIFICATION", "passed", "classified local service exit as controlled shutdown", {
        refs: [exit.signal ? `signal=${exit.signal}` : `code=${exit.code ?? "unknown"}`],
      });
    }
    return;
  } catch (error) {
    await handleStartupBootstrapFailure({ rootDir, runId: startupRunId, baseUrl, failureReason: toFailureReason(error), logFail, shutdown });
  }
}

await main();
