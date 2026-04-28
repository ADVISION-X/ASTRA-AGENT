import type { MouseClickChildCapability } from "../../contract.js";
import { MOUSE_CLICK_ABILITY_GROUP_ID } from "../../contract.js";
import { buildMouseClickFailure, buildMouseClickSuccess } from "../../shared/click-result.js";
import { validateMouseClickAbilityInput } from "../../shared/validate-input.js";

export function createClickDesktopCoordinateCapability(): MouseClickChildCapability {
  return {
    abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
    childCapabilityId: "click-desktop-coordinate",
    async execute(input, context) {
      const startedAt = new Date().toISOString();
      const validation = validateMouseClickAbilityInput(input);
      if (!validation.ok) {
        return buildMouseClickFailure({
          childCapabilityId: "click-desktop-coordinate",
          abilityInput: input,
          startedAt,
          endedAt: new Date().toISOString(),
          failureReason: validation.failureReason,
          statusMessage: validation.message,
          status: validation.status,
        });
      }
      if (validation.coordinate.coordinateSpace !== "desktopScreen") {
        return buildMouseClickFailure({
          childCapabilityId: "click-desktop-coordinate",
          abilityInput: input,
          startedAt,
          endedAt: new Date().toISOString(),
          failureReason: "unsupported_coordinate_space",
          statusMessage: "click-desktop-coordinate requires desktopScreen authoritative coordinate",
        });
      }

      const primitiveResult = await context.primitivePort.click({
        targetLabel: `${input.purpose}:${input.childCapabilityId}`,
        x: validation.coordinate.x,
        y: validation.coordinate.y,
        coordinateSpace: "desktopScreen",
        button: validation.button,
        clickCount: validation.clickCount,
        timeoutMs: input.safetyPolicy.maxDurationMs,
      });
      const endedAt = primitiveResult.endedAt;
      const primitiveDurationMs = Date.parse(primitiveResult.endedAt) - Date.parse(primitiveResult.startedAt);
      if (!primitiveResult.ok) {
        return buildMouseClickFailure({
          childCapabilityId: "click-desktop-coordinate",
          abilityInput: input,
          startedAt,
          endedAt,
          failureReason: "primitive_failed",
          statusMessage: primitiveResult.message,
          primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
        });
      }
      if (primitiveDurationMs > input.safetyPolicy.maxDurationMs) {
        return buildMouseClickFailure({
          childCapabilityId: "click-desktop-coordinate",
          abilityInput: input,
          startedAt,
          endedAt,
          failureReason: "duration_limit_exceeded",
          statusMessage: `mouse click primitive exceeded maxDurationMs ${input.safetyPolicy.maxDurationMs}`,
          primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
        });
      }

      return buildMouseClickSuccess({
        childCapabilityId: "click-desktop-coordinate",
        abilityInput: input,
        startedAt,
        endedAt,
        primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
        statusMessage: primitiveResult.message,
      });
    },
  };
}