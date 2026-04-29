import type { z } from "zod";

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
  RequestedPlatformIdSchema,
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
import type { OrchestrationClockPort } from "./ports/orchestration-clock-port.js";
import type { OrchestrationIdempotencyPort } from "./ports/orchestration-idempotency-port.js";
import type { OrchestrationMapStorePort } from "./ports/orchestration-map-store-port.js";
import type { OrchestrationNerveBusPort } from "./ports/orchestration-nerve-bus-port.js";
import type { OrchestrationStatePort } from "./ports/orchestration-state-port.js";

export { ORCHESTRATION_ABILITY_GROUP_ID };

export type OrchestrationAbilityGroupId = typeof ORCHESTRATION_ABILITY_GROUP_ID;
export type RequestedPlatformId = z.output<typeof RequestedPlatformIdSchema>;
export type OrchestrationChildCapabilityId = z.output<typeof OrchestrationChildCapabilityIdSchema>;
export type OperationalMapId = z.output<typeof OperationalMapIdSchema>;
export type PayloadRefBundle = z.output<typeof PayloadRefBundleSchema>;
export type OrchestrationSequencePolicy = z.output<typeof OrchestrationSequencePolicySchema>;
export type MissionCommand = z.output<typeof MissionCommandSchema>;
export type MissionControlCommand = z.output<typeof MissionControlCommandSchema>;
export type MissionReviewDecisionInput = z.output<typeof MissionReviewDecisionInputSchema>;
export type MissionState = z.output<typeof MissionStateSchema>;
export type MissionControlState = MissionState;
export type MissionExecutionResult = z.output<typeof MissionExecutionResultSchema>;
export type MissionStepResult = z.output<typeof MissionStepResultSchema>;
export type RuntimeProof = z.output<typeof RuntimeProofSchema>;
export type OperationalMap = z.output<typeof OperationalMapSchema>;

export type StartMissionChildInput = z.output<typeof StartMissionChildInputSchema>;
export type PauseMissionChildInput = z.output<typeof PauseMissionChildInputSchema>;
export type ResumeMissionChildInput = z.output<typeof ResumeMissionChildInputSchema>;
export type StopMissionChildInput = z.output<typeof StopMissionChildInputSchema>;
export type EmergencyStopChildInput = z.output<typeof EmergencyStopChildInputSchema>;
export type ExecuteMapStepChildInput = z.output<typeof ExecuteMapStepChildInputSchema>;
export type EvaluateStepTransitionChildInput = z.output<typeof EvaluateStepTransitionChildInputSchema>;
export type RequestHumanReviewChildInput = z.output<typeof RequestHumanReviewChildInputSchema>;
export type FinalizeMissionChildInput = z.output<typeof FinalizeMissionChildInputSchema>;

export type StartMissionChildOutput = z.output<typeof StartMissionChildOutputSchema>;
export type PauseMissionChildOutput = z.output<typeof PauseMissionChildOutputSchema>;
export type ResumeMissionChildOutput = z.output<typeof ResumeMissionChildOutputSchema>;
export type StopMissionChildOutput = z.output<typeof StopMissionChildOutputSchema>;
export type EmergencyStopChildOutput = z.output<typeof EmergencyStopChildOutputSchema>;
export type ExecuteMapStepChildOutput = z.output<typeof ExecuteMapStepChildOutputSchema>;
export type EvaluateStepTransitionChildOutput = z.output<typeof EvaluateStepTransitionChildOutputSchema>;
export type RequestHumanReviewChildOutput = z.output<typeof RequestHumanReviewChildOutputSchema>;
export type FinalizeMissionChildOutput = z.output<typeof FinalizeMissionChildOutputSchema>;

export type OrchestrationExecutionContext = {
  clock: OrchestrationClockPort;
  idempotency: OrchestrationIdempotencyPort;
  mapStore: OrchestrationMapStorePort;
  nerveBus: OrchestrationNerveBusPort;
  statePort: OrchestrationStatePort;
};

export interface OrchestrationChildCapability<InputValue, OutputValue> {
  readonly abilityGroupId: OrchestrationAbilityGroupId;
  readonly childCapabilityId: OrchestrationChildCapabilityId;
  execute(input: InputValue, context: OrchestrationExecutionContext): Promise<OutputValue>;
}

export interface OrchestrationAbilityGroup {
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