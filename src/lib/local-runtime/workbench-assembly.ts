import { getDefaultPhase04LocalDataDir } from "./default-data-dir.js";
import path from "node:path";
import {
  createRuntimeLogger,
  requireRuntimeLogWrite,
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
  dataDir: string;
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
  let browserAuthority: WorkbenchBrowserAuthority;
  try {
    browserAuthority = await createWorkbenchBrowserAuthority(dataDir, runtimeLogger);
  } catch (error) {
    const traceId = `producer:${runtimeLogger.producerRunId}`;
    requireRuntimeLogWrite(runtimeLogger.emitEvent({
      traceId, operation: "runtime.shutdown", code: "PRODUCER_STOPPED",
      typedIdentity: { kind: "producer", producerId: runtimeLogger.producerRunId },
    }));
    throw error;
  }

  const evidenceStore = createWorkbenchEvidenceStore(dataDir, runtimeLogger);
  const gptAbilityGroup = createWorkbenchGptAbilityGroup();

  return {
    dataDir,
    browserAuthority,
    evidenceStore,
    gptAbilityGroup,
    runtimeLogger,
  };
}

function createWorkbenchRuntimeLogger(dataDir: string): RuntimeLogger {
  const runtimeLogger = createRuntimeLogger({
    producer: "agent",
    owner: "app-shell",
    component: "workbench",
    terminalEnabled: true,
    fileSink: {
      directoryPath: path.join(dataDir, "runtime-logs"),
    },
  });
  const traceId = `producer:${runtimeLogger.producerRunId}`;
  requireRuntimeLogWrite(runtimeLogger.emitEvent({
    traceId, operation: "runtime.start", code: "PRODUCER_STARTED",
    typedIdentity: { kind: "producer", producerId: runtimeLogger.producerRunId },
  }));
  return runtimeLogger;
}
