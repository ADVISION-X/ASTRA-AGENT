import { MOUSE_CLICK_ABILITY_GROUP_ID } from "../shared/constants.js";
import type { MouseClickChildCapability, MouseClickExecutionContext, ParsedMouseClickAbilityInput, MouseClickAbilityResult } from "../contract.js";
import { MouseClickAbilityInputSchema } from "../schema.js";
import { executeMouseClick } from "../runtime/execute-click.js";

/**
 * Child capability: left-click-browser-viewport-once
 *
 * Fixed: button = left, clickCount = 1, coordinateSpace = browserViewport
 * AI provides: gridCell (resolved to coordinate by Geometry Guard before dispatch)
 */
export function createLeftClickBrowserViewportOnceCapability(): MouseClickChildCapability {
  return {
    abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
    childCapabilityId: "left-click-browser-viewport-once",
    async execute(
      input: ParsedMouseClickAbilityInput,
      context: MouseClickExecutionContext,
    ): Promise<MouseClickAbilityResult> {
      const parsed = MouseClickAbilityInputSchema.parse(input);
      return executeMouseClick(parsed, context);
    },
  };
}
