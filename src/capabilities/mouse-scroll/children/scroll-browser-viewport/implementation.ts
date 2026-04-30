import { MOUSE_SCROLL_ABILITY_GROUP_ID } from "../../contract.js";
import { executeMouseScroll } from "../../runtime/mouse-scroll-executor.js";
import type { MouseScrollChildCapability } from "../../runtime/mouse-scroll-runtime-context.js";
import { ScrollBrowserViewportInputSchema, ScrollBrowserViewportResultSchema } from "./schema.js";

export function createScrollBrowserViewportCapability(): MouseScrollChildCapability {
  return {
    abilityGroupId: MOUSE_SCROLL_ABILITY_GROUP_ID,
    childCapabilityId: "scroll-browser-viewport",
    async execute(input, context) {
      const parsedInput = ScrollBrowserViewportInputSchema.parse(input);
      return ScrollBrowserViewportResultSchema.parse(await executeMouseScroll({
        request: parsedInput,
        expectedCoordinateSpace: "browserViewport",
        context,
      }));
    },
  };
}