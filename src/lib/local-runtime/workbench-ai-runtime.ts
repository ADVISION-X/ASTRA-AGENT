import { createConfiguredAiAbilityGroup } from "../../capabilities/ai/index.js";
import { recordAiDebugEvent } from "./workbench-ai-debug.js";
import type { WorkbenchBaseRuntime } from "./workbench-contract.js";

export const createAiRuntime = (runtime: Pick<WorkbenchBaseRuntime, "browserController" | "browserSessionConfig" | "forensicsPersistenceAbilityGroup">) =>
  createConfiguredAiAbilityGroup({
    emitDebugEvent: (event) => recordAiDebugEvent(runtime as WorkbenchBaseRuntime, event),
  });