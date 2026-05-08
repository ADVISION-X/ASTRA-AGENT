import type { GrassEyeWorkbenchHandle } from "../local-runtime/workbench-handle.js";

type CommanderDebugInput = Parameters<GrassEyeWorkbenchHandle["recordCommanderDebugEvent"]>[0];

const logTaskStartDebugFailure = (error: unknown) => {
  console.error("[grasseye:task-start-debug]", error instanceof Error ? error.message : "Unknown task-start debug write failure");
};

export const recordTaskStartDebugEvent = (
  activeWorkbench: GrassEyeWorkbenchHandle,
  input: CommanderDebugInput,
) => {
  void activeWorkbench.recordCommanderDebugEvent(input).catch(logTaskStartDebugFailure);
};