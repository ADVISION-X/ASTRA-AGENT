import { z } from "zod";

import { SCREENSHOT_COORDINATE_SPACES } from "./shared/screenshot-types.js";

const finiteNumber = z.number().finite();
const positiveFiniteNumber = z.number().finite().positive();
const dateTimeString = z.string().datetime();
const coordinateSpaceSchema = z.enum(SCREENSHOT_COORDINATE_SPACES);

const ScreenshotStructuredRefSchema = z.object({
  refId: z.string().min(1),
  storageRef: z.string().min(1).max(1000),
  sha256: z.string().min(1),
  mimeType: z.string().min(1),
  createdAt: dateTimeString,
}).strict();

const ScreenshotGridCellSchema = z.object({
  cellId: z.string().regex(/^[A-Z]+[1-9][0-9]*$/),
  rowLabel: z.string().regex(/^[A-Z]+$/),
  columnLabel: z.string().regex(/^[1-9][0-9]*$/),
  rowIndex: z.number().int().nonnegative(),
  columnIndex: z.number().int().positive(),
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
  centerX: finiteNumber,
  centerY: finiteNumber,
  sourceCoordinateSpace: coordinateSpaceSchema,
}).strict();

const ScreenshotGridSpecSchema = z.object({
  gridSpecId: z.string().min(1),
  gridSpecRef: z.string().min(1),
  gridVersion: z.literal("visual-grid.v1"),
  axisMode: z.literal("y_letters_x_numbers"),
  sourceScreenshotEvidenceId: z.string().min(1),
  sourceStorageRef: z.string().min(1).max(1000),
  sourceWidth: positiveFiniteNumber,
  sourceHeight: positiveFiniteNumber,
  gridImageWidth: positiveFiniteNumber,
  gridImageHeight: positiveFiniteNumber,
  rowLabels: z.array(z.string().regex(/^[A-Z]+$/)).min(1),
  columnLabels: z.array(z.string().regex(/^[1-9][0-9]*$/)).min(1),
  cellWidthPx: positiveFiniteNumber,
  cellHeightPx: positiveFiniteNumber,
  sourceCoordinateSpace: coordinateSpaceSchema,
  gridCoordinateSpace: z.literal("coordinate_grid_pixels"),
  cellCoordinateSpace: z.literal("grid_cell_index_space"),
  cells: z.array(ScreenshotGridCellSchema).min(1),
  createdAt: dateTimeString,
}).strict();

const ScreenshotVisualMissionInputSchema = z.object({
  originalScreenshotRef: z.string().min(1),
  coordinateGridScreenshotRef: z.string().min(1),
  gridSpecRef: z.string().min(1),
  coordinateInstruction: z.string().min(1),
}).strict();

export {
  ScreenshotStructuredRefSchema,
  ScreenshotGridCellSchema,
  ScreenshotGridSpecSchema,
  ScreenshotVisualMissionInputSchema,
};