import { z } from "zod";

// --- Identity ---

export const ORCHESTRATION_ABILITY_GROUP_ID = "orchestration" as const;

// --- Platform ---

export const OrchestrationRequestedPlatformIdSchema = z.enum([
  "facebook-web",
  "tiktok-web",
  "macos-local",
  "iphone-mirroring-facebook-app",
  "iphone-mirroring-tiktok-app",
]);

// --- Child capability ids ---

export const ORCHESTRATION_CHILD_CAPABILITY_IDS = [
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "dispatch-registered-ability-sequence",
  "finalize-mission",
] as const;

export const OrchestrationChildCapabilityIdSchema = z.enum(ORCHESTRATION_CHILD_CAPABILITY_IDS);

// --- Mission status ---

export const MissionStatusSchema = z.enum([
  "idle",
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "review_required",
  "stopped",
]);

// --- Last human command ---

export const MissionLastHumanCommandSchema = z.enum([
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
]).nullable();

// --- Mission state ---

export const MissionStateSchema = z.object({
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1).nullable().optional().default(null),
  status: MissionStatusSchema,
  humanGoal: z.string().nullable().optional().default(null),
  requestedPlatform: OrchestrationRequestedPlatformIdSchema.nullable().optional().default(null),
  selectedPlatforms: z.array(z.string()).default([]),
  maxRounds: z.number().int().positive().nullable().optional().default(null),
  maxMinutes: z.number().int().positive().nullable().optional().default(null),
  roundIndex: z.number().int().nonnegative().default(0),
  activeRunId: z.string().min(1).nullable().optional().default(null),
  // Platform target fields — preserved from binding at mission start
  targetProfileRef: z.string().min(1).nullable().optional().default(null),
  targetUrl: z.string().min(1).nullable().optional().default(null),
  targetTitle: z.string().min(1).nullable().optional().default(null),
  // Open gate — set after OPEN_PLATFORM_ENTRY_ONCE succeeds in round 0
  openResultRef: z.string().min(1).nullable().optional().default(null),
  // Progress counters — state-derived, updated after each round
  savedEvidenceCount: z.number().int().nonnegative().default(0),
  skippedVideoCount: z.number().int().nonnegative().default(0),
  failedActionCount: z.number().int().nonnegative().default(0),
  reviewRequiredCount: z.number().int().nonnegative().default(0),
  consecutiveFailureCount: z.number().int().nonnegative().default(0),
  reviewRequiredReason: z.string().nullable().optional().default(null),
  stopReason: z.string().nullable().optional().default(null),
  failureReason: z.string().nullable().optional().default(null),
  lastHumanCommand: MissionLastHumanCommandSchema.optional().default(null),
  startedAt: z.string().nullable().optional().default(null),
  updatedAt: z.string(),
  endedAt: z.string().nullable().optional().default(null),
}).strict();

// --- Mission command (input to start-mission) ---

export const MissionCommandSchema = z.object({
  missionId: z.string().min(1),
  runId: z.string().min(1),
  humanGoal: z.string().min(1),
  requestedPlatform: z.string().min(1),
  selectedPlatforms: z.array(z.string()).optional().default([]),
  maxRounds: z.number().int().positive().nullable().optional().default(null),
  maxMinutes: z.number().int().positive().nullable().optional().default(null),
  initialPayload: z.object({
    requestedBy: z.string().min(1),
    userRequirementRef: z.string().min(1).nullable().optional().default(null),
    primaryPlatformId: z.string().min(1).nullable().optional().default(null),
    selectedPlatforms: z.array(z.string()).optional().default([]),
    operatorNote: z.string().min(1).nullable().optional().default(null),
    targetUrl: z.string().min(1).nullable().optional().default(null),
    targetTitle: z.string().min(1).nullable().optional().default(null),
    targetProfileRef: z.string().min(1).nullable().optional().default(null),
    sourceEvidenceRef: z.string().min(1).nullable().optional().default(null),
    sourceTargetRef: z.string().min(1).nullable().optional().default(null),
    promptInputRef: z.string().min(1).nullable().optional().default(null),
    commandInputRef: z.string().min(1).nullable().optional().default(null),
  }).strict().optional().default({ requestedBy: "commander-console" }),
}).strict();

// --- Execution input / result (generic child capability dispatch) ---

