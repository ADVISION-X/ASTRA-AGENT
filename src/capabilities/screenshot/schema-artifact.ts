import { z } from "zod";

import {
  SCREENSHOT_ABILITY_GROUP_ID,
  SCREENSHOT_CHILD_IDS,
  SCREENSHOT_STATUSES,
} from "./schema-ids.js";

const isoDate = z.string().datetime();
const nullableString = z.string().min(1).nullable().optional().default(null);

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

export type ScreenshotStructuredRef = z.infer<
  typeof ScreenshotStructuredRefSchema
>;

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
