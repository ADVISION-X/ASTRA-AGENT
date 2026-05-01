import { recordAiDebugEvent } from "../../capabilities/forensics-persistence/index.js";

export const recordWorkbenchAiDebugEvent = (
  ...input: Parameters<typeof recordAiDebugEvent>
) => recordAiDebugEvent(...input);