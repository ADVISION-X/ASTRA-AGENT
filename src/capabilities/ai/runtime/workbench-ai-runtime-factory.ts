import { createConfiguredAiAbilityGroup } from "../index.js";
import { recordAiDebugEvent } from "../../forensics-persistence/runtime/ai-debug-event-recorder.js";
import type { WorkbenchBaseRuntime } from "../../../lib/local-runtime/workbench-contract.js";

export const createAiRuntime = (runtime: Pick<WorkbenchBaseRuntime, "browserController" | "browserSessionConfig" | "forensicsPersistenceAbilityGroup">) =>
  createConfiguredAiAbilityGroup({
    emitDebugEvent: (event) => recordAiDebugEvent(runtime, event),
  });