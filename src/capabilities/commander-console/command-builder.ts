import { createId } from "../../lib/local-runtime/ids.js";
import type { CommanderHumanCommandInput } from "./contract.js";

export function buildStartMissionCommand(input: {
  humanGoal?: string;
  requestedPlatformId?: string;
  selectedMapId?: string;
  initialPayload?: Record<string, unknown>;
}): CommanderHumanCommandInput {
  return {
    commandType: "start-mission",
    targetMissionId: createId("mission"),
    selectedMapId: input.selectedMapId?.trim() || null,
    requestedPlatformId: (input.requestedPlatformId as CommanderHumanCommandInput["requestedPlatformId"]) ?? null,
    humanGoal: input.humanGoal?.trim() || "Discover evidence-backed product opportunities from the active social feed.",
    initialPayload: input.initialPayload ?? {},
  };
}
