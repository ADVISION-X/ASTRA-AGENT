import type { CommanderMissionView } from "../shared/commander-view-types.js";

export interface OrchestrationMissionReadModel {
  readMission(): Promise<CommanderMissionView>;
}