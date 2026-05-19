import type {
  GeometryGuardAbilityResult,
  GeometryGuardChildCapability,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "../schema-constants.js";
import { validatePointInsideViewport, validateSizeProvided } from "../runtime/bounds.js";
import {
  allowGuardChild,
  denyGuardChild,
  startGeometryGuardTiming,
} from "../runtime/child-runtime.js";
import { normalizeClickGridCell } from "../runtime/child-normalization.js";

export function createValidateClickGridCellCapability(): GeometryGuardChildCapability {
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: "validate-click-grid-cell",
    execute: executeValidateClickGridCell,
  };
}

async function executeValidateClickGridCell(
  input: ParsedGeometryGuardAbilityInput,
): Promise<GeometryGuardAbilityResult> {
  const timing = startGeometryGuardTiming();
  const viewportCheck = validateSizeProvided(input.viewportSize);
  if (!viewportCheck.ok) {
    return denyClickGridCell(input, timing, viewportCheck.reason);
  }
  if (!input.bbox) {
    return denyClickGridCell(input, timing, "bbox_required_for_click_grid_cell");
  }
  const viewportSize = input.viewportSize!;
  const geometry = normalizeClickGridCell(input, viewportSize);
  const pointCheck = validatePointInsideViewport(
    geometry.normalizedClickPoint,
    viewportSize,
    input.safetyPolicy,
  );
  if (!pointCheck.ok) {
    return denyGuardChild({ input, timing, ...geometry, failureReason: pointCheck.reason, statusMessage: denyMessage(pointCheck.reason) });
  }
  return allowGuardChild({ input, timing, ...geometry });
}

function denyClickGridCell(
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
  if (failureReason === "bbox_required_for_click_grid_cell") {
    return "Geometry Guard denied validate-click-grid-cell: bbox is required.";
  }
  return `Geometry Guard denied validate-click-grid-cell: ${failureReason}`;
}
