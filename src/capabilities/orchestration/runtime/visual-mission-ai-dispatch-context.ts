import { listAiPlanEligibleActions } from "../../../muscle-memory/catalog.js";
import { buildMuscleMemorySystemManual } from "../../../muscle-memory/system-manual.js";
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

const buildPlatformContext = (state: MissionState) => {
  if (!state.requestedPlatform) {
    return null;
  }

  const targetUrl = readPayloadRefString(state, "targetUrl");
  const targetTitle = readPayloadRefString(state, "targetTitle");
  if (!targetUrl || !targetTitle) {
    return null;
  }

  return {
    platformId: state.requestedPlatform,
    selectedPlatforms: resolveSelectedPlatforms(state),
    targetUrl,
    targetTitle,
    targetProfileRef: readPayloadRefString(state, "targetProfileRef"),
  };
};

const buildRoundMissionPacketValue = (input: {
  state: MissionState;
  promptContract: PromptContractCatalogEntry;
}) => {
  if (!input.state.missionId || !input.state.requestedPlatform || !input.state.userRequirementRef || !input.state.humanGoal) {
    return null;
  }

  const platformContext = buildPlatformContext(input.state);
  if (!platformContext) {
    return null;
  }

  return buildRoundMissionPacket({
    mission: {
      missionId: input.state.missionId,
      userRequirementRef: input.state.userRequirementRef,
      userRequirementText: input.state.humanGoal,
      requestedPlatformId: input.state.requestedPlatform,
      selectedPlatforms: resolveSelectedPlatforms(input.state),
      targetUrl: readPayloadRefString(input.state, "targetUrl"),
      targetTitle: readPayloadRefString(input.state, "targetTitle"),
      targetProfileRef: readPayloadRefString(input.state, "targetProfileRef"),
    },
    round: {
      currentRoundIndex: input.state.currentRoundIndex,
      currentStepId: input.state.currentStepId,
      previousStepId: input.state.previousStepId,
      hopCount: input.state.hopCount,
    },
    progress: input.state.roundProgress,
    lastAction: input.state.lastActionSummary,
    currentEvidence: {
      originalScreenshotRef: readPayloadRefString(input.state, "originalScreenshotRef"),
      coordinateGridScreenshotRef: readPayloadRefString(input.state, "coordinateGridScreenshotRef"),
      gridSpecRef: readPayloadRefString(input.state, "gridSpecRef"),
      visualMissionInputRef: readPayloadRefString(input.state, "visualMissionInputRef"),
      pageStateRef: readPayloadRefString(input.state, "pageStateRef"),
      sourceAiResultRef: readPayloadRefString(input.state, "sourceAiResultRef"),
      postActionVerificationResultRef: readPayloadRefString(input.state, "postActionVerificationResultRef"),
    },
    platformContext,
    constraints: {
      maxRounds: input.state.configuredMaxRounds,
      maxMinutes: input.state.configuredMaxMinutes,
      failClosedOnReviewRequired: true,
      humanMayOnlyRestartFromCommander: true,
    },
    allowedActions: listAiPlanEligibleActions().map((entry) => entry.actionCode),
  });
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
    return buildRoundMissionPacketValue(input) ? buildRoundMissionPacketRef(input.state) : null;
  }

  return null;
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
  const roundMissionPacket = buildRoundMissionPacketValue(input);
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
