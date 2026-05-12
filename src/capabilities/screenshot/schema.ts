import { createHash } from "node:crypto";
import { z } from "zod";

// ─── constants ────────────────────────────────────────────────────────────────

export const SCREENSHOT_ABILITY_GROUP_ID = "screenshot" as const;

export const SCREENSHOT_CHILD_IDS = [
  "capture-browser-viewport",
  "capture-grid-region",
  "render-coordinate-grid",
] as const;

export type ScreenshotChildId = (typeof SCREENSHOT_CHILD_IDS)[number];

export const SCREENSHOT_STATUSES = ["success", "failed", "review_required"] as const;
export type ScreenshotStatus = (typeof SCREENSHOT_STATUSES)[number];

export const VISUAL_MISSION_GRID_VERSION = "visual-grid.v1" as const;
export const VISUAL_MISSION_AXIS_MODE = "y_letters_x_numbers" as const;
export const VISUAL_MISSION_DEFAULT_GRID_ROWS = 8 as const;
export const VISUAL_MISSION_DEFAULT_GRID_COLUMNS = 8 as const;
export const MIN_GRID_CELL_WIDTH_PX = 20 as const;
export const MIN_GRID_CELL_HEIGHT_PX = 15 as const;

// ─── helpers ──────────────────────────────────────────────────────────────────

const nullableString = z.string().min(1).nullable().optional().default(null);
const finitePositive = z.number().finite().positive();
const finiteNonNeg = z.number().finite().nonnegative();
const isoDate = z.string().datetime();

// ─── GridSpec schemas ─────────────────────────────────────────────────────────

export const ScreenshotGridCellSchema = z.object({
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

export const ScreenshotArtifactRefSchema = z.object({
  artifactId: z.string().min(1),
  storageRef: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().length(64),
  createdAt: isoDate,
}).strict();

export type ScreenshotArtifactRef = z.infer<typeof ScreenshotArtifactRefSchema>;

export const ScreenshotStructuredRefSchema = z.object({
  refId: z.string().min(1),
  storageRef: z.string().min(1),
  sha256: z.string().length(64),
  mimeType: z.literal("application/json"),
  createdAt: isoDate,
}).strict();

export type ScreenshotStructuredRef = z.infer<typeof ScreenshotStructuredRefSchema>;

// ─── proof ────────────────────────────────────────────────────────────────────

export const ScreenshotProofSchema = z.object({
  proofId: z.string().min(1),
  abilityGroupId: z.literal(SCREENSHOT_ABILITY_GROUP_ID),
  childCapabilityId: z.enum(SCREENSHOT_CHILD_IDS),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: nullableString,
  roundId: nullableString,
  stepId: z.string().min(1),
  capabilityCallId: z.string().min(1),
  nerveBusEnvelopeId: z.string().min(1),
  inputRef: z.string().min(1),
  screenshotRef: nullableString,
  artifactRef: nullableString,
  coordinateGridScreenshotRef: nullableString,
  gridSpecRef: nullableString,
  capturePhaseMs: z.number().int().nonnegative().nullable().optional().default(null),
  gridRenderPhaseMs: z.number().int().nonnegative().nullable().optional().default(null),
  artifactWritePhaseMs: z.number().int().nonnegative().nullable().optional().default(null),
  totalScreenshotStepMs: z.number().int().nonnegative(),
  status: z.enum(SCREENSHOT_STATUSES),
  failureReason: nullableString,
  reviewRequiredReason: nullableString,
  startedAt: isoDate,
  endedAt: isoDate,
  durationMs: z.number().int().nonnegative(),
}).strict();

export type ScreenshotProof = z.infer<typeof ScreenshotProofSchema>;

// ─── capture-browser-viewport ─────────────────────────────────────────────────

export const CaptureBrowserViewportInputSchema = z.object({
  childCapabilityId: z.literal("capture-browser-viewport"),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: nullableString,
  roundId: nullableString,
  stepId: z.string().min(1),
  capabilityCallId: z.string().min(1),
  nerveBusEnvelopeId: z.string().min(1),
  inputRef: z.string().min(1),
  browserSessionRef: z.string().min(1),
  privacyPolicy: z.string().min(1).optional(),
  capturePolicy: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
}).strict();

export type CaptureBrowserViewportInput = z.infer<typeof CaptureBrowserViewportInputSchema>;

export const CaptureBrowserViewportResultSchema = z.object({
  status: z.enum(SCREENSHOT_STATUSES),
  screenshotRef: z.string().min(1).optional(),
  // aiReadableImagePath — absolute file path for AI model image input
  aiReadableImagePath: z.string().min(1).optional(),
  artifactRef: ScreenshotArtifactRefSchema.optional(),
  imageWidth: finitePositive.optional(),
  imageHeight: finitePositive.optional(),
  viewportWidth: finitePositive.optional(),
  viewportHeight: finitePositive.optional(),
  mimeType: z.string().min(1).optional(),
  screenshotProof: ScreenshotProofSchema,
  failureReason: nullableString,
  reviewRequiredReason: nullableString,
}).strict();

export type CaptureBrowserViewportResult = z.infer<typeof CaptureBrowserViewportResultSchema>;

// ─── render-coordinate-grid ───────────────────────────────────────────────────

export const RenderCoordinateGridInputSchema = z.object({
  childCapabilityId: z.literal("render-coordinate-grid"),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: nullableString,
  roundId: nullableString,
  stepId: z.string().min(1),
  capabilityCallId: z.string().min(1),
  nerveBusEnvelopeId: z.string().min(1),
  inputRef: z.string().min(1),
  sourceScreenshotRef: z.string().min(1),
  sourceScreenshotProofRef: z.string().min(1),
  gridPolicy: z.object({
    rowCount: z.number().int().positive().default(VISUAL_MISSION_DEFAULT_GRID_ROWS),
    columnCount: z.number().int().positive().default(VISUAL_MISSION_DEFAULT_GRID_COLUMNS),
  }).optional(),
  idempotencyKey: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
}).strict();

export type RenderCoordinateGridInput = z.infer<typeof RenderCoordinateGridInputSchema>;

export const RenderCoordinateGridResultSchema = z.object({
  status: z.enum(SCREENSHOT_STATUSES),
  coordinateGridScreenshotRef: z.string().min(1).optional(),
  // aiReadableImagePath — absolute file path of grid image for AI model input
  aiReadableImagePath: z.string().min(1).optional(),
  coordinateGridArtifactRef: ScreenshotArtifactRefSchema.optional(),
  gridSpecRef: z.string().min(1).optional(),
  gridSpec: ScreenshotGridSpecSchema.optional(),
  gridRows: z.number().int().positive().optional(),
  gridColumns: z.number().int().positive().optional(),
  sourceScreenshotRef: z.string().min(1).optional(),
  screenshotProof: ScreenshotProofSchema,
  failureReason: nullableString,
  reviewRequiredReason: nullableString,
}).strict();

export type RenderCoordinateGridResult = z.infer<typeof RenderCoordinateGridResultSchema>;

// ─── capture-grid-region ─────────────────────────────────────────────────────

export const CaptureGridRegionInputSchema = z.object({
  childCapabilityId: z.literal("capture-grid-region"),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: nullableString,
  roundId: nullableString,
  stepId: z.string().min(1),
  capabilityCallId: z.string().min(1),
  nerveBusEnvelopeId: z.string().min(1),
  inputRef: z.string().min(1),
  sourceScreenshotRef: z.string().min(1),
  sourceScreenshotProofRef: z.string().min(1),
  gridSpecRef: z.string().min(1).optional(),
  regionGridCell: z.string().regex(/^[A-Z]+[1-9][0-9]*$/).optional(),
  bbox: z.object({
    x: finiteNonNeg,
    y: finiteNonNeg,
    width: finitePositive,
    height: finitePositive,
  }).strict().optional(),
  privacyPolicy: z.string().min(1).optional(),
  capturePolicy: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
}).strict();

export type CaptureGridRegionInput = z.infer<typeof CaptureGridRegionInputSchema>;

export const CaptureGridRegionResultSchema = z.object({
  status: z.enum(SCREENSHOT_STATUSES),
  regionScreenshotRef: z.string().min(1).optional(),
  regionArtifactRef: ScreenshotArtifactRefSchema.optional(),
  sourceScreenshotRef: z.string().min(1).optional(),
  screenshotProof: ScreenshotProofSchema,
  failureReason: nullableString,
  reviewRequiredReason: nullableString,
}).strict();

export type CaptureGridRegionResult = z.infer<typeof CaptureGridRegionResultSchema>;

// ─── discriminated union ──────────────────────────────────────────────────────

export const ScreenshotAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  CaptureBrowserViewportInputSchema,
  RenderCoordinateGridInputSchema,
  CaptureGridRegionInputSchema,
]);

