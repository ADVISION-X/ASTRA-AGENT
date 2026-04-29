import type { MouseClickChildCapability } from "../../contract.js";
import { MOUSE_CLICK_ABILITY_GROUP_ID } from "../../contract.js";
import { executeMouseClick } from "../../runtime/mouse-click-executor.js";
import { ClickDesktopCoordinateInputSchema, ClickDesktopCoordinateResultSchema } from "./schema.js";

export function createClickDesktopCoordinateCapability(): MouseClickChildCapability {
  return {
    abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
    childCapabilityId: "click-desktop-coordinate",
    async execute(input, context) {
      const parsedInput = ClickDesktopCoordinateInputSchema.parse(input);
      return ClickDesktopCoordinateResultSchema.parse(await executeMouseClick({
        request: parsedInput,
        expectedCoordinateSpace: "desktopScreen",
        context,
      }));
    },
  };
}