import type {
  BrowserActionResult,
  BrowserTextInputAction,
  BrowserTextInputKey,
} from "./browser-controller.js";
import {
  activateChrome,
  keystrokeBrowserText,
  pressNamedBrowserKey,
  selectAllBrowserText,
} from "./current-chrome-browser-controller-primitives.js";
import { createBrowserActionResult } from "./current-chrome-browser-action-result.js";

type CurrentChromeFieldInputRequest = {
  targetLabel: string;
  action: BrowserTextInputAction;
  text?: string | null;
  key?: BrowserTextInputKey | null;
  abortSignal?: AbortSignal;
};

function validateFieldInputRequest(input: CurrentChromeFieldInputRequest): BrowserActionResult | null {
  if (input.action === "type-text" && (!input.text || input.text.length === 0)) {
    return createBrowserActionResult({
      actionId: "browser-field-input-validation",
      ok: false,
      message: `missing text for ${input.action} on ${input.targetLabel}`,
    });
  }

  if (input.action === "press-key" && !input.key) {
    return createBrowserActionResult({
      actionId: "browser-field-input-validation",
      ok: false,
      message: `missing key for ${input.action} on ${input.targetLabel}`,
    });
  }

  return null;
}

async function runFieldInputAction(input: CurrentChromeFieldInputRequest): Promise<void> {
  switch (input.action) {
    case "type-text":
      await keystrokeBrowserText(input.text ?? "", input.abortSignal);
      return;
    case "clear-input":
      await selectAllBrowserText(input.abortSignal);
      await pressNamedBrowserKey("Backspace", input.abortSignal);
      return;
    case "press-key":
      await pressNamedBrowserKey(input.key ?? "Enter", input.abortSignal);
  }
}

export async function executeCurrentChromeFieldInput(
  input: CurrentChromeFieldInputRequest,
  createActionId: () => string,
): Promise<BrowserActionResult> {
  await activateChrome();

  const invalidResult = validateFieldInputRequest(input);
  if (invalidResult) {
    return invalidResult;
  }

  await runFieldInputAction(input);
  return createBrowserActionResult({
    actionId: createActionId(),
    message: `${input.action} executed for ${input.targetLabel}`,
  });
}