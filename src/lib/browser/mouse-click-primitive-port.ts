import { createId } from "../local-runtime/ids.js";
import type { MouseClickPrimitiveInput, MouseClickPrimitivePort, MouseClickPrimitiveResult } from "../../capabilities/mouse-click/ports/mouse-click-primitive-port.js";
import type { BrowserController } from "./browser-controller.js";

type CreateBrowserControllerMouseClickPrimitivePortInput = {
  browserController: BrowserController;
};

export function createBrowserControllerMouseClickPrimitivePort(
  input: CreateBrowserControllerMouseClickPrimitivePortInput,
): MouseClickPrimitivePort {
  return {
    async click(value: MouseClickPrimitiveInput): Promise<MouseClickPrimitiveResult> {
      if (value.abortSignal?.aborted) {
        return {
          ok: false,
          primitiveExecutionRef: null,
          message: "mouse click primitive aborted before dispatch",
          startedAt: null,
          endedAt: null,
          portKind: "browser-controller",
        };
      }

      const startedAt = new Date().toISOString();

      try {
        const result = await Promise.race([
          input.browserController.click({
            targetLabel: value.targetLabel,
            point: value.executableCoordinate,
            coordinateSpace: value.coordinateSpace,
            button: value.button,
            clickCount: value.clickCount,
            fallbackUsed: false,
          }),
          new Promise<never>((_, reject) => {
            value.abortSignal?.addEventListener("abort", () => {
              reject(new Error("mouse click primitive aborted"));
            }, { once: true });
          }),
        ]);

        return {
          ok: result.ok,
          primitiveExecutionRef: result.browserActionId ?? createId("mouse_click_primitive"),
          message: result.message,
          startedAt,
          endedAt: new Date().toISOString(),
          portKind: "browser-controller",
        };
      } catch (error) {
        return {
          ok: false,
          primitiveExecutionRef: createId("mouse_click_primitive"),
          message: error instanceof Error ? error.message : "mouse click primitive failed",
          startedAt,
          endedAt: new Date().toISOString(),
          portKind: "browser-controller",
        };
      }
    },
  };
}