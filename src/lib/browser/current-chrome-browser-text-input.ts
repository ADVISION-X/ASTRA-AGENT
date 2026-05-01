import type {
  BrowserActionResult,
  BrowserTextInputAction,
  BrowserTextInputKey,
} from "./browser-controller.js";
import {
  activateChrome,
  keystrokeBrowserText,
  pasteBrowserText,
  pressNamedBrowserKey,
  selectAllBrowserText,
} from "./current-chrome-browser-controller-primitives.js";
import { createBrowserActionResult } from "./current-chrome-browser-session-state.js";

export type CurrentChromeTextInputRequest = {
  targetLabel: string;
  action: BrowserTextInputAction;
  text?: string | null;
  key?: BrowserTextInputKey | null;
  fallbackUsed?: boolean;
  abortSignal?: AbortSignal;
};

function validateTextInputRequest(input: CurrentChromeTextInputRequest): BrowserActionResult | null {
  if ((input.action === "type-text" || input.action === "replace-input") && (!input.text || input.text.length === 0)) {
    return createBrowserActionResult({
      actionId: "browser-text-input-validation",
      ok: false,
      message: `missing text for ${input.action} on ${input.targetLabel}`,
      fallbackUsed: input.fallbackUsed ?? false,
    });
  }

  if ((input.action === "press-key" || input.action === "commit-input") && !input.key) {
    return createBrowserActionResult({
      actionId: "browser-text-input-validation",
      ok: false,
      message: `missing key for ${input.action} on ${input.targetLabel}`,
      fallbackUsed: input.fallbackUsed ?? false,
    });
  }

  return null;
}

async function runReplaceInput(input: CurrentChromeTextInputRequest): Promise<void> {
  await selectAllBrowserText(input.abortSignal);
  await pressNamedBrowserKey("Backspace", input.abortSignal);
  await keystrokeBrowserText(input.text ?? "", input.abortSignal);
}

async function runTextInputAction(input: CurrentChromeTextInputRequest): Promise<void> {
  switch (input.action) {
    case "type-text":
      await keystrokeBrowserText(input.text ?? "", input.abortSignal);
      return;
    case "paste-text":
      await pasteBrowserText(input.abortSignal);
      return;
    case "clear-input":
      await selectAllBrowserText(input.abortSignal);
      await pressNamedBrowserKey("Backspace", input.abortSignal);
      return;
    case "replace-input":
      await runReplaceInput(input);
      return;
    case "press-key":
    case "commit-input":
      await pressNamedBrowserKey(input.key ?? "Enter", input.abortSignal);
  }
}

export async function executeCurrentChromeTextInput(input: CurrentChromeTextInputRequest, createActionId: () => string): Promise<BrowserActionResult> {
  await activateChrome();

  const invalidResult = validateTextInputRequest(input);
  if (invalidResult) {
    return invalidResult;
  }

  await runTextInputAction(input);
  return createBrowserActionResult({
    actionId: createActionId(),
    message: `${input.action} executed for ${input.targetLabel}`,
    fallbackUsed: input.fallbackUsed ?? false,
  });
}