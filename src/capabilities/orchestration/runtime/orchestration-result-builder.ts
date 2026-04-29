import type { MissionExecutionResult, MissionState, MissionStepResult, RuntimeProof } from "../contract.js";
import { MissionExecutionResultSchema, MissionStateSchema } from "../schema.js";

export function buildMissionStateUpdate(state: MissionState): MissionState {
  return MissionStateSchema.parse(state);
}

export function buildMissionExecutionResult(input: {
  missionState: MissionState;
  currentStepResult: MissionStepResult | null;
  runtimeProof: RuntimeProof;
}): MissionExecutionResult {
  return MissionExecutionResultSchema.parse({
    missionState: input.missionState,
    status: input.missionState.status,
    currentStepResult: input.currentStepResult,
    runtimeProof: input.runtimeProof,
  });
}