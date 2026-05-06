import path from "node:path";
import { fileURLToPath } from "node:url";

import { assessDependencyState, installDependencies } from "./lib/dependency-check.mjs";
import { probeCommanderConsolePage, waitForHealth } from "./lib/health-check.mjs";
import { ensureLocalAiRuntimeReady } from "./lib/local-ai-runtime-readiness.mjs";
import { ensureMapPackageReadiness } from "./lib/map-package-readiness.mjs";
import { openCommanderConsole } from "./lib/open-commander-console.mjs";
import { clearPortListeners, startLocalService, stopLocalService } from "./lib/process-control.mjs";
import { handleStartupBootstrapFailure } from "./lib/startup-failure-handler.mjs";
import { parseFlags, registerSignalHandlers } from "./lib/startup-main-support.mjs";
import { createTerminalStructuredLogger } from "./lib/terminal-structured-log.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const host = process.env.GRASSEYE_HOST ?? "127.0.0.1";
const port = Number(process.env.GRASSEYE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const healthUrl = `${baseUrl}/api/runtime/health`;
const terminalLogger = createTerminalStructuredLogger();
const startupRunId = new Date().toISOString();

function toFailureReason(error) {
  return error instanceof Error ? error.message : String(error);
}

function logEvent(...[phase, component, eventType, status, message, extra = {}]) {
  terminalLogger.event({ phase, component, eventType, status, message, runId: startupRunId, ...extra });
}

function logPass(...[phase, component, eventType, status, message, extra = {}]) {
  terminalLogger.pass({ phase, component, eventType, status, message, runId: startupRunId, ...extra });
}

function logFail(...[phase, component, eventType, status, message, extra = {}]) {
  terminalLogger.fail({ phase, component, eventType, status, message, runId: startupRunId, ...extra });
}

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

async function startService(root, localAiReadiness) {
  const serviceStart = Date.now();
  logEvent("SERVICE", "app_server", "app_server", "starting", `starting local app shell on ${baseUrl}`);
  const serviceHandle = await startLocalService({
    rootDir: root,
    preStartScripts: [],
    scriptName: "internal:app-server:dev",
    env: {
      GRASSEYE_STARTUP_LOCAL_AI_READINESS_JSON: JSON.stringify(localAiReadiness),
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
  logEvent("APP", "app_shell", "APP_SHELL_HEALTH_CHECK_STARTED", "started", `waiting for health at ${healthUrl}`);
  const healthReport = await waitForHealth({ url: healthUrl, serviceProcess: serviceHandle.child });
  const pageReport = await probeCommanderConsolePage({ url: baseUrl });
  logPass("APP", "app_shell", "APP_SHELL_HEALTH_PASSED", "passed", `Commander Console reachable at ${baseUrl}`, {
    refs: [`components=${Array.isArray(healthReport.components) ? healthReport.components.length : 0}`, `contentType=${pageReport.contentType}`],
    durationMs: Date.now() - healthStart,
  });
}

function logLocalAiPhase(eventType, passed, message, extra = {}) {
  const log = passed ? logPass : logFail;
  log("AI", "local_ai_runtime", eventType, passed ? "passed" : "failed", message, extra);
}

function isRuntimeFailureReason(reason) {
  return reason === "LOCAL_AI_RUNTIME_NOT_FOUND" || reason === "LOCAL_AI_RUNTIME_START_FAILED" || reason === "LOCAL_AI_READINESS_TIMEOUT";
}

function getLocalAiRefs(readiness) {
  return readiness.modelRoles.map((role) => `${role.modelRole}=${role.health}:${role.modelName}`);
}

async function ensureLocalAiReadiness() {
  const startedAt = Date.now();
  logEvent("AI", "local_ai_runtime", "local_ai_runtime_presence_check", "started", "checking local AI runtime presence");
  logEvent("AI", "local_ai_runtime", "local_ai_model_roster_check", "started", "checking required local AI model roster");
  logEvent("AI", "local_ai_runtime", "local_ai_start_or_connect", "started", "starting or connecting governed local AI runtime");
  logEvent("AI", "local_ai_runtime", "local_ai_health_probe", "started", "probing governed local AI readiness");

  const readiness = await ensureLocalAiRuntimeReady({
    logger: (message) => logEvent("AI", "local_ai_runtime", "local_ai_start_or_connect_detail", "event", message),
  });
  const refs = getLocalAiRefs(readiness);
  const runtimePassed = !isRuntimeFailureReason(readiness.failureReason);
  const rosterPassed = readiness.failureReason !== "LOCAL_AI_MODEL_MISSING";
  const gatePassed = readiness.missionRuntimeAvailable;
  const extra = { refs, durationMs: Date.now() - startedAt, failureReason: readiness.failureReason ?? undefined };

  logLocalAiPhase("local_ai_runtime_presence_check", runtimePassed, runtimePassed ? "local AI runtime presence passed" : readiness.detail, extra);
  logLocalAiPhase("local_ai_model_roster_check", rosterPassed, rosterPassed ? "local AI model roster check passed" : readiness.detail, extra);
  logLocalAiPhase("local_ai_start_or_connect", runtimePassed, runtimePassed ? "local AI start/connect passed" : readiness.detail, extra);
  logLocalAiPhase("local_ai_health_probe", gatePassed, gatePassed ? "local AI health probe passed" : readiness.detail, extra);
  logLocalAiPhase("ai_capability_readiness_gate", gatePassed, gatePassed ? "AI capability readiness gate passed" : readiness.detail, extra);

  if (!gatePassed) {
    throw new Error(`${readiness.failureReason ?? "LOCAL_AI_NOT_READY"}: ${readiness.detail}`);
  }

  return readiness;
}

async function ensureStartupMapPackageReadiness() {
  const startedAt = Date.now();
  logEvent("MAP_PACKAGE", "map_package_readiness", "map_package_readiness_check", "started", "checking governed builtin map package readiness");
  const readiness = await ensureMapPackageReadiness({
    logger: (message) => logEvent("MAP_PACKAGE", "map_package_readiness", "map_package_readiness_detail", "event", message),
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
    logFail("MAP_PACKAGE", "map_package_readiness", "map_package_readiness_check", "failed", "map package readiness failed before app shell start", extra);
    throw new Error(`${readiness.failureReason ?? "MAP_PACKAGE_READINESS_FAILED"} actionableMessage=${readiness.actionableMessage ?? "Fix map package readiness."}`);
  }

  logPass("MAP_PACKAGE", "map_package_readiness", "map_package_readiness_check", "passed", "map package readiness passed before app shell start", extra);
  return readiness;
}

function logMissionReadinessStarted() {
  logEvent("MISSION", "mission_readiness", "MISSION_READINESS_CHECK_STARTED", "started", "checking startup mission readiness after map and local AI gates");
}

function logMissionReadinessPassed(readiness) {
  logPass("MISSION", "mission_readiness", "MISSION_READINESS_PASSED", "passed", "startup mission readiness gates passed", {
    refs: getLocalAiRefs(readiness),
  });
}

function logMissionReadinessDegraded(reason) {
  logFail("MISSION", "mission_readiness", "MISSION_READINESS_DEGRADED", "failed", reason, {
    failureReason: reason,
  });
}

function markMissionRuntimeAvailable(readiness) {
  logPass("MISSION", "mission_runtime", "mission_runtime_available", "passed", "mission runtime is available after startup gate passed", {
    refs: getLocalAiRefs(readiness),
  });
}

function logStartupReady() {
  logPass("RUNTIME", "startup_entrypoint", "terminal_structured_log_relay", "ready", "terminal structured log relay active", {
    refs: ["/api/runtime/logs", "/api/runtime/actions", "/api/runtime/mission-readiness"],
  });
  logEvent("RUNTIME", "startup_entrypoint", "waiting_for_human_command", "ready", `waiting for human command at ${baseUrl}`);
}

function isControlledServiceExit(exit, shuttingDown) {
  return shuttingDown || exit.signal === "SIGTERM" || exit.code === 143;
}

async function performLaunch(flags, root) {
  await ensureDependencies(root, flags);
  await runUpdatePreflight(root, flags);
  logMissionReadinessStarted();
  let localAiReadiness;
  try {
    await ensureStartupMapPackageReadiness();
    localAiReadiness = await ensureLocalAiReadiness();
    logMissionReadinessPassed(localAiReadiness);
  } catch (error) {
    logMissionReadinessDegraded(toFailureReason(error));
    throw error;
  }
  await preparePort();
  const serviceHandle = await startService(root, localAiReadiness);
  await verifyAppHealth(serviceHandle);
  await openReadyPage(flags);
  markMissionRuntimeAvailable(localAiReadiness);
  logStartupReady();
  return serviceHandle;
}

async function openReadyPage(flags) {
  if (flags.skipOpen) {
    logEvent("COMMANDER", "commander_console", "open_console", "skipped", `automatic open skipped; commander console url=${baseUrl}`);
    return;
  }

  const log = (message) => {
    terminalLogger.event({
      phase: "COMMANDER",
      component: "commander_console",
      eventType: "open_console_detail",
      status: "event",
      message,
    });
  };

  try {
    const openResult = await openCommanderConsole(baseUrl);
    log(`Opened ${baseUrl} in ${openResult.browserName} (${openResult.browserPath})`);
    logPass("COMMANDER", "commander_console", "open_console", "passed", `opened Commander Console via ${openResult.browserName}`, {
      refs: [`browserPath=${openResult.browserPath}`],
    });
  } catch (error) {
    logFail("COMMANDER", "commander_console", "open_console", "failed", `automatic open failed; open ${baseUrl} manually`, {
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
