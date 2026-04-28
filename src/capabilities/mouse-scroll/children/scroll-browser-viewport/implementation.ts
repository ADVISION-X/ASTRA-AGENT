import type { MouseScrollChildCapability } from "../../contract.js";
import { MOUSE_SCROLL_ABILITY_GROUP_ID } from "../../contract.js";
import { resolveMouseScrollDelta } from "../../shared/scroll-magnitude.js";
import { buildMouseScrollFailure, buildMouseScrollReviewRequired, buildMouseScrollSuccess } from "../../shared/scroll-result.js";
import { validateMouseScrollAbilityInput } from "../../shared/validate-input.js";

export function createScrollBrowserViewportCapability(): MouseScrollChildCapability {
  return {
    abilityGroupId: MOUSE_SCROLL_ABILITY_GROUP_ID,
    childCapabilityId: "scroll-browser-viewport",
    async execute(input, context) {
      const startedAt = new Date().toISOString();
      const validation = validateMouseScrollAbilityInput(input, "scroll-browser-viewport");
      const delta = resolveMouseScrollDelta({ direction: input.direction, magnitude: input.magnitude, customDelta: input.customDelta, bounds: input.bounds });
      if (!validation.ok) {
        return validation.decision === "review_required"
          ? buildMouseScrollReviewRequired({ callInput: input, startedAt, endedAt: new Date().toISOString(), deltaX: delta.deltaX, deltaY: delta.deltaY, primitiveExecutionRefs: [], failureReason: validation.failureReason, statusMessage: validation.statusMessage })
          : buildMouseScrollFailure({ callInput: input, startedAt, endedAt: new Date().toISOString(), deltaX: delta.deltaX, deltaY: delta.deltaY, primitiveExecutionRefs: [], failureReason: validation.failureReason, statusMessage: validation.statusMessage });
      }

      if (input.coordinateSpace !== "browserViewport") {
        return buildMouseScrollFailure({ callInput: input, startedAt, endedAt: new Date().toISOString(), deltaX: delta.deltaX, deltaY: delta.deltaY, primitiveExecutionRefs: [], failureReason: "invalid_coordinate_space", statusMessage: "scroll-browser-viewport requires browserViewport coordinateSpace" });
      }

      const primitiveExecutionRefs: string[] = [];
      for (let iteration = 1; iteration <= input.repeat; iteration += 1) {
        const primitiveResult = await context.primitivePort.scroll({ coordinateSpace: "browserViewport", anchorPoint: input.anchorPoint, deltaX: delta.deltaX, deltaY: delta.deltaY, targetLabel: `${input.purpose}:browserViewport:${iteration}`, timeoutMs: input.safetyPolicy.maxDurationMs });
        primitiveExecutionRefs.push(primitiveResult.primitiveExecutionRef);
        if (!primitiveResult.ok) {
          return buildMouseScrollFailure({ callInput: input, startedAt, endedAt: primitiveResult.endedAt, deltaX: delta.deltaX, deltaY: delta.deltaY, primitiveExecutionRefs, failureReason: "primitive_failed", statusMessage: primitiveResult.message });
        }
      }

      return buildMouseScrollSuccess({ callInput: input, startedAt, endedAt: new Date().toISOString(), deltaX: delta.deltaX, deltaY: delta.deltaY, primitiveExecutionRefs, statusMessage: "Mouse Scroll executed browser viewport primitive sequence" });
    },
  };
}