import path from "node:path";
import { fileURLToPath } from "node:url";

import { assessDependencyState, installDependencies } from "./lib/dependency-check.mjs";
import { waitForHealth } from "./lib/health-check.mjs";
import { openMainPage } from "./lib/open-main-page.mjs";
import { clearPortListeners, releaseLocalService, startLocalService, stopLocalService } from "./lib/process-control.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const host = process.env.GRASSEYE_HOST ?? "127.0.0.1";
const port = Number(process.env.GRASSEYE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const healthUrl = `${baseUrl}/api/runtime/health`;

function log(message) {
  process.stdout.write(`[launch] ${message}\n`);
}

function logError(message) {
  process.stderr.write(`[launch] ${message}\n`);
}

function assertExplicitBrowserProfileEnv() {
  const profileRef = process.env.GRASSEYE_BROWSER_PROFILE_REF?.trim();
  const userDataDir = process.env.GRASSEYE_BROWSER_USER_DATA_DIR?.trim();
  if (!profileRef || !userDataDir) {
    throw new Error(
      "Real-platform launch requires explicit GRASSEYE_BROWSER_PROFILE_REF and GRASSEYE_BROWSER_USER_DATA_DIR. Silent default browser profiles are forbidden because they cannot prove authorized login reuse.",
    );
  }
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
  const dependencyState = await assessDependencyState({
    rootDir: root,
    updateRequested: flags.updateRequested,
  });

  log(`Node ${dependencyState.nodeVersion}, npm ${dependencyState.npmVersion}`);

  if (dependencyState.requiresInstall) {
    log("Dependency state is stale or incomplete; running npm install.");
    for (const reason of dependencyState.reasons) {
      log(`- ${reason}`);
    }
    await installDependencies({ rootDir: root });
  } else {
    log("Dependency state is ready.");
  }

  if (flags.updateRequested) {
    if (!dependencyState.safeToUpdate) {
      throw new Error(
        `Refusing controlled update because dependency ranges are not bounded: ${dependencyState.unsafeUpdateRanges.join(", ")}.`,
      );
    }

    log("Operator requested a controlled dependency refresh; running npm update.");
    await installDependencies({ rootDir: root, updateRequested: true });
  }

  const finalState = await assessDependencyState({ rootDir: root });
  if (finalState.requiresInstall) {
    throw new Error(`Dependency state is still not ready after repair: ${finalState.reasons.join(" ")}`);
  }
}

async function performLaunch(flags, root) {
  assertExplicitBrowserProfileEnv();
  log("Checking dependency readiness.");
  await ensureDependencies(root, flags);

  log(`Clearing startup port ownership on ${host}:${port}.`);
  await clearPortListeners({ host, port, logger: log });

  log("Starting GrassEye local service.");
  const serviceHandle = await startLocalService({ rootDir: root });

  log(`Waiting for health check at ${healthUrl}.`);
  const healthReport = await waitForHealth({ url: healthUrl, serviceProcess: serviceHandle.child });
  log(`Health check passed with ${Array.isArray(healthReport.components) ? healthReport.components.length : 0} components.`);

  await openReadyPage(flags);
  log(`GrassEye launch is ready. Local service is available at ${baseUrl}.`);
  releaseLocalService(serviceHandle.child);
  return serviceHandle;
}

async function openReadyPage(flags) {
  if (flags.skipOpen) {
    log(`Skipping browser open. Main page: ${baseUrl}`);
    return;
  }

  try {
    await openMainPage(baseUrl);
    log(`Opened ${baseUrl}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed to open the page automatically. Open ${baseUrl} manually. ${message}`);
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
    log(`Stopping local service with ${signal}.`);
    if (serviceHandle) {
      await stopLocalService(serviceHandle.child, signal);
    }
  };

  registerSignalHandlers(shutdown);

  try {
    serviceHandle = await performLaunch(flags, rootDir);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(message);
    await shutdown("SIGTERM");
    process.exitCode = 1;
  }
}

await main();