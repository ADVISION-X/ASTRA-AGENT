import { getDefaultPhase04LocalDataDir } from "./default-data-dir.js";
import { StructuredLogBus } from "./structured-log-bus.js";
import {
  createStructuredTerminalLogListener,
  isStructuredLogStdoutEnabled,
  resolveStructuredLogLevel,
} from "./structured-log-terminal.js";
import {
  createRuntimeLogger,
  setDefaultRuntimeLogger,
  type RuntimeLogger,
} from "../runtime-logs/index.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import { createWorkbenchBrowserController } from "./workbench-browser-support.js";
import { createWorkbenchEvidenceStore } from "./workbench-capability-support.js";

export type WorkbenchAssembly = {
  options: GrassEyeWorkbenchOptions;
  dataDir: string;
  structuredLogBus: StructuredLogBus;
  browserController: ReturnType<typeof createWorkbenchBrowserController>;
  evidenceStore: ReturnType<typeof createWorkbenchEvidenceStore>;
  runtimeLogger: RuntimeLogger;
};

export function createWorkbenchAssembly(
  options: GrassEyeWorkbenchOptions,
): WorkbenchAssembly {
  const dataDir = options.dataDir ?? getDefaultPhase04LocalDataDir();
  const runtimeLogger = createWorkbenchRuntimeLogger();
  const structuredLogBus = createWorkbenchStructuredLogBus();
  const browserController = createWorkbenchBrowserController(options, dataDir);
  const evidenceStore = createWorkbenchEvidenceStore(dataDir, runtimeLogger);

  return {
    options,
    dataDir,
    structuredLogBus,
    browserController,
    evidenceStore,
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
