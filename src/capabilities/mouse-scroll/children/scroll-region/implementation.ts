import type { MouseScrollChildCapability } from "../../contract.js";
import { MOUSE_SCROLL_ABILITY_GROUP_ID } from "../../contract.js";
import { getRegionBounds } from "../../shared/coordinate.js";
import { resolveMouseScrollDelta } from "../../shared/scroll-magnitude.js";
import { buildMouseScrollFailure, buildMouseScrollReviewRequired, buildMouseScrollSuccess } from "../../shared/scroll-result.js";
import { validateMouseScrollAbilityInput } from "../../shared/validate-input.js";

export function createScrollRegionCapability(): MouseScrollChildCapability {
  return {
    abilityGroupId: MOUSE_SCROLL_ABILITY_GROUP_ID,
    childCapabilityId: "scroll-region",
    async execute(input, context) {
      const startedAt = new Date().toISOString();
      const validation = validateMouseScrollAbilityInput(input, "scroll-region");
      const delta = resolveMouseScrollDelta({
        direction: input.direction,
        magnitude: input.magnitude,
        customDelta: input.customDelta,
        bounds: input.region ? getRegionBounds(input.region) : input.bounds,
      });
      if (!validation.ok) {
        return validation.decision === "review_required"
          ? buildMouseScrollReviewRequired({ callInput: input, startedAt, endedAt: new Date().toISOString(), deltaX: delta.deltaX, deltaY: delta.deltaY, primitiveExecutionRefs: [], failureReason: validation.failureReason, statusMessage: validation.statusMessage })
          : buildMouseScrollFailure({ callInput: input, startedAt, endedAt: new Date().toISOString(), deltaX: delta.deltaX, deltaY: delta.deltaY, primitiveExecutionRefs: [], failureReason: validation.failureReason, statusMessage: validation.statusMessage });
      }

      if (!input.region || !input.regionRef) {
        return buildMouseScrollFailure({ callInput: input, startedAt, endedAt: new Date().toISOString(), deltaX: delta.deltaX, deltaY: delta.deltaY, primitiveExecutionRefs: [], failureReason: "missing_region_ref", statusMessage: "scroll-region requires approved region and regionRef" });
      }

      const primitiveExecutionRefs: string[] = [];
      for (let iteration = 1; iteration <= input.repeat; iteration += 1) {
        const primitiveResult = await context.primitivePort.scroll({ coordinateSpace: input.coordinateSpace, anchorPoint: input.anchorPoint, deltaX: delta.deltaX, deltaY: delta.deltaY, targetLabel: `${input.purpose}:region:${iteration}`, timeoutMs: input.safetyPolicy.maxDurationMs });
        primitiveExecutionRefs.push(primitiveResult.primitiveExecutionRef);
        if (!primitiveResult.ok) {
          return buildMouseScrollFailure({ callInput: input, startedAt, endedAt: primitiveResult.endedAt, deltaX: delta.deltaX, deltaY: delta.deltaY, primitiveExecutionRefs, failureReason: "primitive_failed", statusMessage: primitiveResult.message });
        }
      }

      return buildMouseScrollSuccess({ callInput: input, startedAt, endedAt: new Date().toISOString(), deltaX: delta.deltaX, deltaY: delta.deltaY, primitiveExecutionRefs, statusMessage: "Mouse Scroll executed approved region primitive sequence" });
    },
  };
}