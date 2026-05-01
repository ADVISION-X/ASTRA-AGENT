import type { z } from "zod";
import { RequestedPlatformIdSchema } from "../../map-plugins/schema/platform-id.schema.js";

import {
  EmergencyStopChildInputSchema,
  EmergencyStopChildOutputSchema,
  EvaluateStepTransitionChildInputSchema,
  EvaluateStepTransitionChildOutputSchema,
  ExecuteMapStepChildInputSchema,
  ExecuteMapStepChildOutputSchema,
  FinalizeMissionChildInputSchema,
  FinalizeMissionChildOutputSchema,
  MissionCommandSchema,
  MissionControlCommandSchema,
  MissionExecutionResultSchema,
  MissionReviewDecisionInputSchema,
  MissionStateSchema,
  MissionStepResultSchema,
  OperationalMapIdSchema,
  OperationalMapSchema,
  ORCHESTRATION_ABILITY_GROUP_ID,
  OrchestrationChildCapabilityIdSchema,
  OrchestrationSequencePolicySchema,
  PauseMissionChildInputSchema,
  PauseMissionChildOutputSchema,
  PayloadRefBundleSchema,
  RequestHumanReviewChildInputSchema,
  RequestHumanReviewChildOutputSchema,
  ResumeMissionChildInputSchema,
  ResumeMissionChildOutputSchema,
  RuntimeProofSchema,
  StartMissionChildInputSchema,
  StartMissionChildOutputSchema,
  StopMissionChildInputSchema,
  StopMissionChildOutputSchema,
} from "./schema.js";

export { ORCHESTRATION_ABILITY_GROUP_ID };

type OrchestrationAbilityGroupId = typeof ORCHESTRATION_ABILITY_GROUP_ID;
type RequestedPlatformId = z.output<typeof RequestedPlatformIdSchema>;
type OrchestrationChildCapabilityId = z.output<typeof OrchestrationChildCapabilityIdSchema>;
type OperationalMapId = z.output<typeof OperationalMapIdSchema>;
type PayloadRefBundle = z.output<typeof PayloadRefBundleSchema>;
type OrchestrationSequencePolicy = z.output<typeof OrchestrationSequencePolicySchema>;
type MissionCommand = z.output<typeof MissionCommandSchema>;
type MissionControlCommand = z.output<typeof MissionControlCommandSchema>;
type MissionReviewDecisionInput = z.output<typeof MissionReviewDecisionInputSchema>;
type MissionState = z.output<typeof MissionStateSchema>;
type MissionControlState = MissionState;
type MissionExecutionResult = z.output<typeof MissionExecutionResultSchema>;
type MissionStepResult = z.output<typeof MissionStepResultSchema>;
type RuntimeProof = z.output<typeof RuntimeProofSchema>;
type OperationalMap = z.output<typeof OperationalMapSchema>;

type StartMissionChildInput = z.output<typeof StartMissionChildInputSchema>;
type PauseMissionChildInput = z.output<typeof PauseMissionChildInputSchema>;
type ResumeMissionChildInput = z.output<typeof ResumeMissionChildInputSchema>;
type StopMissionChildInput = z.output<typeof StopMissionChildInputSchema>;
type EmergencyStopChildInput = z.output<typeof EmergencyStopChildInputSchema>;
type ExecuteMapStepChildInput = z.output<typeof ExecuteMapStepChildInputSchema>;
type EvaluateStepTransitionChildInput = z.output<typeof EvaluateStepTransitionChildInputSchema>;
type RequestHumanReviewChildInput = z.output<typeof RequestHumanReviewChildInputSchema>;
type FinalizeMissionChildInput = z.output<typeof FinalizeMissionChildInputSchema>;

type StartMissionChildOutput = z.output<typeof StartMissionChildOutputSchema>;
type PauseMissionChildOutput = z.output<typeof PauseMissionChildOutputSchema>;
type ResumeMissionChildOutput = z.output<typeof ResumeMissionChildOutputSchema>;
type StopMissionChildOutput = z.output<typeof StopMissionChildOutputSchema>;
type EmergencyStopChildOutput = z.output<typeof EmergencyStopChildOutputSchema>;
type ExecuteMapStepChildOutput = z.output<typeof ExecuteMapStepChildOutputSchema>;
type EvaluateStepTransitionChildOutput = z.output<typeof EvaluateStepTransitionChildOutputSchema>;
type RequestHumanReviewChildOutput = z.output<typeof RequestHumanReviewChildOutputSchema>;
type FinalizeMissionChildOutput = z.output<typeof FinalizeMissionChildOutputSchema>;

interface OrchestrationAbilityGroup {
  listChildCapabilityIds(): OrchestrationChildCapabilityId[];
  listMapIds(): OperationalMapId[];
  execute(input: { childCapabilityId: OrchestrationChildCapabilityId; payload: unknown }): Promise<unknown>;
  startMission(command: MissionCommand): Promise<MissionControlState>;
  pauseMission(missionId: string): Promise<MissionControlState>;
  resumeMission(missionId: string): Promise<MissionControlState>;
  stopMission(input: { missionId: string; reason?: string }): Promise<MissionControlState>;
  emergencyStop(input: { missionId: string; reason?: string }): Promise<MissionControlState>;
  getMissionState(missionId?: string | null): Promise<MissionControlState>;
  executeMission(command: MissionCommand): Promise<MissionExecutionResult>;
  submitReviewDecision(input: MissionReviewDecisionInput): Promise<MissionControlState>;
}

export type {
  EmergencyStopChildInput,
  EmergencyStopChildOutput,
  EvaluateStepTransitionChildInput,
  EvaluateStepTransitionChildOutput,
  ExecuteMapStepChildInput,
  ExecuteMapStepChildOutput,
  FinalizeMissionChildInput,
  FinalizeMissionChildOutput,
  MissionCommand,
  MissionControlCommand,
  MissionControlState,
  MissionExecutionResult,
  MissionReviewDecisionInput,
  MissionState,
  MissionStepResult,
  OperationalMap,
  OperationalMapId,
  OrchestrationAbilityGroup,
  OrchestrationAbilityGroupId,
  OrchestrationChildCapabilityId,
  OrchestrationSequencePolicy,
  PauseMissionChildInput,
  PauseMissionChildOutput,
  PayloadRefBundle,
  RequestedPlatformId,
  RequestHumanReviewChildInput,
  RequestHumanReviewChildOutput,
  ResumeMissionChildInput,
  ResumeMissionChildOutput,
  RuntimeProof,
  StartMissionChildInput,
  StartMissionChildOutput,
  StopMissionChildInput,
  StopMissionChildOutput,
};

