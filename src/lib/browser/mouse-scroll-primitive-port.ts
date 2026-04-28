import { createId } from "../local-runtime/ids.js";
import type { MouseScrollPrimitiveInput, MouseScrollPrimitivePort, MouseScrollPrimitiveResult } from "../../capabilities/mouse-scroll/primitive-port.js";
import type { BrowserController } from "./browser-controller.js";

type CreateBrowserControllerMouseScrollPrimitivePortInput = {
  browserController: BrowserController;
};

export function createBrowserControllerMouseScrollPrimitivePort(
  input: CreateBrowserControllerMouseScrollPrimitivePortInput,
): MouseScrollPrimitivePort {
  return {
    async scroll(value: MouseScrollPrimitiveInput): Promise<MouseScrollPrimitiveResult> {
      const startedAt = new Date().toISOString();

      try {
        const result = await input.browserController.scroll({
          targetLabel: value.targetLabel,
          deltaX: value.deltaX,
          deltaY: value.deltaY,
          coordinateSpace: value.coordinateSpace,
          anchorPoint: value.anchorPoint,
          fallbackUsed: false,
        });

        return {
          ok: result.ok,
          primitiveExecutionRef: result.browserActionId ?? createId("mouse_scroll_primitive"),
          message: result.message,
          startedAt,
          endedAt: new Date().toISOString(),
        };
      } catch (error) {
        return {
          ok: false,
          primitiveExecutionRef: createId("mouse_scroll_primitive"),
          message: error instanceof Error ? error.message : "mouse scroll primitive failed",
          startedAt,
          endedAt: new Date().toISOString(),
        };
      }
    },
  };
}