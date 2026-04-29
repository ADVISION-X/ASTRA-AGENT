import type { MouseScrollChildCapability } from "../../contract.js";
import { MOUSE_SCROLL_ABILITY_GROUP_ID } from "../../contract.js";
import { executeMouseScroll } from "../../runtime/mouse-scroll-executor.js";
import { ScrollDesktopScreenInputSchema, ScrollDesktopScreenResultSchema } from "./schema.js";

export function createScrollDesktopScreenCapability(): MouseScrollChildCapability {
  return {
    abilityGroupId: MOUSE_SCROLL_ABILITY_GROUP_ID,
    childCapabilityId: "scroll-desktop-screen",
    async execute(input, context) {
      const parsedInput = ScrollDesktopScreenInputSchema.parse(input);
      return ScrollDesktopScreenResultSchema.parse(await executeMouseScroll({
        request: parsedInput,
        expectedCoordinateSpace: "desktopScreen",
        context,
      }));
    },
  };
}