import { createBrowserTextInputPrimitivePort } from "./text-input-browser-primitive-port.js";

export function createBrowserControllerTextInputRuntimePorts(
  _input: { browserController: unknown },
) {
  return {
    primitivePort: createBrowserTextInputPrimitivePort(),
  };
}
