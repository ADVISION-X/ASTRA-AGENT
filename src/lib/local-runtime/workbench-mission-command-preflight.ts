import { MissionCommandSchema } from "../../capabilities/orchestration/index.js";
import type { RequestedPlatformId } from "./workbench-contract.js";

export const checkMissionCommandSchemaPreflight = (input: {
  requestedPlatformId: RequestedPlatformId;
  targetProfileRef?: string | null;
  targetUrl?: string | null;
  targetTitle?: string | null;
}) => MissionCommandSchema.safeParse({
  missionId: "mission-preflight",
  runId: "mission-preflight:run",
  humanGoal: "Mission preflight verifies the final start-mission command schema before dispatch.",
  requestedPlatform: input.requestedPlatformId,
  preferredBindingId: null,
  bindingActivationRef: null,
  maxRounds: null,
  maxMinutes: null,
  initialPayload: {
    requestedBy: "commander-console",
    selectedBindingId: null,
    targetProfileRef: input.targetProfileRef ?? null,
    targetUrl: input.targetUrl ?? null,
    targetTitle: input.targetTitle ?? null,
  },
});

export const describeMissionCommandSchemaPreflight = (
  check: ReturnType<typeof checkMissionCommandSchemaPreflight>,
) => check.success
  ? "missing governed target contract fields"
  : check.error.issues[0]?.message ?? "schema validation failed";
