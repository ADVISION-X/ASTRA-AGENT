import { MOUSE_CLICK_ABILITY_GROUP_ID } from "../shared/constants.js";
import type { MouseClickChildCapability, MouseClickExecutionContext, ParsedMouseClickAbilityInput, MouseClickAbilityResult } from "../contract.js";
import { MouseClickAbilityInputSchema } from "../schema.js";
import { executeMouseClick } from "../runtime/execute-click.js";

/**
 * Child capability: double-left-click-browser-viewport
 *
 * Fixed: button = left, clickCount = 2, coordinateSpace = browserViewport
 * AI provides: gridCell (resolved to coordinate by Geometry Guard before dispatch)
 */
export function createDoubleLeftClickBrowserViewportCapability(): MouseClickChildCapability {
  return {
    abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
    childCapabilityId: "double-left-click-browser-viewport",
    async execute(
      input: ParsedMouseClickAbilityInput,
      context: MouseClickExecutionContext,
    ): Promise<MouseClickAbilityResult> {
      const parsed = MouseClickAbilityInputSchema.parse(input);
      return executeMouseClick(parsed, context);
    },
  };
}
