import type { GrassEyeWorkbenchHandle } from "../local-runtime/workbench-handle.js";

// recordCommanderDebugEvent has been removed from WorkbenchFacade.
// Task-start debug events are now silently dropped — no forbidden facade call is made.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommanderDebugInput = Record<string, any>;

export const recordTaskStartDebugEvent = (
  _activeWorkbench: GrassEyeWorkbenchHandle,
  _input: CommanderDebugInput,
): void => {
  // No-op: this channel has been governed out of the facade.
};