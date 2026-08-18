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
import { createWorkbenchBrowserController } from "./workbench-browser-support.js";
import { createWorkbenchAiInputGateway } from "./workbench-ai-gateway-support.js";
import { createWorkbenchEvidenceStore } from "./workbench-evidence-support.js";
import { createWorkbenchMediaProcessing } from "./workbench-media-processing-support.js";
import { createWorkbenchVideoDownload } from "./workbench-video-download-support.js";

export type WorkbenchAssembly = {
  options: GrassEyeWorkbenchOptions;
  dataDir: string;
  structuredLogBus: StructuredLogBus;
  browserController: Awaited<ReturnType<typeof createWorkbenchBrowserController>>;
  evidenceStore: ReturnType<typeof createWorkbenchEvidenceStore>;
  videoDownload: ReturnType<typeof createWorkbenchVideoDownload>;
  mediaProcessing: ReturnType<typeof createWorkbenchMediaProcessing>;
  aiInputGateway: ReturnType<typeof createWorkbenchAiInputGateway>;
  runtimeLogger: RuntimeLogger;
};

export async function createWorkbenchAssembly(
  options: GrassEyeWorkbenchOptions,
): Promise<WorkbenchAssembly> {
  const dataDir = options.dataDir ?? getDefaultPhase04LocalDataDir();
  const runtimeLogger = createWorkbenchRuntimeLogger(dataDir);
  const structuredLogBus = createWorkbenchStructuredLogBus();

  // This is the composition root's hard authorization gate. No browser-dependent
  // business owner is constructed until the Controller has a live authenticated
  // BrowserAuthority.
  const browserController = await createWorkbenchBrowserController(
    options,
    dataDir,
    runtimeLogger,
  );
  const authority = browserController.getAuthoritySnapshot();
  if (authority.state !== "AUTHENTICATED_AUTHORITY_PRESENT") {
    await browserController.close();
    throw new Error("BROWSER_AUTHORITY_ABSENT_AT_COMPOSITION_ROOT");
  }

  const evidenceStore = createWorkbenchEvidenceStore(dataDir, runtimeLogger);
  const videoDownload = createWorkbenchVideoDownload(dataDir, browserController, runtimeLogger);
  const mediaProcessing = createWorkbenchMediaProcessing(dataDir, runtimeLogger);
  const aiInputGateway = createWorkbenchAiInputGateway(dataDir, browserController, runtimeLogger);

  return {
    options,
    dataDir,
    structuredLogBus,
    browserController,
    evidenceStore,
    videoDownload,
    mediaProcessing,
    aiInputGateway,
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
