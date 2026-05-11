import { createHash } from "node:crypto";

import type {
  MouseClickPrimitiveInput,
  MouseClickPrimitivePort,
  MouseClickPrimitiveResult,
} from "../../capabilities/mouse-click/ports/mouse-click-primitive-port.js";
import type { BrowserController } from "./browser-controller.js";

type CreateBrowserControllerMouseClickPrimitivePortInput = {
  browserController: BrowserController;
};

function buildPrimitiveExecutionRef(primitiveRef: string): string {
  return `mc:exec:${createHash("sha1").update(primitiveRef).digest("hex").slice(0, 16)}`;
}

function buildTargetLabel(value: MouseClickPrimitiveInput): string {
  return `mouse-click:${value.button}x${value.clickCount}:${Math.round(value.executableCoordinate.x)},${Math.round(value.executableCoordinate.y)}`;
}

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
    abortSignal?.addEventListener(
      "abort",
      () => {
        reject(new Error("mouse click primitive aborted"));
      },
      { once: true },
    );
  });
}

async function executeBrowserClick(
  browserController: BrowserController,
  value: MouseClickPrimitiveInput,
) {
  return Promise.race([
    browserController.click({
      targetLabel: buildTargetLabel(value),
      point: value.executableCoordinate,
      coordinateSpace: value.coordinateSpace,
      button: value.button,
      clickCount: value.clickCount,
      fallbackUsed: false,
    }),
    createClickAbortPromise(value.abortSignal),
  ]);
}

function createSuccessfulClickResult(
  startedAt: string,
  primitiveRef: string,
  result: Awaited<ReturnType<BrowserController["click"]>>,
): MouseClickPrimitiveResult {
  return {
    ok: result.ok,
    primitiveExecutionRef: result.browserActionId ?? buildPrimitiveExecutionRef(primitiveRef),
    message: result.message,
    startedAt,
    endedAt: new Date().toISOString(),
    portKind: "browser-controller",
  };
}

function createFailedClickResult(startedAt: string, primitiveRef: string, error: unknown): MouseClickPrimitiveResult {
  return {
    ok: false,
    primitiveExecutionRef: buildPrimitiveExecutionRef(primitiveRef),
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
    return createSuccessfulClickResult(startedAt, value.primitiveRef, result);
  } catch (error) {
    return createFailedClickResult(startedAt, value.primitiveRef, error);
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