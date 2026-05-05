import { MissionCommandSchema } from "../../capabilities/orchestration/schema.js";
import type { RequestedPlatformId } from "./workbench-contract.js";

export const checkMissionCommandSchemaPreflight = (input: {
  requestedPlatformId: RequestedPlatformId;
  selectedMapId: string;
  taskTemplateId?: string | null;
  activationId?: string | null;
  targetProfileRef?: string | null;
}) => MissionCommandSchema.safeParse({
  missionId: "mission-preflight",
  runId: "mission-preflight:run",
  humanGoal: "Mission preflight verifies the final start-mission command schema before dispatch.",
  requestedPlatform: input.requestedPlatformId,
  preferredMapId: input.selectedMapId,
  taskTemplateId: input.taskTemplateId ?? null,
  activationId: input.activationId ?? null,
  maxRounds: null,
  maxMinutes: null,
  initialPayload: {
    requestedBy: "commander-console",
    selectedMapId: input.selectedMapId,
    targetProfileRef: input.targetProfileRef ?? null,
  },
});

export const describeMissionCommandSchemaPreflight = (
  check: ReturnType<typeof checkMissionCommandSchemaPreflight>,
) => check.success
  ? "missing command transport contract fields"
  : check.error.issues[0]?.message ?? "schema validation failed";
