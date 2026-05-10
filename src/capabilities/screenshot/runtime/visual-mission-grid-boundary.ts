import type { ScreenshotExecutionOutput, ScreenshotGridCell } from "../contract.js";
import {
  MIN_VISUAL_MISSION_GRID_CELL_HEIGHT_PX,
  MIN_VISUAL_MISSION_GRID_CELL_WIDTH_PX,
} from "../shared/visual-mission-grid.js";

const GRID_EPSILON = 0.000001;

type VisualMissionGridMathBoundaryFailure = {
  reason: string;
  message: string;
};

function buildFailure(reason: string, message: string): VisualMissionGridMathBoundaryFailure {
  return { reason, message };
}

function isWithinBoundary(value: number, max: number) {
  return value >= -GRID_EPSILON && value <= max + GRID_EPSILON;
}

function hasRequiredVisualMissionOutput(output: ScreenshotExecutionOutput) {
  return output.gridSpec && output.originalScreenshotRef && output.coordinateGridScreenshotRef;
}

function resolveGridDimensionFailure(output: ScreenshotExecutionOutput) {
  if (!hasRequiredVisualMissionOutput(output)) {
    return null;
  }

  const { gridSpec, originalScreenshotRef, coordinateGridScreenshotRef } = output;
  if (
    Math.abs(gridSpec.gridImageWidth - output.width) > GRID_EPSILON
    || Math.abs(gridSpec.gridImageHeight - output.height) > GRID_EPSILON
    || Math.abs(gridSpec.gridImageWidth - originalScreenshotRef.width) > GRID_EPSILON
    || Math.abs(gridSpec.gridImageHeight - originalScreenshotRef.height) > GRID_EPSILON
    || Math.abs(gridSpec.gridImageWidth - coordinateGridScreenshotRef.width) > GRID_EPSILON
    || Math.abs(gridSpec.gridImageHeight - coordinateGridScreenshotRef.height) > GRID_EPSILON
  ) {
    return buildFailure("visual_mission_grid_dimension_mismatch", "gridSpec and screenshot artifact dimensions must stay identical for coordinate-grid outputs.");
  }

  return null;
}

function resolveGridReadabilityFailure(output: ScreenshotExecutionOutput) {
  if (!output.gridSpec) {
    return null;
  }

  if (output.gridSpec.cellWidthPx < MIN_VISUAL_MISSION_GRID_CELL_WIDTH_PX || output.gridSpec.cellHeightPx < MIN_VISUAL_MISSION_GRID_CELL_HEIGHT_PX) {
    return buildFailure("visual_mission_grid_unreadable", "Coordinate-grid outputs must keep visual mission cells at or above the governed minimum readable size.");
  }

  return null;
}

function resolveGridCellCountFailure(output: ScreenshotExecutionOutput) {
  if (!output.gridSpec) {
    return null;
  }

  const expectedCellCount = output.gridSpec.rowLabels.length * output.gridSpec.columnLabels.length;
  return output.gridSpec.cells.length === expectedCellCount
    ? null
    : buildFailure("visual_mission_grid_cell_count_mismatch", "gridSpec.cells must match rowLabels x columnLabels for coordinate-grid outputs.");
}

function resolveCellBoundaryFailure(cell: ScreenshotGridCell, output: ScreenshotExecutionOutput) {
  if (!output.gridSpec) {
    return null;
  }

  if (cell.sourceCoordinateSpace !== output.gridSpec.sourceCoordinateSpace) {
    return buildFailure("visual_mission_grid_coordinate_space_mismatch", "Every visual mission grid cell must preserve gridSpec.sourceCoordinateSpace.");
  }

  const right = cell.x + cell.width;
  const bottom = cell.y + cell.height;
  if (!isWithinBoundary(cell.x, output.gridSpec.sourceWidth) || !isWithinBoundary(cell.y, output.gridSpec.sourceHeight) || !isWithinBoundary(right, output.gridSpec.sourceWidth) || !isWithinBoundary(bottom, output.gridSpec.sourceHeight)) {
    return buildFailure("visual_mission_grid_cell_out_of_bounds", `Grid cell ${cell.cellId} must stay inside sourceWidth/sourceHeight.`);
  }

  if (cell.centerX < cell.x - GRID_EPSILON || cell.centerX > right + GRID_EPSILON || cell.centerY < cell.y - GRID_EPSILON || cell.centerY > bottom + GRID_EPSILON) {
    return buildFailure("visual_mission_grid_center_out_of_bounds", `Grid cell ${cell.cellId} center must stay inside its own bounds.`);
  }

  return null;
}

function resolveCornerCellFailure(output: ScreenshotExecutionOutput) {
  if (!output.gridSpec) {
    return null;
  }

  const firstRow = output.gridSpec.rowLabels[0];
  const lastRow = output.gridSpec.rowLabels.at(-1);
  const firstColumn = output.gridSpec.columnLabels[0];
  const lastColumn = output.gridSpec.columnLabels.at(-1);
  if (!firstRow || !lastRow || !firstColumn || !lastColumn) {
    return buildFailure("visual_mission_grid_axes_missing", "gridSpec must expose first and last row/column labels.");
  }

  const requiredCellIds = new Set([`${firstRow}${firstColumn}`, `${firstRow}${lastColumn}`, `${lastRow}${firstColumn}`, `${lastRow}${lastColumn}`]);
  for (const requiredCellId of requiredCellIds) {
    if (!output.gridSpec.cells.some((cell) => cell.cellId === requiredCellId)) {
      return buildFailure("visual_mission_grid_corner_missing", `gridSpec must include corner cell ${requiredCellId}.`);
    }
  }

  return null;
}

export function resolveVisualMissionGridMathBoundaryFailure(output: ScreenshotExecutionOutput): VisualMissionGridMathBoundaryFailure | null {
  if (output.imageKind !== "coordinate_grid") {
    return null;
  }

  return resolveGridDimensionFailure(output)
    ?? resolveGridReadabilityFailure(output)
    ?? resolveGridCellCountFailure(output)
    ?? resolveCornerCellFailure(output)
    ?? output.gridSpec?.cells.map((cell) => resolveCellBoundaryFailure(cell, output)).find((failure) => failure !== null)
    ?? null;
}