export type ScreenshotAbilityInput = z.infer<typeof ScreenshotAbilityInputSchema>;

export type ScreenshotAbilityResult =
  | CaptureBrowserViewportResult
  | RenderCoordinateGridResult
  | CaptureGridRegionResult;

// ─── grid builder helpers (exported for grid-renderer) ────────────────────────

export function encodeRowLabel(index: number): string {
  let value = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

export function buildGridAxes(input: { rowCount: number; columnCount: number }) {
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

  const gridSpecId = `grid-spec:${createHash("sha256")
    .update(`${input.sourceScreenshotRef}:${input.gridImageWidth}:${input.gridImageHeight}:${input.rowCount}:${input.columnCount}`)
    .digest("hex")
    .slice(0, 24)}`;

  const cells: ScreenshotGridCell[] = [];
  for (let r = 0; r < rowLabels.length; r++) {
    for (let c = 0; c < columnLabels.length; c++) {
      const x = c * cellWidthPx;
      const y = r * cellHeightPx;
      cells.push({
        cellId: `${rowLabels[r]}${columnLabels[c]}`,
        rowLabel: rowLabels[r]!,
        columnLabel: columnLabels[c]!,
        rowIndex: r,
        columnIndex: c + 1,
        x,
        y,
        width: cellWidthPx,
        height: cellHeightPx,
        centerX: x + cellWidthPx / 2,
        centerY: y + cellHeightPx / 2,
      });
    }
  }

  return {
    gridSpecId,
    gridSpecRef: gridSpecId,
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

export function decodeGridCell(gridSpec: ScreenshotGridSpec, cellId: string): ScreenshotGridCell {
  const cell = gridSpec.cells.find((c) => c.cellId === cellId);
  if (!cell) throw new Error(`Unknown grid cell: ${cellId}`);
  return cell;
}
