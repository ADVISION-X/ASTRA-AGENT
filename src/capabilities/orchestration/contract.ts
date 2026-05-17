import type { z } from "zod";
import type {
  MissionStateSchema,
  MissionCommandSchema,
  OrchestrationChildCapabilityIdSchema,
  OrchestrationExecuteInputSchema,
  OrchestrationExecuteResultSchema,
  OrchestrationRequestedPlatformIdSchema,
  DispatchRegisteredAbilityActionInputSchema,
} from "./schema.js";

export { ORCHESTRATION_ABILITY_GROUP_ID } from "./schema.js";

export type MissionState = z.infer<typeof MissionStateSchema>;
export type MissionControlState = MissionState;
export type MissionCommand = z.infer<typeof MissionCommandSchema>;
export type OrchestrationChildCapabilityId = z.infer<typeof OrchestrationChildCapabilityIdSchema>;
export type RequestedPlatformId = z.infer<typeof OrchestrationRequestedPlatformIdSchema>;
export type OrchestrationExecuteInput = z.infer<typeof OrchestrationExecuteInputSchema>;
export type OrchestrationExecuteResult = z.infer<typeof OrchestrationExecuteResultSchema>;
export type DispatchRegisteredAbilityActionInput = z.infer<typeof DispatchRegisteredAbilityActionInputSchema>;

export interface OrchestrationAbilityGroup {
  listChildCapabilityIds(): OrchestrationChildCapabilityId[];
  execute(input: OrchestrationExecuteInput): Promise<OrchestrationExecuteResult>;
  executeMission(command: MissionCommand): Promise<MissionControlState>;
  startMission(command: MissionCommand): Promise<MissionControlState>;
  pauseMission(missionId: string): Promise<MissionControlState>;
  resumeMission(missionId: string): Promise<MissionControlState>;
  stopMission(input: { missionId: string; reason?: string | null }): Promise<MissionControlState>;
  emergencyStop(input: { missionId: string; reason?: string | null }): Promise<MissionControlState>;
  getMissionState(missionId?: string | null): Promise<MissionControlState>;
}
