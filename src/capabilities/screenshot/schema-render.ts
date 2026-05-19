import { z } from "zod";

import { ScreenshotArtifactRefSchema } from "./schema-artifact.js";
import {
  VISUAL_MISSION_DEFAULT_GRID_COLUMNS,
  VISUAL_MISSION_DEFAULT_GRID_ROWS,
} from "./schema-grid.js";
import { ScreenshotGridSpecSchema } from "./schema-grid.js";
import { ScreenshotProofSchema } from "./schema-artifact.js";
import { SCREENSHOT_STATUSES } from "./schema-ids.js";

const nullableString = z.string().min(1).nullable().optional().default(null);

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

export type RenderCoordinateGridInput = z.infer<
  typeof RenderCoordinateGridInputSchema
>;

export const RenderCoordinateGridResultSchema = z.object({
  status: z.enum(SCREENSHOT_STATUSES),
  coordinateGridScreenshotRef: z.string().min(1).optional(),
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

export type RenderCoordinateGridResult = z.infer<
  typeof RenderCoordinateGridResultSchema
>;
