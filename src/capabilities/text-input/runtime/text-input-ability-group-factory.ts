import type { ClipboardPort } from "../ports/clipboard-port.js";
import type { TextInputExecutionPort } from "../ports/text-input-execution-port.js";
import { createTextInputAbilityGroup } from "../ability-group.js";
import { createSystemTextInputClock } from "./text-input-clock.js";

export function createTextInputAbilityGroupWithPorts(input: {
  executionPort: TextInputExecutionPort;
  clipboardPort: ClipboardPort;
}) {
  return createTextInputAbilityGroup({
    context: {
      executionPort: input.executionPort,
      clipboardPort: input.clipboardPort,
      clock: createSystemTextInputClock(),
    },
  });
}