import path from "node:path";
import { fileURLToPath } from "node:url";

import { assessDependencyState, installDependencies } from "./lib/dependency-check.mjs";
import { probeCommanderConsolePage, probeHealth, waitForHealth } from "./lib/health-check.mjs";
import { openCommanderConsole } from "./lib/open-commander-console.mjs";
import { clearPortListeners, startLocalService, stopLocalService } from "./lib/process-control.mjs";
import { createTerminalStructuredLogger } from "./lib/terminal-structured-log.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const host = process.env.GRASSEYE_HOST ?? "127.0.0.1";
const port = Number(process.env.GRASSEYE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const healthUrl = `${baseUrl}/api/runtime/health`;
const missionReadinessUrl = `${baseUrl}/api/runtime/mission-readiness`;
const terminalLogger = createTerminalStructuredLogger();

function toFailureReason(error) {
  return error instanceof Error ? error.message : String(error);
}

function logEvent(phase, component, eventType, status, message, extra = {}) {
  terminalLogger.event({ phase, component, eventType, status, message, ...extra });
}

function logPass(phase, component, eventType, status, message, extra = {}) {
  terminalLogger.pass({ phase, component, eventType, status, message, ...extra });
}

function logFail(phase, component, eventType, status, message, extra = {}) {
  terminalLogger.fail({ phase, component, eventType, status, message, ...extra });
}

function formatFailingComponents(report) {
  if (!Array.isArray(report?.components)) {
    return [];
  }

  return report.components
    .filter((component) => component?.ok !== true)
    .map((component) => `${component.name}=${component.detail}`);
}

function parseFlags(argv) {
  return {
    updateRequested: argv.includes("--update"),
    skipOpen: argv.includes("--no-open") || process.env.GRASSEYE_SKIP_OPEN === "1",
  };
}

function registerSignalHandlers(shutdown) {
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
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

  if (flags.updateRequested) {
    if (!dependencyState.safeToUpdate) {
      throw new Error(
        `Refusing controlled update because dependency ranges are not bounded: ${dependencyState.unsafeUpdateRanges.join(", ")}.`,
      );
    }

    logEvent("STARTUP", "bootstrap", "dependency_update", "started", "running controlled dependency refresh");
    await installDependencies({ rootDir: root, updateRequested: true });
  }

  const finalState = await assessDependencyState({ rootDir: root });
  if (finalState.requiresInstall) {
    throw new Error(`Dependency state is still not ready after repair: ${finalState.reasons.join(" ")}`);
  }

  logPass("STARTUP", "bootstrap", "dependency_check", "passed", "dependency readiness passed", {
    durationMs: Date.now() - startedAt,
  });
}

async function performLaunch(flags, root) {
  await ensureDependencies(root, flags);

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

  const serviceStart = Date.now();
  logEvent("SERVICE", "app_server", "app_server", "starting", `starting local app shell on ${baseUrl}`);
  const serviceHandle = await startLocalService({
    rootDir: root,
    preStartScripts: [],
    scriptName: "internal:app-server:dev",
    env: {
      GRASSEYE_PLATFORM_TARGET: "tiktok-web",
    },
    onStdoutLine: (line, scriptName) => terminalLogger.relayServiceStdoutLine(line, scriptName),
    onStderrLine: (line, scriptName) => terminalLogger.relayServiceStderrLine(line, scriptName),
  });
  logPass("SERVICE", "app_server", "app_server", "ready", `local app shell process started for ${baseUrl}`, {
    durationMs: Date.now() - serviceStart,
  });

  const healthStart = Date.now();
  logEvent("APP", "app_shell", "APP_SHELL_HEALTH_CHECK_STARTED", "started", `waiting for health at ${healthUrl}`);
  const healthReport = await waitForHealth({ url: healthUrl, serviceProcess: serviceHandle.child });
  const pageReport = await probeCommanderConsolePage({ url: baseUrl });
  logPass("APP", "app_shell", "APP_SHELL_HEALTH_PASSED", "passed", `Commander Console reachable at ${baseUrl}`, {
    refs: [`components=${Array.isArray(healthReport.components) ? healthReport.components.length : 0}`, `contentType=${pageReport.contentType}`],
    durationMs: Date.now() - healthStart,
  });

  await openReadyPage(flags);

  const readinessStart = Date.now();
  logEvent("MISSION", "mission_readiness", "MISSION_READINESS_CHECK_STARTED", "started", `checking mission readiness at ${missionReadinessUrl}`);
  try {
    const missionReadiness = await probeHealth({ url: missionReadinessUrl });
    const failingComponents = formatFailingComponents(missionReadiness);
    if (failingComponents.length === 0 && missionReadiness?.status === "ready") {
      logPass("MISSION", "mission_readiness", "MISSION_READINESS_PASSED", "passed", "mission readiness passed", {
        durationMs: Date.now() - readinessStart,
      });
    } else {
      logEvent("MISSION", "mission_readiness", "MISSION_READINESS_DEGRADED", "degraded", missionReadiness?.actionableMessage ?? "mission readiness degraded", {
        refs: failingComponents,
        durationMs: Date.now() - readinessStart,
      });
    }
  } catch (error) {
    logEvent("MISSION", "mission_readiness", "MISSION_READINESS_FAILED", "failed", "mission readiness check failed after App Shell passed; keeping Commander Console alive", {
      failureReason: toFailureReason(error),
      durationMs: Date.now() - readinessStart,
    });
  }

  logPass("RUNTIME", "startup_entrypoint", "terminal_structured_log_relay", "ready", "terminal structured log relay active", {
    refs: ["/api/runtime/logs", "/api/runtime/actions", "/api/runtime/mission-readiness"],
  });
  logEvent("RUNTIME", "startup_entrypoint", "waiting_for_human_command", "ready", `waiting for human command at ${baseUrl}`);
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
    logEvent("SERVICE", "app_server", "SERVICE_SHUTDOWN_REQUESTED", "started", `stopping local service with ${signal}`);
    if (serviceHandle) {
      await stopLocalService(serviceHandle.child, signal);
    }
    logPass("SERVICE", "app_server", "SERVICE_SHUTDOWN_COMPLETED", "passed", `local service stopped with ${signal}`);
  };

  registerSignalHandlers(shutdown);

  try {
    serviceHandle = await performLaunch(flags, rootDir);
    const exit = await serviceHandle.waitForExit();
    if (!shuttingDown) {
      logFail("SERVICE", "app_server", "SERVICE_UNEXPECTED_EXIT", "failed", "local service exited unexpectedly", {
        failureReason: exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? "unknown"}`,
      });
      logFail("SERVICE", "app_server", "SERVICE_EXIT_CLASSIFICATION", "failed", "classified local service exit", {
        failureReason: exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? "unknown"}`,
      });
      process.exitCode = exit.code ?? 1;
    }
    return;
  } catch (error) {
    logFail("STARTUP", "startup_entrypoint", "bootstrap_failed", "failed", "startup bootstrap failed", {
      failureReason: toFailureReason(error),
    });
    await shutdown("SIGTERM");
    process.exitCode = 1;
  }
}

await main();