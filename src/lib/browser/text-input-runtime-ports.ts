import { createSystemClipboardPort } from "./system-clipboard-port.js";
import { createBrowserControllerTextInputExecutionPort } from "./text-input-primitive-port.js";

export function createBrowserControllerTextInputRuntimePorts(
  input: Parameters<typeof createBrowserControllerTextInputExecutionPort>[0],
) {
  return {
    executionPort: createBrowserControllerTextInputExecutionPort(input),
    clipboardPort: createSystemClipboardPort(),
  };
}