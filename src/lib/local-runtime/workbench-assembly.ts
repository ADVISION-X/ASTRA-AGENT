/**
 * workbench-assembly.ts — All capability group assembly for the local workbench.
 *
 * Responsibilities:
 *   - Creates browser session + controller.
 *   - Wires capability-group support modules into one local workbench assembly.
 *
 * Does NOT contain: mission logic, AI routing, Forensics finalization,
 * Commander read models, map/binding, retired support systems,
 * or Nerve Bus special routes.
 */

import { getDefaultPhase04LocalDataDir } from "./default-data-dir.js";
import { StructuredLogBus } from "./structured-log-bus.js";
import {
  createStructuredTerminalLogListener,
  isStructuredLogStdoutEnabled,
  resolveStructuredLogLevel,
} from "./structured-log-terminal.js";
import { createRuntimeLogger, setDefaultRuntimeLogger } from "../runtime-logs/logger.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import {
  createWorkbenchBrowserController,
  createWorkbenchOpenAbilityGroup,
  createWorkbenchPrimitivePorts,
  createWorkbenchScreenshotGroup,
} from "./workbench-browser-support.js";
import {
  createWorkbenchCapabilityGroups,
  createWorkbenchForensicsGroup,
} from "./workbench-capability-support.js";

// ─── Assembly Type ─────────────────────────────────────────────────────────────

export type WorkbenchAssembly = {
  options: GrassEyeWorkbenchOptions;
  dataDir: string;
  structuredLogBus: StructuredLogBus;
  browserController: ReturnType<typeof createWorkbenchBrowserController>;
  forensicsPersistenceAbilityGroup: ReturnType<typeof createWorkbenchForensicsGroup>;
  aiAbilityGroup: ReturnType<typeof createWorkbenchCapabilityGroups>["aiAbilityGroup"];
  openAbilityGroup: ReturnType<typeof createWorkbenchOpenAbilityGroup>;
  screenshotAbilityGroup: ReturnType<typeof createWorkbenchScreenshotGroup>;
  geometryGuardAbilityGroup: ReturnType<typeof createWorkbenchCapabilityGroups>["geometryGuardAbilityGroup"];
  mouseClickAbilityGroup: ReturnType<typeof createWorkbenchCapabilityGroups>["mouseClickAbilityGroup"];
  mouseScrollAbilityGroup: ReturnType<typeof createWorkbenchCapabilityGroups>["mouseScrollAbilityGroup"];
  textInputAbilityGroup: ReturnType<typeof createWorkbenchCapabilityGroups>["textInputAbilityGroup"];
  runtimeLogger: RuntimeLogger;
};

// ─── Assembly ─────────────────────────────────────────────────────────────────

export function createWorkbenchAssembly(
  options: GrassEyeWorkbenchOptions,
): WorkbenchAssembly {
  const dataDir = options.dataDir ?? getDefaultPhase04LocalDataDir();
  const runtimeLogger = createWorkbenchRuntimeLogger();
  const structuredLogBus = createWorkbenchStructuredLogBus();
  const browserController = createWorkbenchBrowserController(options, dataDir);
  const forensicsPersistenceAbilityGroup =
    createWorkbenchForensicsGroup(dataDir, runtimeLogger);
  const primitivePorts = createWorkbenchPrimitivePorts(browserController);
  const openAbilityGroup = createWorkbenchOpenAbilityGroup(
    options,
    browserController,
  );
  const screenshotAbilityGroup = createWorkbenchScreenshotGroup(
    browserController,
    dataDir,
  );
  const capabilityGroups = createWorkbenchCapabilityGroups({
    dataDir,
    runtimeLogger,
    primitivePorts,
  });

  return {
    options,
    dataDir,
    structuredLogBus,
    browserController,
    forensicsPersistenceAbilityGroup,
    openAbilityGroup,
    screenshotAbilityGroup,
    ...capabilityGroups,
    runtimeLogger,
  };
}

function createWorkbenchRuntimeLogger(): RuntimeLogger {
  const runtimeLogger = createRuntimeLogger({
    terminalEnabled: true,
  });
  setDefaultRuntimeLogger(runtimeLogger);
  return runtimeLogger;
}

function createWorkbenchStructuredLogBus(): StructuredLogBus {
  const structuredLogBus = new StructuredLogBus();
  if (isStructuredLogStdoutEnabled()) {
    structuredLogBus.subscribe(
      createStructuredTerminalLogListener(resolveStructuredLogLevel()),
    );
  }
  return structuredLogBus;
}
