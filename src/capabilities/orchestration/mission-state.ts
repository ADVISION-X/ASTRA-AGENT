import type { AbilityTargetId } from "../nerve-bus/index.js";
import type { MapDebugProof, MissionCommand, MissionState } from "./contract.js";
import type { BranchResult } from "./shared/branch-result.js";
import type { OperationalMap } from "./shared/map-types.js";

export function createMissionState(command: MissionCommand, map: OperationalMap): MissionState {
  return {
    missionId: command.missionId,
    mapId: map.mapId,
    humanGoal: command.humanGoal,
    currentStepId: map.initialStepId,
    previousStepId: null,
    status: "running",
    selectedAbilityGroupId: null,
    lastCommandId: null,
    lastResultId: null,
    branchTaken: null,
    visitedStepIds: [],
  };
}

export function advanceMissionState(input: {
  missionState: MissionState;
  selectedAbilityGroupId: AbilityTargetId;
  commandId: string;
  resultId: string;
  branch: BranchResult;
}): MissionState {
  return {
    ...input.missionState,
    previousStepId: input.missionState.currentStepId,
    currentStepId: input.branch.nextStepId,
    status: input.branch.status,
    selectedAbilityGroupId: input.selectedAbilityGroupId,
    lastCommandId: input.commandId,
    lastResultId: input.resultId,
    branchTaken: input.branch.branchTaken,
    visitedStepIds: input.missionState.currentStepId
      ? [...input.missionState.visitedStepIds, input.missionState.currentStepId]
      : [...input.missionState.visitedStepIds],
  };
}

export function createMapDebugProof(input: {
  missionState: MissionState;
  map: OperationalMap;
  selectedAbilityGroupId: AbilityTargetId;
  commandId: string;
  resultId: string;
  branch: BranchResult;
}): MapDebugProof {
  if (!input.missionState.currentStepId) {
    throw new Error(`Mission ${input.missionState.missionId} has no current step for proof generation.`);
  }

  return {
    missionId: input.missionState.missionId,
    mapId: input.map.mapId,
    currentStepId: input.missionState.currentStepId,
    previousStepId: input.missionState.previousStepId,
    selectedAbilityGroupId: input.selectedAbilityGroupId,
    commandId: input.commandId,
    resultId: input.resultId,
    branchTaken: input.branch.branchTaken,
    conditionEvaluated: input.branch.conditionEvaluated,
    status: input.branch.status,
    failureReason: input.branch.failureReason,
    nextStepId: input.branch.nextStepId,
  };
}