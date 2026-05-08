import { createConfiguredAiAbilityGroup } from "../../capabilities/ai/index.js";
import { getDefaultLocalDataDir } from "./default-data-dir.js";
import { recordWorkbenchAiDebugEvent } from "./workbench-ai-debug-recorder.js";
import type { WorkbenchAiDebugEvent } from "./workbench-ai-debug-support.js";

type WorkbenchAiRuntimeInput = {
  options: {
    dataDir?: string;
  };
  browserSessionConfig: {
    profileRef: string | null;
  };
  browserController: {
    getSessionState(): {
      loginState: string | null;
    };
  };
  forensicsPersistenceAbilityGroup: {
    writeStructuredRuntimeEvent(input: unknown): Promise<unknown>;
  };
};

const logWorkbenchAiDebugFailure = (error: unknown) => {
  console.error("[grasseye:ai-debug]", error instanceof Error ? error.message : "Unknown AI debug write failure");
};

const recordWorkbenchAiDebugEventNonBlocking = (
  runtime: WorkbenchAiRuntimeInput,
  event: WorkbenchAiDebugEvent,
) => {
  void recordWorkbenchAiDebugEvent(runtime, event).catch(logWorkbenchAiDebugFailure);
};

export const createWorkbenchAiAbilityGroup = (input: WorkbenchAiRuntimeInput) =>
  createConfiguredAiAbilityGroup({
    emitDebugEvent: async (event) => {
      recordWorkbenchAiDebugEventNonBlocking(input, event);
    },
    dataDir: input.options.dataDir ?? getDefaultLocalDataDir(),
  });