import type { ClipboardPort } from "../ports/clipboard-port.js";
import type { TextInputClockPort } from "../ports/text-input-clock-port.js";
import type { TextInputExecutionPort } from "../ports/text-input-execution-port.js";

export type TextInputRuntimeContext = {
  executionPort: TextInputExecutionPort;
  clipboardPort: ClipboardPort;
  clock: TextInputClockPort;
};