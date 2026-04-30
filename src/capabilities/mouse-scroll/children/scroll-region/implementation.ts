import { MOUSE_SCROLL_ABILITY_GROUP_ID } from "../../contract.js";
import { executeMouseScroll } from "../../runtime/mouse-scroll-executor.js";
import type { MouseScrollChildCapability } from "../../runtime/mouse-scroll-runtime-context.js";
import { ScrollRegionInputSchema, ScrollRegionResultSchema } from "./schema.js";

export function createScrollRegionCapability(): MouseScrollChildCapability {
  return {
    abilityGroupId: MOUSE_SCROLL_ABILITY_GROUP_ID,
    childCapabilityId: "scroll-region",
    async execute(input, context) {
      const parsedInput = ScrollRegionInputSchema.parse(input);
      return ScrollRegionResultSchema.parse(await executeMouseScroll({
        request: parsedInput,
        expectedCoordinateSpace: parsedInput.coordinateSpace,
        context,
      }));
    },
  };
}