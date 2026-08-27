import { getDefaultPhase04LocalDataDir } from "./default-data-dir.js";
import path from "node:path";
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
import {
  createWorkbenchBrowserAuthority,
  type WorkbenchBrowserAuthority,
} from "./workbench-browser-authority-support.js";
import { createWorkbenchGptAbilityGroup } from "./workbench-gpt-support.js";
import { createWorkbenchEvidenceStore } from "./workbench-evidence-support.js";

export type WorkbenchAssembly = {
  options: GrassEyeWorkbenchOptions;
  dataDir: string;
  structuredLogBus: StructuredLogBus;
  browserAuthority: WorkbenchBrowserAuthority;
  evidenceStore: ReturnType<typeof createWorkbenchEvidenceStore>;
  gptAbilityGroup: ReturnType<typeof createWorkbenchGptAbilityGroup>;
  runtimeLogger: RuntimeLogger;
};

export async function createWorkbenchAssembly(
  options: GrassEyeWorkbenchOptions,
): Promise<WorkbenchAssembly> {
  const dataDir = options.dataDir ?? getDefaultPhase04LocalDataDir();
  const runtimeLogger = createWorkbenchRuntimeLogger(dataDir);
  const structuredLogBus = createWorkbenchStructuredLogBus();

  const browserAuthority = await createWorkbenchBrowserAuthority(dataDir, runtimeLogger);

  const evidenceStore = createWorkbenchEvidenceStore(dataDir, runtimeLogger);
  const gptAbilityGroup = createWorkbenchGptAbilityGroup();

  return {
    options,
    dataDir,
    structuredLogBus,
    browserAuthority,
    evidenceStore,
    gptAbilityGroup,
    runtimeLogger,
  };
}

function createWorkbenchRuntimeLogger(dataDir: string): RuntimeLogger {
  const runtimeLogger = createRuntimeLogger({
    terminalEnabled: true,
    fileSink: {
      bundlePath: path.join(dataDir, "runtime-logs", "workbench.jsonl"),
    },
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
