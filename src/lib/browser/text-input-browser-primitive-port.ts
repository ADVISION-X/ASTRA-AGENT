import { randomUUID } from "node:crypto";

import {
  activateChrome,
  keystrokeBrowserText,
  pressNamedBrowserKey,
  selectAllBrowserText,
} from "./current-chrome-browser-controller-primitives.js";
import type { TextInputPrimitivePort, TextInputPrimitiveResult } from "../../capabilities/text-input/ports/text-input-primitive-port.js";

function buildRef(): string {
  return `ti:primitive:browser:${randomUUID()}`;
}

function buildSuccess(ref: string, startedAt: string): TextInputPrimitiveResult {
  return {
    ok: true,
    primitiveExecutionRef: ref,
    message: "ok",
    startedAt,
    endedAt: new Date().toISOString(),
    portKind: "chrome-browser",
  };
}

function buildFailure(ref: string, startedAt: string, error: unknown): TextInputPrimitiveResult {
  const message = error instanceof Error ? error.message : "primitive failed";
  return {
    ok: false,
    primitiveExecutionRef: ref,
    message,
    startedAt,
    endedAt: new Date().toISOString(),
    portKind: "chrome-browser",
  };
}

async function runBrowserPrimitive(
  abortSignal: AbortSignal | undefined,
  action: () => Promise<void>,
): Promise<TextInputPrimitiveResult> {
  const ref = buildRef();
  const startedAt = new Date().toISOString();
  try {
    await activateChrome(abortSignal);
    await action();
    return buildSuccess(ref, startedAt);
  } catch (error) {
    return buildFailure(ref, startedAt, error);
  }
}

export function createBrowserTextInputPrimitivePort(): TextInputPrimitivePort {
  return {
    async typeText(input) {
      return runBrowserPrimitive(input.abortSignal, () =>
        keystrokeBrowserText(input.text, input.abortSignal));
    },
    async pressKey(input) {
      return runBrowserPrimitive(input.abortSignal, () =>
        pressNamedBrowserKey(input.key as Parameters<typeof pressNamedBrowserKey>[0], input.abortSignal));
    },
    async clearFocusedInput(input) {
      return runBrowserPrimitive(input.abortSignal, async () => {
        await selectAllBrowserText(input.abortSignal);
        await pressNamedBrowserKey("Backspace", input.abortSignal);
      });
    },
  };
}
