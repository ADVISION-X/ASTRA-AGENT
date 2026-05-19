import type {
  GeometryGuardAbilityResult,
  GeometryGuardChildCapability,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "../schema-constants.js";
import { validateBboxInsideViewport, validateSizeProvided } from "../runtime/bounds.js";
import {
  allowGuardChild,
  denyGuardChild,
  startGeometryGuardTiming,
} from "../runtime/child-runtime.js";
import { normalizeBboxGridRegion } from "../runtime/child-normalization.js";

export function createValidateBboxGridRegionCapability(): GeometryGuardChildCapability {
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: "validate-bbox-grid-region",
    execute: executeValidateBboxGridRegion,
  };
}

async function executeValidateBboxGridRegion(
  input: ParsedGeometryGuardAbilityInput,
): Promise<GeometryGuardAbilityResult> {
  const timing = startGeometryGuardTiming();
  const viewportCheck = validateSizeProvided(input.viewportSize);
  if (!viewportCheck.ok) {
    return denyBboxGridRegion(input, timing, viewportCheck.reason);
  }
  if (!input.bbox) {
    return denyBboxGridRegion(input, timing, "bbox_required_for_bbox_grid_region");
  }
  const viewportSize = input.viewportSize!;
  const geometry = normalizeBboxGridRegion(input, viewportSize);
  const bboxCheck = validateBboxInsideViewport(
    geometry.normalizedBbox,
    viewportSize,
    input.safetyPolicy,
  );
  if (!bboxCheck.ok) {
    return denyGuardChild({ input, timing, ...geometry, failureReason: bboxCheck.reason, statusMessage: denyMessage(bboxCheck.reason) });
  }
  return allowGuardChild({ input, timing, ...geometry });
}

function denyBboxGridRegion(
  input: ParsedGeometryGuardAbilityInput,
  timing: ReturnType<typeof startGeometryGuardTiming>,
  failureReason: string,
): GeometryGuardAbilityResult {
  return denyGuardChild({
    input,
    timing,
    failureReason,
    statusMessage: denyMessage(failureReason),
    normalizedClickPoint: null,
    normalizedBbox: null,
  });
}

function denyMessage(failureReason: string): string {
  if (failureReason === "bbox_required_for_bbox_grid_region") {
    return "Geometry Guard denied validate-bbox-grid-region: bbox is required.";
  }
  return `Geometry Guard denied validate-bbox-grid-region: ${failureReason}`;
}
