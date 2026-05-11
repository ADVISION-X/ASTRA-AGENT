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

export function createBrowserTextInputPrimitivePort(): TextInputPrimitivePort {
  return {
    async typeText(input) {
      const ref = buildRef();
      const startedAt = new Date().toISOString();
      try {
        await activateChrome(input.abortSignal);
        await keystrokeBrowserText(input.text, input.abortSignal);
        return buildSuccess(ref, startedAt);
      } catch (error) {
        return buildFailure(ref, startedAt, error);
      }
    },

    async pressKey(input) {
      const ref = buildRef();
      const startedAt = new Date().toISOString();
      try {
        await activateChrome(input.abortSignal);
        // BrowserTextInputKey matches our approved key allowlist for common keys
        await pressNamedBrowserKey(input.key as Parameters<typeof pressNamedBrowserKey>[0], input.abortSignal);
        return buildSuccess(ref, startedAt);
      } catch (error) {
        return buildFailure(ref, startedAt, error);
      }
    },

    async clearFocusedInput(input) {
      const ref = buildRef();
      const startedAt = new Date().toISOString();
      try {
        await activateChrome(input.abortSignal);
        await selectAllBrowserText(input.abortSignal);
        await pressNamedBrowserKey("Backspace", input.abortSignal);
        return buildSuccess(ref, startedAt);
      } catch (error) {
        return buildFailure(ref, startedAt, error);
      }
    },
  };
}
