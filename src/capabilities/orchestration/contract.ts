import type { AbilityTargetId } from "../nerve-bus/shared/envelope.js";
import type { OperationalMapId } from "./shared/map-types.js";
import type { MissionStatus } from "./shared/map-types.js";

export const ORCHESTRATION_ABILITY_GROUP_ID = "orchestration";

export type OrchestrationAbilityGroupId = typeof ORCHESTRATION_ABILITY_GROUP_ID;
export type RequestedPlatformId = "facebook-web" | "tiktok-web";
export type HumanCommandKind =
  | "start-mission"
  | "pause-mission"
  | "resume-mission"
  | "stop-mission"
  | "emergency-stop";
export type MissionControlStatus = MissionStatus | "idle" | "paused" | "stopped";

export type MissionRuntimeTaskSnapshot = {
  taskRunId: string;
  status: MissionControlStatus;
  currentRoundIndex: number;
};

export type MissionRuntimeSnapshot = {
  task: MissionRuntimeTaskSnapshot | null;
  reviewRequiredReason: string | null;
  failureReason: string | null;
};

export type MissionReviewDecisionInput = {
  missionId: string;
  decision: "resume" | "stop" | "hold";
  note?: string;
};

export interface OrchestrationMissionRuntimeController {
  startMission(command: MissionCommand): Promise<MissionRuntimeSnapshot>;
  pauseMission(missionId: string): Promise<MissionRuntimeSnapshot>;
  resumeMission(missionId: string): Promise<MissionRuntimeSnapshot>;
  stopMission(input: { missionId: string; reason: string }): Promise<MissionRuntimeSnapshot>;
  emergencyStop(input: { missionId: string; reason: string }): Promise<MissionRuntimeSnapshot>;
  submitReviewDecision(input: MissionReviewDecisionInput): Promise<MissionRuntimeSnapshot>;
  getRuntimeSnapshot(missionId: string | null): Promise<MissionRuntimeSnapshot>;
}

export type MissionCommand = {
  missionId: string;
  humanGoal: string;
  requestedPlatform: RequestedPlatformId;
  preferredMapId?: OperationalMapId | null;
  initialPayload: Record<string, unknown>;
};

export type MapDebugProof = {
  missionId: string;
  mapId: OperationalMapId;
  currentStepId: string;
  previousStepId: string | null;
  selectedAbilityGroupId: AbilityTargetId;
  commandId: string;
  resultId: string;
  branchTaken: string;
  conditionEvaluated: string;
  status: MissionStatus;
  failureReason: string | null;
  nextStepId: string | null;
};

export type MissionState = {
  missionId: string;
  mapId: OperationalMapId;
  humanGoal: string;
  currentStepId: string | null;
  previousStepId: string | null;
  status: MissionStatus;
  selectedAbilityGroupId: AbilityTargetId | null;
  lastCommandId: string | null;
  lastResultId: string | null;
  branchTaken: string | null;
  visitedStepIds: string[];
};

export type MissionExecutionResult = {
  missionState: MissionState;
  debugProof: MapDebugProof[];
  finalStatus: MissionStatus;
};

export type MissionControlState = {
  missionId: string | null;
  mapId: OperationalMapId | null;
  requestedPlatform: RequestedPlatformId | null;
  humanGoal: string | null;
  status: MissionControlStatus;
  activeTaskRunId: string | null;
  currentRoundIndex: number;
  reviewRequiredReason: string | null;
  failureReason: string | null;
  lastHumanCommand: HumanCommandKind | null;
  startedAt: string | null;
  updatedAt: string | null;
  endedAt: string | null;
};

export interface OrchestrationAbilityGroup {
  listMapIds(): OperationalMapId[];
  getAbilityRoster(): AbilityTargetId[];
  executeMission(command: MissionCommand): Promise<MissionExecutionResult>;
  startMission(command: MissionCommand): Promise<MissionControlState>;
  pauseMission(missionId: string): Promise<MissionControlState>;
  resumeMission(missionId: string): Promise<MissionControlState>;
  stopMission(input: { missionId: string; reason?: string }): Promise<MissionControlState>;
  emergencyStop(input: { missionId: string; reason?: string }): Promise<MissionControlState>;
  getMissionState(): Promise<MissionControlState>;
  submitReviewDecision(input: MissionReviewDecisionInput): Promise<MissionControlState>;
}