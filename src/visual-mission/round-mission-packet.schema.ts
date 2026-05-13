import { z } from "zod";

import { VISUAL_MISSION_PLATFORM_IDS } from "./platform-target-registry.js";

const nullableString = z.string().min(1).nullable().default(null);
const nonNegativeInteger = z.number().int().nonnegative();
const VisualMissionPlatformSchema = z.enum(VISUAL_MISSION_PLATFORM_IDS);
const nullablePositiveInteger = z.number().int().positive().nullable().default(null);

const RoundMissionPacketMissionSchema = z.object({
  missionId: z.string().min(1),
  userRequirementRef: nullableString,
  userRequirementText: z.string().min(1),
  requestedPlatformId: VisualMissionPlatformSchema,
  selectedPlatforms: z.array(VisualMissionPlatformSchema).min(1),
  maxRounds: nullablePositiveInteger,
  maxMinutes: nullablePositiveInteger,
}).strict();

const RoundMissionPacketRoundSchema = z.object({
  roundId: nullableString,
  roundIndex: nonNegativeInteger,
  previousRoundId: nullableString,
  currentPhase: nullableString,
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
  status: z.enum(["success", "failed", "review_required", "pending"]).nullable().default("pending"),
  failureReason: nullableString,
  outputRef: nullableString,
  gridCell: nullableString,
  targetName: nullableString,
  summary: nullableString,
  actionInputRef: nullableString,
  completedAt: nullableString,
}).strict();

const RoundMissionPacketCurrentEvidenceSchema = z.object({
  originalScreenshotRef: nullableString,
  coordinateGridScreenshotRef: nullableString,
  gridSpecRef: nullableString,
  visualMissionInputRef: nullableString,
  aiResultRef: nullableString,
}).strict();

const RoundMissionPacketPlatformContextSchema = z.object({
  platformContextRef: nullableString,
  platformId: VisualMissionPlatformSchema,
  targetUrl: nullableString,
  targetTitle: nullableString,
  targetProfileRef: nullableString,
}).strict();

const RoundMissionPacketConstraintsSchema = z.object({
  noHumanInLoop: z.literal(true),
  requireCoordinateGridForVisualActions: z.literal(true),
  noRawCoordinates: z.literal(true),
  stopWhenBlocked: z.literal(true),
  stopWhenUnsafe: z.literal(true),
}).strict();

const RoundMissionPacketAllowedActionsSchema = z.object({
  systemManualRef: z.string().min(1),
  catalogVersion: z.string().min(1),
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
  allowedActions: RoundMissionPacketAllowedActionsSchema,
}).strict();

type RoundMissionPacket = z.infer<typeof RoundMissionPacketSchema>;
type RoundMissionPacketMission = z.infer<typeof RoundMissionPacketMissionSchema>;
type RoundMissionPacketRound = z.infer<typeof RoundMissionPacketRoundSchema>;
type RoundMissionPacketProgress = z.infer<typeof RoundMissionPacketProgressSchema>;
type RoundMissionPacketLastAction = z.infer<typeof RoundMissionPacketLastActionSchema>;
type RoundMissionPacketCurrentEvidence = z.infer<typeof RoundMissionPacketCurrentEvidenceSchema>;
type RoundMissionPacketPlatformContext = z.infer<typeof RoundMissionPacketPlatformContextSchema>;
type RoundMissionPacketConstraints = z.infer<typeof RoundMissionPacketConstraintsSchema>;
type RoundMissionPacketAllowedActions = z.infer<typeof RoundMissionPacketAllowedActionsSchema>;

export {
  RoundMissionPacketMissionSchema,
  RoundMissionPacketRoundSchema,
  RoundMissionPacketProgressSchema,
  RoundMissionPacketLastActionSchema,
  RoundMissionPacketCurrentEvidenceSchema,
  RoundMissionPacketPlatformContextSchema,
  RoundMissionPacketConstraintsSchema,
  RoundMissionPacketAllowedActionsSchema,
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
  RoundMissionPacketAllowedActions,
};
