import { createId } from "../local-runtime/ids.js";
import type { TextInputExecutionPort, TextInputExecutionRequest, TextInputExecutionResult } from "../../capabilities/text-input/ports/text-input-execution-port.js";
import { hashTextValue } from "../../capabilities/text-input/shared/text-input-types.js";
import type { BrowserController } from "./browser-controller.js";

type CreateBrowserControllerTextInputExecutionPortInput = {
  browserController: BrowserController;
};

export function createBrowserControllerTextInputExecutionPort(
  input: CreateBrowserControllerTextInputExecutionPortInput,
): TextInputExecutionPort {
  return {
    async execute(value: TextInputExecutionRequest): Promise<TextInputExecutionResult> {
      if (value.abortSignal.aborted) {
        return {
          ok: false,
          primitiveExecutionRef: null,
          operationRef: null,
          typedTextHash: null,
          keySequenceHash: null,
          message: "text input primitive aborted before dispatch",
          startedAt: null,
          endedAt: null,
          portKind: "browser-controller",
          failureReason: "primitive_aborted",
        };
      }

      const startedAt = new Date().toISOString();

      try {
        const result = await input.browserController.textInput({
          targetLabel: value.targetLabel,
          action: value.childCapabilityId,
          text: value.inputText,
          key: value.key,
          fallbackUsed: false,
          abortSignal: value.abortSignal,
        });

        return {
          ok: result.ok,
          primitiveExecutionRef: result.browserActionId ?? createId("text_input_primitive"),
          operationRef: createId("text_input_operation"),
          typedTextHash: value.inputText === null ? null : hashTextValue(value.inputText),
          keySequenceHash: value.key === null ? null : hashTextValue(String(value.key)),
          message: result.message,
          startedAt,
          endedAt: new Date().toISOString(),
          portKind: "browser-controller",
          failureReason: result.ok ? null : "primitive_failed",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "text input primitive failed";
        const failureReason = message.includes("timed out")
          ? "primitive_timeout"
          : message.includes("aborted")
            ? "primitive_aborted"
            : "primitive_failed";

        return {
          ok: false,
          primitiveExecutionRef: createId("text_input_primitive"),
          operationRef: createId("text_input_operation"),
          typedTextHash: value.inputText === null ? null : hashTextValue(value.inputText),
          keySequenceHash: value.key === null ? null : hashTextValue(String(value.key)),
          message,
          startedAt,
          endedAt: new Date().toISOString(),
          portKind: "browser-controller",
          failureReason,
        };
      }
    },
  };
}