import { createConfiguredAiAbilityGroup } from "../../capabilities/ai/index.js";
import { recordWorkbenchAiDebugEvent } from "./workbench-ai-debug-recorder.js";

type WorkbenchAiRuntimeInput = {
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

export const createWorkbenchAiAbilityGroup = (input: WorkbenchAiRuntimeInput) =>
  createConfiguredAiAbilityGroup({
    emitDebugEvent: (event) => recordWorkbenchAiDebugEvent(input, event),
  });