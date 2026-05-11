import { buildMuscleMemorySystemManual } from "../../../muscle-memory/manual.js";
import { buildRoundMissionPacket } from "../../../visual-mission/round-mission-packet-builder.js";
import { recordRoundMissionPacket } from "../../../visual-mission/round-mission-packet-store.js";
import type { PromptContractCatalogEntry } from "../../ai/prompt-contracts/schema.js";
import type { MissionState } from "../contract.js";

const readPayloadRefString = (state: MissionState, key: keyof MissionState["payloadRefs"]): string | null => {
  const value = state.payloadRefs[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const resolveSelectedPlatforms = (state: MissionState) => (
  state.selectedPlatforms.length > 0
    ? state.selectedPlatforms
    : state.requestedPlatform
      ? [state.requestedPlatform]
      : []
);

const buildPlatformContextRef = (state: MissionState) =>
  state.missionId ? `${state.missionId}:platform-context` : null;

const buildRoundMissionPacketRef = (state: MissionState) =>
  state.missionId ? `${state.missionId}:round-mission-packet:${state.currentRoundIndex}:${state.stateRevision}` : null;

const buildRoundId = (state: MissionState) => (
  state.missionId ? `${state.missionId}:round:${state.currentRoundIndex}` : null
);

const buildPreviousRoundId = (state: MissionState) => (
  state.missionId && state.currentRoundIndex > 0
    ? `${state.missionId}:round:${state.currentRoundIndex - 1}`
    : null
);

const buildPlatformContext = (state: MissionState) => {
  if (!state.requestedPlatform) {
    return null;
  }

  return {
    platformContextRef: buildPlatformContextRef(state),
    platformId: state.requestedPlatform,
    targetUrl: readPayloadRefString(state, "targetUrl"),
    targetTitle: readPayloadRefString(state, "targetTitle"),
    targetProfileRef: readPayloadRefString(state, "targetProfileRef"),
  };
};

const hasRoundMissionPacketPrereqs = (state: MissionState) =>
  Boolean(state.missionId && state.requestedPlatform && state.humanGoal);

const buildRoundMissionMissionPayload = (state: MissionState) => ({
  missionId: state.missionId!,
  userRequirementRef: state.userRequirementRef ?? null,
  userRequirementText: state.humanGoal!,
  requestedPlatformId: state.requestedPlatform!,
  selectedPlatforms: resolveSelectedPlatforms(state),
  maxRounds: state.configuredMaxRounds,
  maxMinutes: state.configuredMaxMinutes,
});

const buildRoundMissionRoundPayload = (state: MissionState) => ({
  roundId: buildRoundId(state),
  roundIndex: state.currentRoundIndex,
  previousRoundId: buildPreviousRoundId(state),
  currentPhase: state.currentStepId,
});

const buildRoundMissionCurrentEvidencePayload = (state: MissionState) => ({
  originalScreenshotRef: readPayloadRefString(state, "originalScreenshotRef"),
  coordinateGridScreenshotRef: readPayloadRefString(state, "coordinateGridScreenshotRef"),
  gridSpecRef: readPayloadRefString(state, "gridSpecRef"),
  visualMissionInputRef: readPayloadRefString(state, "visualMissionInputRef"),
  pageStateRef: readPayloadRefString(state, "pageStateRef"),
  aiResultRef: readPayloadRefString(state, "sourceAiResultRef") ?? readPayloadRefString(state, "aiResultRef"),
  postActionVerificationResultRef: readPayloadRefString(state, "postActionVerificationResultRef"),
});

const buildRoundMissionConstraintsPayload = () => ({
  noHumanInLoop: true as const,
  requireCoordinateGridForVisualActions: true as const,
  noRawCoordinates: true as const,
  stopWhenBlocked: true as const,
  stopWhenUnsafe: true as const,
});

const buildAllowedActions = (systemManual: ReturnType<typeof buildMuscleMemorySystemManual>) => ({
  systemManualRef: systemManual.systemManualRef,
  catalogVersion: systemManual.catalogVersion,
});

const buildRoundMissionPacketValue = (input: {
  state: MissionState;
  systemManual?: ReturnType<typeof buildMuscleMemorySystemManual>;
}) => {
  if (!hasRoundMissionPacketPrereqs(input.state)) {
    return null;
  }

  const platformContext = buildPlatformContext(input.state);
  if (!platformContext) {
    return null;
  }

  return buildRoundMissionPacket({
    mission: buildRoundMissionMissionPayload(input.state),
    round: buildRoundMissionRoundPayload(input.state),
    progress: input.state.roundProgress,
    lastAction: input.state.lastActionSummary,
    currentEvidence: buildRoundMissionCurrentEvidencePayload(input.state),
    platformContext,
    constraints: buildRoundMissionConstraintsPayload(),
    allowedActions: buildAllowedActions(input.systemManual ?? buildMuscleMemorySystemManual()),
  });
};

const resolveVisualMissionPayloadRefValue = (input: {
  state: MissionState;
  promptContract: PromptContractCatalogEntry;
  key: string;
}) => {
  if (input.key === "systemManualRef") {
    return buildMuscleMemorySystemManual().systemManualRef;
  }
  if (input.key === "outputSchemaRef") {
    return input.promptContract.outputSchemaRef;
  }
  if (input.key === "platformContextRef") {
    return buildPlatformContext(input.state) ? buildPlatformContextRef(input.state) : null;
  }
  if (input.key === "roundMissionPacketRef") {
    return buildRoundMissionPacketValue({ state: input.state }) ? buildRoundMissionPacketRef(input.state) : null;
  }

  return null;
};

export function resolveAiDispatchPayloadRefValue(input: {
  state: MissionState;
  promptContract: PromptContractCatalogEntry;
  key: string;
}): string | null {
  const payloadKey = input.key as keyof MissionState["payloadRefs"];
  const directValue = readPayloadRefString(input.state, payloadKey);
  if (directValue) {
    return directValue;
  }

  if (input.promptContract.taskType !== "visual_mission_action_plan") {
    return null;
  }

  return resolveVisualMissionPayloadRefValue(input);
}

export function buildAiDispatchAugmentation(input: {
  state: MissionState;
  promptContract: PromptContractCatalogEntry;
}) {
  if (input.promptContract.taskType !== "visual_mission_action_plan") {
    return {
      payloadRefs: input.state.payloadRefs,
      dispatchInput: undefined,
    };
  }

  const systemManual = buildMuscleMemorySystemManual();
  const platformContext = buildPlatformContext(input.state);
  const roundMissionPacket = buildRoundMissionPacketValue({
    state: input.state,
    systemManual,
  });
  const roundMissionPacketRef = roundMissionPacket ? buildRoundMissionPacketRef(input.state) : null;
  if (roundMissionPacketRef && roundMissionPacket) {
    recordRoundMissionPacket(roundMissionPacketRef, roundMissionPacket);
  }

  return {
    payloadRefs: {
      ...input.state.payloadRefs,
      systemManualRef: systemManual.systemManualRef,
      outputSchemaRef: input.promptContract.outputSchemaRef,
      platformContextRef: platformContext ? buildPlatformContextRef(input.state) : null,
      roundMissionPacketRef,
    },
    dispatchInput: {
      userRequirementText: input.state.humanGoal,
      platformContextJson: platformContext ? JSON.stringify(platformContext) : null,
      roundMissionPacketJson: roundMissionPacket ? JSON.stringify(roundMissionPacket) : null,
    },
  };
}
