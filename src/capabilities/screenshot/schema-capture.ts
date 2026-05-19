import { z } from "zod";

import {
  ScreenshotArtifactRefSchema,
  ScreenshotProofSchema,
} from "./schema-artifact.js";
import { SCREENSHOT_STATUSES } from "./schema-ids.js";

const nullableString = z.string().min(1).nullable().optional().default(null);
const finitePositive = z.number().finite().positive();
const finiteNonNeg = z.number().finite().nonnegative();

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

export type CaptureBrowserViewportInput = z.infer<
  typeof CaptureBrowserViewportInputSchema
>;

export const CaptureBrowserViewportResultSchema = z.object({
  status: z.enum(SCREENSHOT_STATUSES),
  screenshotRef: z.string().min(1).optional(),
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

export type CaptureBrowserViewportResult = z.infer<
  typeof CaptureBrowserViewportResultSchema
>;

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

export type CaptureGridRegionInput = z.infer<
  typeof CaptureGridRegionInputSchema
>;

export const CaptureGridRegionResultSchema = z.object({
  status: z.enum(SCREENSHOT_STATUSES),
  regionScreenshotRef: z.string().min(1).optional(),
  regionArtifactRef: ScreenshotArtifactRefSchema.optional(),
  sourceScreenshotRef: z.string().min(1).optional(),
  screenshotProof: ScreenshotProofSchema,
  failureReason: nullableString,
  reviewRequiredReason: nullableString,
}).strict();

export type CaptureGridRegionResult = z.infer<
  typeof CaptureGridRegionResultSchema
>;
