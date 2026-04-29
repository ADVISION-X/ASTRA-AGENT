import type { MouseClickChildCapability } from "../../contract.js";
import { MOUSE_CLICK_ABILITY_GROUP_ID } from "../../contract.js";
import { executeMouseClick } from "../../runtime/mouse-click-executor.js";
import { ClickBrowserCoordinateInputSchema, ClickBrowserCoordinateResultSchema } from "./schema.js";

export function createClickBrowserCoordinateCapability(): MouseClickChildCapability {
  return {
    abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
    childCapabilityId: "click-browser-coordinate",
    async execute(input, context) {
      const parsedInput = ClickBrowserCoordinateInputSchema.parse(input);
      return ClickBrowserCoordinateResultSchema.parse(await executeMouseClick({
        request: parsedInput,
        expectedCoordinateSpace: "browserViewport",
        context,
      }));
    },
  };
}