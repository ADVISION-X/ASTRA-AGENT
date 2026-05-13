import {
  RoundMissionPacketSchema,
  type RoundMissionPacket,
  type RoundMissionPacketAllowedActions,
  type RoundMissionPacketConstraints,
  type RoundMissionPacketCurrentEvidence,
  type RoundMissionPacketLastAction,
  type RoundMissionPacketMission,
  type RoundMissionPacketPlatformContext,
  type RoundMissionPacketProgress,
  type RoundMissionPacketRound,
} from "./round-mission-packet.schema.js";

const dedupeStrings = (values: string[]) => Array.from(new Set(values));

const normalizeSelectedPlatforms = (input: {
  requestedPlatformId: RoundMissionPacketMission["requestedPlatformId"];
  selectedPlatforms: RoundMissionPacketMission["selectedPlatforms"];
}): RoundMissionPacketMission["selectedPlatforms"] => {
  const mergedPlatforms = dedupeStrings([input.requestedPlatformId, ...input.selectedPlatforms]);
  return mergedPlatforms as RoundMissionPacketMission["selectedPlatforms"];
};

const buildMission = (mission: RoundMissionPacketMission): RoundMissionPacketMission => ({
  ...mission,
  selectedPlatforms: normalizeSelectedPlatforms({
    requestedPlatformId: mission.requestedPlatformId,
    selectedPlatforms: mission.selectedPlatforms,
  }),
});

const buildProgress = (progress?: Partial<RoundMissionPacketProgress>): RoundMissionPacketProgress => ({
  savedLeadCount: progress?.savedLeadCount ?? 0,
  skippedCount: progress?.skippedCount ?? 0,
  reviewRequiredCount: progress?.reviewRequiredCount ?? 0,
  failedActionCount: progress?.failedActionCount ?? 0,
  consecutiveFailureCount: progress?.consecutiveFailureCount ?? 0,
});

const buildLastAction = (lastAction?: Partial<RoundMissionPacketLastAction>): RoundMissionPacketLastAction => ({
  sourceActionCode: lastAction?.sourceActionCode ?? null,
  status: lastAction?.status ?? "pending",
  failureReason: lastAction?.failureReason ?? null,
  outputRef: lastAction?.outputRef ?? null,
  gridCell: lastAction?.gridCell ?? null,
  targetName: lastAction?.targetName ?? null,
  summary: lastAction?.summary ?? null,
  actionInputRef: lastAction?.actionInputRef ?? null,
  completedAt: lastAction?.completedAt ?? null,
});

const buildCurrentEvidence = (currentEvidence: RoundMissionPacketCurrentEvidence): RoundMissionPacketCurrentEvidence => ({
  originalScreenshotRef: currentEvidence.originalScreenshotRef ?? null,
  coordinateGridScreenshotRef: currentEvidence.coordinateGridScreenshotRef ?? null,
  gridSpecRef: currentEvidence.gridSpecRef ?? null,
  visualMissionInputRef: currentEvidence.visualMissionInputRef ?? null,
  aiResultRef: currentEvidence.aiResultRef ?? null,
});

const buildPlatformContext = (platformContext: RoundMissionPacketPlatformContext): RoundMissionPacketPlatformContext => ({
  platformContextRef: platformContext.platformContextRef ?? null,
  platformId: platformContext.platformId,
  targetUrl: platformContext.targetUrl ?? null,
  targetTitle: platformContext.targetTitle ?? null,
  targetProfileRef: platformContext.targetProfileRef ?? null,
});

const buildConstraints = (constraints: RoundMissionPacketConstraints): RoundMissionPacketConstraints => constraints;
const buildAllowedActions = (allowedActions: RoundMissionPacketAllowedActions): RoundMissionPacketAllowedActions => allowedActions;

export function buildRoundMissionPacket(input: {
  mission: RoundMissionPacketMission;
  round: RoundMissionPacketRound;
  progress?: Partial<RoundMissionPacketProgress>;
  lastAction?: Partial<RoundMissionPacketLastAction>;
  currentEvidence: RoundMissionPacketCurrentEvidence;
  platformContext: RoundMissionPacketPlatformContext;
  constraints: RoundMissionPacketConstraints;
  allowedActions: RoundMissionPacketAllowedActions;
}): RoundMissionPacket {
  return RoundMissionPacketSchema.parse({
    schemaVersion: "roundMissionPacket.v1",
    mission: buildMission(input.mission),
    round: input.round,
    progress: buildProgress(input.progress),
    lastAction: buildLastAction(input.lastAction),
    currentEvidence: buildCurrentEvidence(input.currentEvidence),
    platformContext: buildPlatformContext(input.platformContext),
    constraints: buildConstraints(input.constraints),
    allowedActions: buildAllowedActions(input.allowedActions),
  });
}
