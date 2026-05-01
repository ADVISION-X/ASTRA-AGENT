import { createId } from "../local-runtime/ids.js";
import type { MouseClickPrimitiveInput, MouseClickPrimitivePort, MouseClickPrimitiveResult } from "../../capabilities/mouse-click/ports/mouse-click-primitive-port.js";
import type { BrowserController } from "./browser-controller.js";

type CreateBrowserControllerMouseClickPrimitivePortInput = {
  browserController: BrowserController;
};

function createAbortedClickResult(): MouseClickPrimitiveResult {
  return {
    ok: false,
    primitiveExecutionRef: null,
    message: "mouse click primitive aborted before dispatch",
    startedAt: null,
    endedAt: null,
    portKind: "browser-controller",
  };
}

function createClickAbortPromise(abortSignal?: AbortSignal): Promise<never> {
  return new Promise<never>((_, reject) => {
    abortSignal?.addEventListener("abort", () => {
      reject(new Error("mouse click primitive aborted"));
    }, { once: true });
  });
}

async function executeBrowserClick(
  browserController: BrowserController,
  value: MouseClickPrimitiveInput,
) {
  return Promise.race([
    browserController.click({
      targetLabel: value.targetLabel,
      point: value.executableCoordinate,
      coordinateSpace: value.coordinateSpace,
      button: value.button,
      clickCount: value.clickCount,
      fallbackUsed: false,
    }),
    createClickAbortPromise(value.abortSignal),
  ]);
}

function createSuccessfulClickResult(startedAt: string, result: Awaited<ReturnType<BrowserController["click"]>>): MouseClickPrimitiveResult {
  return {
    ok: result.ok,
    primitiveExecutionRef: result.browserActionId ?? createId("mouse_click_primitive"),
    message: result.message,
    startedAt,
    endedAt: new Date().toISOString(),
    portKind: "browser-controller",
  };
}

function createFailedClickResult(startedAt: string, error: unknown): MouseClickPrimitiveResult {
  return {
    ok: false,
    primitiveExecutionRef: createId("mouse_click_primitive"),
    message: error instanceof Error ? error.message : "mouse click primitive failed",
    startedAt,
    endedAt: new Date().toISOString(),
    portKind: "browser-controller",
  };
}

async function clickWithBrowserController(
  browserController: BrowserController,
  value: MouseClickPrimitiveInput,
): Promise<MouseClickPrimitiveResult> {
  if (value.abortSignal?.aborted) {
    return createAbortedClickResult();
  }

  const startedAt = new Date().toISOString();

  try {
    const result = await executeBrowserClick(browserController, value);
    return createSuccessfulClickResult(startedAt, result);
  } catch (error) {
    return createFailedClickResult(startedAt, error);
  }
}

export function createBrowserControllerMouseClickPrimitivePort(
  input: CreateBrowserControllerMouseClickPrimitivePortInput,
): MouseClickPrimitivePort {
  return {
    async click(value: MouseClickPrimitiveInput): Promise<MouseClickPrimitiveResult> {
      return clickWithBrowserController(input.browserController, value);
    },
  };
}