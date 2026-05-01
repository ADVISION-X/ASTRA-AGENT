import type { MissionControlState } from "../contract.js";
import { MissionStateSchema } from "../schema.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";

export async function readCurrentMissionState(context: OrchestrationRuntimeContext, missionId?: string | null): Promise<MissionControlState> {
  if (missionId) {
    const state = await context.statePort.getMissionState(missionId);
    if (state) {
      return state;
    }
  }

  const active = await context.statePort.getActiveMission();
  if (active) {
    return active;
  }

  return MissionStateSchema.parse({ status: "idle", payloadRefs: {} });
}