export const OrchestrationExecuteInputSchema = z.discriminatedUnion("childCapabilityId", [
  z.object({ childCapabilityId: z.literal("start-mission"), payload: z.unknown() }),
  z.object({ childCapabilityId: z.literal("pause-mission"), payload: z.unknown() }),
  z.object({ childCapabilityId: z.literal("resume-mission"), payload: z.unknown() }),
  z.object({ childCapabilityId: z.literal("stop-mission"), payload: z.unknown() }),
  z.object({ childCapabilityId: z.literal("emergency-stop"), payload: z.unknown() }),
  z.object({ childCapabilityId: z.literal("dispatch-registered-ability-sequence"), payload: z.unknown() }),
  z.object({ childCapabilityId: z.literal("finalize-mission"), payload: z.unknown() }),
]);

export const OrchestrationExecuteResultSchema = z.object({
  status: z.enum(["success", "failed", "review_required"]),
  stateSnapshot: MissionStateSchema,
  failureReason: z.string().nullable().optional().default(null),
  reviewRequiredReason: z.string().nullable().optional().default(null),
});

// --- Child schemas ---

export const StartMissionChildInputSchema = MissionCommandSchema;
export const StartMissionChildOutputSchema = MissionStateSchema;

export const PauseMissionChildInputSchema = z.object({
  missionId: z.string().min(1),
  reason: z.string().nullable().optional().default(null),
  note: z.string().nullable().optional().default(null),
}).strict();
export const PauseMissionChildOutputSchema = MissionStateSchema;

export const ResumeMissionChildInputSchema = z.object({
  missionId: z.string().min(1),
  reason: z.string().nullable().optional().default(null),
  note: z.string().nullable().optional().default(null),
}).strict();
export const ResumeMissionChildOutputSchema = MissionStateSchema;

export const StopMissionChildInputSchema = z.object({
  missionId: z.string().min(1),
  reason: z.string().nullable().optional().default(null),
  note: z.string().nullable().optional().default(null),
}).strict();
export const StopMissionChildOutputSchema = MissionStateSchema;

export const EmergencyStopChildInputSchema = z.object({
  missionId: z.string().min(1),
  reason: z.string().nullable().optional().default(null),
  note: z.string().nullable().optional().default(null),
}).strict();
export const EmergencyStopChildOutputSchema = MissionStateSchema;

export const DispatchRegisteredAbilitySequenceInputSchema = z.object({
  missionId: z.string().min(1),
  runId: z.string().min(1),
  roundId: z.string().min(1).nullable().optional().default(null),
  aiResultRef: z.string().min(1).nullable().optional().default(null),
  actions: z.array(z.object({
    actionCode: z.string().min(1),
    reason: z.string().nullable().optional().default(null),
    abilityGroupId: z.string().min(1).nullable().optional().default(null),
    childCapabilityId: z.string().min(1).nullable().optional().default(null),
    inputOverrides: z.record(z.unknown()).optional().default({}),
    required: z.boolean().optional().default(true),
    requiresGeometryProof: z.boolean().optional().default(false),
    gridCell: z.string().min(1).nullable().optional().default(null),
  })).default([]),
  currentEvidenceRefs: z.record(z.string().min(1)).optional().default({}),
}).strict();
export const DispatchRegisteredAbilitySequenceOutputSchema = MissionStateSchema;

export const FinalizeMissionChildInputSchema = z.object({
  missionId: z.string().min(1),
  reason: z.string().nullable().optional().default(null),
  note: z.string().nullable().optional().default(null),
}).strict();
export const FinalizeMissionChildOutputSchema = MissionStateSchema;

// --- Proof ---

export const OrchestrationProofSchema = z.object({
  proofId: z.string().min(1),
  abilityGroupId: z.literal("orchestration"),
  childCapabilityId: OrchestrationChildCapabilityIdSchema,
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1).nullable().optional().default(null),
  roundId: z.string().min(1).nullable().optional().default(null),
  status: z.enum(["success", "failed", "review_required"]),
  aiResultRef: z.string().min(1).nullable().optional().default(null),
  forensicsRecordRefs: z.array(z.string().min(1)).optional().default([]),
  failureReason: z.string().nullable().optional().default(null),
  reviewRequiredReason: z.string().nullable().optional().default(null),
  startedAt: z.string(),
  endedAt: z.string(),
  durationMs: z.number().int().nonnegative(),
}).strict();
