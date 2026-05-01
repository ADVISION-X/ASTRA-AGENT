import { createConfiguredAiAbilityGroup } from "../index.js";
import { recordAiDebugEvent } from "../../forensics-persistence/index.js";

type AiWorkbenchRuntimeInput = {
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

export const createAiRuntime = (runtime: AiWorkbenchRuntimeInput) =>
  createConfiguredAiAbilityGroup({
    emitDebugEvent: (event) => recordAiDebugEvent(runtime, event),
  });