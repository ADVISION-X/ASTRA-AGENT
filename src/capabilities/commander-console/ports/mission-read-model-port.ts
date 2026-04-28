import type { CommanderMissionView } from "../shared/view-model-types.js";

export interface OrchestrationMissionReadModel {
  readMission(): Promise<CommanderMissionView>;
}