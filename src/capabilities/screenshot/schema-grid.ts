import { createHash } from "node:crypto";
import { z } from "zod";

const VISUAL_MISSION_GRID_VERSION = "visual-grid.v1" as const;
const VISUAL_MISSION_AXIS_MODE = "y_letters_x_numbers" as const;
export const VISUAL_MISSION_DEFAULT_GRID_ROWS = 8 as const;
export const VISUAL_MISSION_DEFAULT_GRID_COLUMNS = 8 as const;

const finitePositive = z.number().finite().positive();
const finiteNonNeg = z.number().finite().nonnegative();
const isoDate = z.string().datetime();

const ScreenshotGridCellSchema = z.object({
  cellId: z.string().regex(/^[A-Z]+[1-9][0-9]*$/),
  rowLabel: z.string().regex(/^[A-Z]+$/),
  columnLabel: z.string().regex(/^[1-9][0-9]*$/),
  rowIndex: z.number().int().nonnegative(),
  columnIndex: z.number().int().positive(),
  x: finiteNonNeg,
  y: finiteNonNeg,
  width: finitePositive,
  height: finitePositive,
  centerX: z.number().finite(),
  centerY: z.number().finite(),
}).strict();

export type ScreenshotGridCell = z.infer<typeof ScreenshotGridCellSchema>;

export const ScreenshotGridSpecSchema = z.object({
  gridSpecId: z.string().min(1),
  gridSpecRef: z.string().min(1),
  gridVersion: z.literal(VISUAL_MISSION_GRID_VERSION),
  axisMode: z.literal(VISUAL_MISSION_AXIS_MODE),
  sourceScreenshotRef: z.string().min(1),
  sourceWidth: finitePositive,
  sourceHeight: finitePositive,
  gridImageWidth: finitePositive,
  gridImageHeight: finitePositive,
  gridRows: z.number().int().positive(),
  gridColumns: z.number().int().positive(),
  rowLabels: z.array(z.string().regex(/^[A-Z]+$/)).min(1),
  columnLabels: z.array(z.string().regex(/^[1-9][0-9]*$/)).min(1),
  cellWidthPx: finitePositive,
  cellHeightPx: finitePositive,
  cells: z.array(ScreenshotGridCellSchema).min(1),
  createdAt: isoDate,
}).strict();

export type ScreenshotGridSpec = z.infer<typeof ScreenshotGridSpecSchema>;

function encodeRowLabel(index: number): string {
  let value = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

function buildGridAxes(input: { rowCount: number; columnCount: number }) {
  return {
    rowLabels: Array.from({ length: input.rowCount }, (_, i) => encodeRowLabel(i)),
    columnLabels: Array.from({ length: input.columnCount }, (_, i) => String(i + 1)),
  };
}

export function buildGridSpec(input: {
  sourceScreenshotRef: string;
  sourceWidth: number;
  sourceHeight: number;
  gridImageWidth: number;
  gridImageHeight: number;
  rowCount: number;
  columnCount: number;
  createdAt: string;
}): ScreenshotGridSpec {
  const { rowLabels, columnLabels } = buildGridAxes({
    rowCount: input.rowCount,
    columnCount: input.columnCount,
  });
  const cellWidthPx = input.gridImageWidth / input.columnCount;
  const cellHeightPx = input.gridImageHeight / input.rowCount;
  const cells = buildGridCells({ rowLabels, columnLabels, cellWidthPx, cellHeightPx });
  return {
    gridSpecId: buildGridSpecId(input),
    gridSpecRef: buildGridSpecId(input),
    gridVersion: VISUAL_MISSION_GRID_VERSION,
    axisMode: VISUAL_MISSION_AXIS_MODE,
    sourceScreenshotRef: input.sourceScreenshotRef,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    gridImageWidth: input.gridImageWidth,
    gridImageHeight: input.gridImageHeight,
    gridRows: input.rowCount,
    gridColumns: input.columnCount,
    rowLabels,
    columnLabels,
    cellWidthPx,
    cellHeightPx,
    cells,
    createdAt: input.createdAt,
  };
}

export function decodeGridCell(
  gridSpec: ScreenshotGridSpec,
  cellId: string,
): ScreenshotGridCell {
  const cell = gridSpec.cells.find((candidate) => candidate.cellId === cellId);
  if (!cell) throw new Error(`Unknown grid cell: ${cellId}`);
  return cell;
}

function buildGridSpecId(input: {
  sourceScreenshotRef: string;
  gridImageWidth: number;
  gridImageHeight: number;
  rowCount: number;
  columnCount: number;
}): string {
  const hashInput = [
    input.sourceScreenshotRef,
    input.gridImageWidth,
    input.gridImageHeight,
    input.rowCount,
    input.columnCount,
  ].join(":");
  return `grid-spec:${createHash("sha256").update(hashInput).digest("hex").slice(0, 24)}`;
}

function buildGridCells(input: {
  rowLabels: string[];
  columnLabels: string[];
  cellWidthPx: number;
  cellHeightPx: number;
}): ScreenshotGridCell[] {
  return input.rowLabels.flatMap((rowLabel, rowIndex) =>
    input.columnLabels.map((columnLabel, columnIndex) =>
      buildGridCell({ rowLabel, columnLabel, rowIndex, columnIndex, input }),
    ),
  );
}

function buildGridCell(params: {
  rowLabel: string;
  columnLabel: string;
  rowIndex: number;
  columnIndex: number;
  input: { cellWidthPx: number; cellHeightPx: number };
}): ScreenshotGridCell {
  const x = params.columnIndex * params.input.cellWidthPx;
  const y = params.rowIndex * params.input.cellHeightPx;
  return {
    cellId: `${params.rowLabel}${params.columnLabel}`,
    rowLabel: params.rowLabel,
    columnLabel: params.columnLabel,
    rowIndex: params.rowIndex,
    columnIndex: params.columnIndex + 1,
    x,
    y,
    width: params.input.cellWidthPx,
    height: params.input.cellHeightPx,
    centerX: x + params.input.cellWidthPx / 2,
    centerY: y + params.input.cellHeightPx / 2,
  };
}
