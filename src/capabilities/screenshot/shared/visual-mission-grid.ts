import type { ScreenshotGridCell, ScreenshotGridSpec, ScreenshotSourceProof } from "../contract.js";

export const DEFAULT_VISUAL_MISSION_GRID_ROW_COUNT = 12;
export const DEFAULT_VISUAL_MISSION_GRID_COLUMN_COUNT = 50;
export const VISUAL_MISSION_GRID_VERSION = "visual-grid.v1" as const;
export const VISUAL_MISSION_AXIS_MODE = "y_letters_x_numbers" as const;
export const VISUAL_MISSION_COORDINATE_INSTRUCTION = "Use grid cells only. Y axis is letters. X axis is numbers. Example: A30, C50. Never output raw x/y.";

type VisualMissionGridAxes = {
  rowLabels: string[];
  columnLabels: string[];
};

function resolveSourceCoordinateSpace(sourceProof: ScreenshotSourceProof): ScreenshotGridSpec["sourceCoordinateSpace"] {
  const inheritedCoordinateSpace = sourceProof.inheritedScaleMapping?.sourceCoordinateSpace;
  if (inheritedCoordinateSpace) {
    return inheritedCoordinateSpace;
  }

  if (sourceProof.coordinateSpace) {
    return sourceProof.coordinateSpace;
  }

  throw new Error("prepare-visual-mission-input requires source coordinate space in sourceProof.");
}

function encodeRowLabel(index: number): string {
  let value = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

function scaleCoordinate(value: number, sourceSize: number | null, targetSize: number | null, offset: number): number {
  if (!sourceSize || !targetSize || targetSize <= 0) {
    return value + offset;
  }
  return offset + value * (sourceSize / targetSize);
}

function projectCellToSourceSpace(input: { cell: ScreenshotGridCell; sourceProof: ScreenshotSourceProof }): ScreenshotGridCell {
  const inherited = input.sourceProof.inheritedScaleMapping;
  const sourceCoordinateSpace = resolveSourceCoordinateSpace(input.sourceProof);
  if (!inherited) {
    return {
      ...input.cell,
      sourceCoordinateSpace,
    };
  }

  const x = scaleCoordinate(input.cell.x, inherited.sourceWidth, inherited.targetWidth, inherited.cropOffsetX);
  const y = scaleCoordinate(input.cell.y, inherited.sourceHeight, inherited.targetHeight, inherited.cropOffsetY);
  const width = scaleCoordinate(input.cell.width, inherited.sourceWidth, inherited.targetWidth, 0);
  const height = scaleCoordinate(input.cell.height, inherited.sourceHeight, inherited.targetHeight, 0);

  return {
    ...input.cell,
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    sourceCoordinateSpace,
  };
}

function buildGridRowLabels(rowCount: number): string[] {
  return Array.from({ length: rowCount }, (_, index) => encodeRowLabel(index));
}

function buildGridColumnLabels(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, index) => String(index + 1));
}

export function buildGridAxes(input: { rowCount: number; columnCount: number }): VisualMissionGridAxes {
  return {
    rowLabels: buildGridRowLabels(input.rowCount),
    columnLabels: buildGridColumnLabels(input.columnCount),
  };
}

export function projectGridSpecToSourceCoordinates(input: { gridSpec: ScreenshotGridSpec; sourceProof: ScreenshotSourceProof }): ScreenshotGridSpec {
  const inherited = input.sourceProof.inheritedScaleMapping;
  const sourceCoordinateSpace = resolveSourceCoordinateSpace(input.sourceProof);
  const sourceWidth = inherited?.sourceWidth ?? input.gridSpec.sourceWidth;
  const sourceHeight = inherited?.sourceHeight ?? input.gridSpec.sourceHeight;
  return {
    ...input.gridSpec,
    sourceWidth,
    sourceHeight,
    sourceCoordinateSpace,
    cells: input.gridSpec.cells.map((cell) => projectCellToSourceSpace({
      cell,
      sourceProof: input.sourceProof,
    })),
  };
}

export function decodeGridCell(input: { gridSpec: ScreenshotGridSpec; cellId: string }): ScreenshotGridCell {
  const cell = input.gridSpec.cells.find((candidate) => candidate.cellId === input.cellId);
  if (!cell) {
    throw new Error(`Unknown visual mission grid cell: ${input.cellId}`);
  }
  return cell;
}