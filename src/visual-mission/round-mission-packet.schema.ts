import { z } from "zod";

import { VisualMissionPlatformSchema } from "./action-plan/ai-output.schema.js";

const nullableString = z.string().min(1).nullable().default(null);
const nonNegativeInteger = z.number().int().nonnegative();

const RoundMissionPacketMissionSchema = z.object({
  missionId: z.string().min(1),
  userRequirementRef: z.string().min(1),
  userRequirementText: z.string().min(1),
  requestedPlatformId: VisualMissionPlatformSchema,
  selectedPlatforms: z.array(VisualMissionPlatformSchema).min(1),
  targetUrl: nullableString,
  targetTitle: nullableString,
  targetProfileRef: nullableString,
}).strict();

const RoundMissionPacketRoundSchema = z.object({
  currentRoundIndex: nonNegativeInteger,
  currentStepId: nullableString,
  previousStepId: nullableString,
  hopCount: nonNegativeInteger,
}).strict();

const RoundMissionPacketProgressSchema = z.object({
  savedLeadCount: nonNegativeInteger.default(0),
  skippedCount: nonNegativeInteger.default(0),
  reviewRequiredCount: nonNegativeInteger.default(0),
  failedActionCount: nonNegativeInteger.default(0),
  consecutiveFailureCount: nonNegativeInteger.default(0),
}).strict();

const RoundMissionPacketLastActionSchema = z.object({
  sourceActionCode: nullableString,
  status: z.enum(["success", "failed", "review_required", "pending"]).default("pending"),
  gridCell: nullableString,
  targetName: nullableString,
  summary: nullableString,
  actionInputRef: nullableString,
  outputRef: nullableString,
  failureReason: nullableString,
  completedAt: nullableString,
}).strict();

const RoundMissionPacketCurrentEvidenceSchema = z.object({
  originalScreenshotRef: nullableString,
  coordinateGridScreenshotRef: nullableString,
  gridSpecRef: nullableString,
  visualMissionInputRef: nullableString,
  pageStateRef: nullableString,
  sourceAiResultRef: nullableString,
  postActionVerificationResultRef: nullableString,
}).strict();

const RoundMissionPacketPlatformContextSchema = z.object({
  platformId: VisualMissionPlatformSchema,
  selectedPlatforms: z.array(VisualMissionPlatformSchema).min(1),
  targetUrl: z.string().url(),
  targetTitle: z.string().min(1),
  targetProfileRef: nullableString,
}).strict();

const RoundMissionPacketConstraintsSchema = z.object({
  maxRounds: nonNegativeInteger.nullable().default(null),
  maxMinutes: nonNegativeInteger.nullable().default(null),
  failClosedOnReviewRequired: z.literal(true),
  humanMayOnlyRestartFromCommander: z.literal(true),
}).strict();

const RoundMissionPacketSchema = z.object({
  schemaVersion: z.literal("roundMissionPacket.v1"),
  mission: RoundMissionPacketMissionSchema,
  round: RoundMissionPacketRoundSchema,
  progress: RoundMissionPacketProgressSchema,
  lastAction: RoundMissionPacketLastActionSchema,
  currentEvidence: RoundMissionPacketCurrentEvidenceSchema,
  platformContext: RoundMissionPacketPlatformContextSchema,
  constraints: RoundMissionPacketConstraintsSchema,
  allowedActions: z.array(z.string().min(1)).default([]),
}).strict();

type RoundMissionPacket = z.infer<typeof RoundMissionPacketSchema>;
type RoundMissionPacketMission = z.infer<typeof RoundMissionPacketMissionSchema>;
type RoundMissionPacketRound = z.infer<typeof RoundMissionPacketRoundSchema>;
type RoundMissionPacketProgress = z.infer<typeof RoundMissionPacketProgressSchema>;
type RoundMissionPacketLastAction = z.infer<typeof RoundMissionPacketLastActionSchema>;
type RoundMissionPacketCurrentEvidence = z.infer<typeof RoundMissionPacketCurrentEvidenceSchema>;
type RoundMissionPacketPlatformContext = z.infer<typeof RoundMissionPacketPlatformContextSchema>;
type RoundMissionPacketConstraints = z.infer<typeof RoundMissionPacketConstraintsSchema>;

export {
  RoundMissionPacketMissionSchema,
  RoundMissionPacketRoundSchema,
  RoundMissionPacketProgressSchema,
  RoundMissionPacketLastActionSchema,
  RoundMissionPacketCurrentEvidenceSchema,
  RoundMissionPacketPlatformContextSchema,
  RoundMissionPacketConstraintsSchema,
  RoundMissionPacketSchema,
};

export type {
  RoundMissionPacket,
  RoundMissionPacketMission,
  RoundMissionPacketRound,
  RoundMissionPacketProgress,
  RoundMissionPacketLastAction,
  RoundMissionPacketCurrentEvidence,
  RoundMissionPacketPlatformContext,
  RoundMissionPacketConstraints,
};
