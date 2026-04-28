import { createId } from "../local-runtime/ids.js";
import type { MouseClickPrimitiveInput, MouseClickPrimitivePort, MouseClickPrimitiveResult } from "../../capabilities/mouse-click/primitive-port.js";
import type { BrowserController } from "./browser-controller.js";

type CreateBrowserControllerMouseClickPrimitivePortInput = {
  browserController: BrowserController;
};

export function createBrowserControllerMouseClickPrimitivePort(
  input: CreateBrowserControllerMouseClickPrimitivePortInput,
): MouseClickPrimitivePort {
  return {
    async click(value: MouseClickPrimitiveInput): Promise<MouseClickPrimitiveResult> {
      const startedAt = new Date().toISOString();

      try {
        const result = await input.browserController.click({
          targetLabel: value.targetLabel,
          point: { x: value.x, y: value.y },
          coordinateSpace: value.coordinateSpace,
          button: value.button,
          clickCount: value.clickCount,
          fallbackUsed: false,
        });

        return {
          ok: result.ok,
          primitiveExecutionRef: result.browserActionId ?? createId("mouse_click_primitive"),
          message: result.message,
          startedAt,
          endedAt: new Date().toISOString(),
        };
      } catch (error) {
        return {
          ok: false,
          primitiveExecutionRef: createId("mouse_click_primitive"),
          message: error instanceof Error ? error.message : "mouse click primitive failed",
          startedAt,
          endedAt: new Date().toISOString(),
        };
      }
    },
  };
}