import { z } from "zod";

import {
  SCREENSHOT_CHILD_CAPABILITY_IDS,
  SCREENSHOT_PROMOTION_STATUSES,
  SCREENSHOT_RETENTION_CLASSES,
} from "./screenshot-types.js";

const nonNegativeInt = z.number().int().nonnegative();
const positiveInt = z.number().int().positive();
const nullableDateTime = z.string().datetime().nullable().default(null);

export const SCREENSHOT_ARTIFACT_LIFECYCLE_MANIFEST_VERSION = "GRASSEYE-SCREENSHOT-ARTIFACT-LIFECYCLE-V1" as const;

const ScreenshotRetentionClassSchema = z.enum(SCREENSHOT_RETENTION_CLASSES);

const ScreenshotPromotionStatusSchema = z.enum(SCREENSHOT_PROMOTION_STATUSES);

const ScreenshotArtifactBudgetPolicySchema = z.object({
  maxArtifactsPerMission: positiveInt,
  maxArtifactsPerRound: positiveInt,
  maxArtifactsPerVideoVisit: positiveInt,
  maxBytesPerMission: positiveInt,
  maxBytesPerRound: positiveInt,
  maxBytesPerVideoVisit: positiveInt,
  maxPendingTransientBytes: positiveInt,
  maxPendingTransientArtifacts: positiveInt,
  transientTtlHours: positiveInt,
  diagnosticDebugTtlHours: positiveInt,
}).strict();

const ScreenshotArtifactBudgetSnapshotSchema = z.object({
  currentArtifactsPerMission: nonNegativeInt,
  currentArtifactsPerRound: nonNegativeInt,
  currentArtifactsPerVideoVisit: nonNegativeInt,
  currentBytesPerMission: nonNegativeInt,
  currentBytesPerRound: nonNegativeInt,
  currentBytesPerVideoVisit: nonNegativeInt,
  pendingTransientBytes: nonNegativeInt,
  pendingTransientArtifacts: nonNegativeInt,
}).strict();

const ScreenshotArtifactCleanupGateSchema = z.object({
  manifestExists: z.boolean().default(true),
  expired: z.boolean().default(false),
  missionActive: z.boolean().default(true),
  aiPending: z.boolean().default(false),
  visualTargetPending: z.boolean().default(false),
  postActionVerificationPending: z.boolean().default(false),
  promoted: z.boolean().default(false),
  pinnedByForensics: z.boolean().default(false),
  legalHold: z.boolean().default(false),
  refCount: nonNegativeInt.default(1),
}).strict();

const ScreenshotArtifactLifecycleManifestSchema = z.object({
  manifestVersion: z.literal(SCREENSHOT_ARTIFACT_LIFECYCLE_MANIFEST_VERSION),
  artifactLifecycleManifestRef: z.string().min(1),
  artifactId: z.string().min(1),
  evidenceId: z.string().min(1),
  childCapabilityId: z.enum(SCREENSHOT_CHILD_CAPABILITY_IDS),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1).nullable().default(null),
  videoVisitId: z.string().min(1).nullable().default(null),
  stepId: z.string().min(1),
  capabilityCallId: z.string().min(1),
  nerveBusEnvelopeId: z.string().min(1),
  mapPackageId: z.string().min(1),
  mapPackageVersion: z.string().min(1),
  selectedMapId: z.string().min(1),
  selectedMapVersion: z.string().min(1),
  activationSnapshotRef: z.string().min(1),
  requestedBy: z.string().min(1),
  purpose: z.string().min(1),
  storageRef: z.string().min(1),
  artifactHash: z.string().min(1),
  byteSize: nonNegativeInt,
  retentionClass: ScreenshotRetentionClassSchema,
  promotionStatus: ScreenshotPromotionStatusSchema,
  createdAt: z.string().datetime(),
  expiresAt: nullableDateTime,
  deleteAfter: nullableDateTime,
  cleanupEligible: z.boolean().default(false),
  cleanupGate: ScreenshotArtifactCleanupGateSchema,
}).strict();

export {
  ScreenshotArtifactBudgetPolicySchema,
  ScreenshotArtifactBudgetSnapshotSchema,
  ScreenshotArtifactCleanupGateSchema,
  ScreenshotArtifactLifecycleManifestSchema,
  ScreenshotPromotionStatusSchema,
  ScreenshotRetentionClassSchema,
};