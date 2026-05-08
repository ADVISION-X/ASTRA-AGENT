import { createHash, randomUUID } from "node:crypto";

import type {
  TextInputExecutionPort,
  TextInputExecutionRequest,
  TextInputExecutionResult,
} from "../../capabilities/text-input/ports/text-input-execution-port.js";
import type {
  BrowserController,
  BrowserTextInputAction,
  BrowserTextInputKey,
} from "./browser-controller.js";

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function createExecutionRef(prefix: "text_input_primitive" | "text_input_operation"): string {
  return `${prefix}:${randomUUID()}`;
}

function hashOptionalText(text: string | null): string | null {
  return text === null ? null : hashText(text);
}

function buildFailureReason(message: string): "primitive_timeout" | "primitive_aborted" | "primitive_failed" {
  if (message.includes("timed out")) {
    return "primitive_timeout";
  }
  if (message.includes("aborted")) {
    return "primitive_aborted";
  }
  return "primitive_failed";
}

function buildSuccessResult(value: TextInputExecutionRequest, result: Awaited<ReturnType<BrowserController["textInput"]>>, startedAt: string): TextInputExecutionResult {
  return {
    ok: result.ok,
    primitiveExecutionRef: result.browserActionId ?? createExecutionRef("text_input_primitive"),
    operationRef: createExecutionRef("text_input_operation"),
    typedTextHash: hashOptionalText(value.inputText),
    keySequenceHash: value.key === null ? null : hashText(String(value.key)),
    message: result.message,
    startedAt,
    endedAt: new Date().toISOString(),
    portKind: "browser-controller",
    failureReason: result.ok ? null : "primitive_failed",
  };
}

function buildFailureResult(value: TextInputExecutionRequest, startedAt: string, error: unknown): TextInputExecutionResult {
  const message = error instanceof Error ? error.message : "text input primitive failed";
  return {
    ok: false,
    primitiveExecutionRef: createExecutionRef("text_input_primitive"),
    operationRef: createExecutionRef("text_input_operation"),
    typedTextHash: hashOptionalText(value.inputText),
    keySequenceHash: value.key === null ? null : hashText(String(value.key)),
    message,
    startedAt,
    endedAt: new Date().toISOString(),
    portKind: "browser-controller",
    failureReason: buildFailureReason(message),
  };
}

function resolveBrowserTextInputAction(childCapabilityId: TextInputExecutionRequest["childCapabilityId"]): BrowserTextInputAction {
  return childCapabilityId === "press-navigation-key" ? "press-key" : childCapabilityId;
}

type CreateBrowserControllerTextInputExecutionPortInput = {
  browserController: BrowserController;
};

export function createBrowserControllerTextInputExecutionPort(
  input: CreateBrowserControllerTextInputExecutionPortInput,
): TextInputExecutionPort {
  return {
    execute(value: TextInputExecutionRequest): Promise<TextInputExecutionResult> {
      if (value.abortSignal.aborted) {
        return Promise.resolve({
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
        });
      }

      const startedAt = new Date().toISOString();
      return input.browserController.textInput({
        targetLabel: value.targetLabel,
        action: resolveBrowserTextInputAction(value.childCapabilityId),
        text: value.inputText,
        key: value.key,
        fallbackUsed: false,
        abortSignal: value.abortSignal,
      }).then(
        (result) => buildSuccessResult(value, result, startedAt),
        (error) => buildFailureResult(value, startedAt, error),
      );
    },
  };
}