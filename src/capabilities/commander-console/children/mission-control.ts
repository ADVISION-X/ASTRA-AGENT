import { randomUUID } from "node:crypto";

import { MissionControlInputSchema, type CommanderChildCapabilityId, type CommanderConsoleResult } from "../schema.js";
import type { CommanderChildContext } from "./context.js";
import { sendCommandEnvelope } from "./envelope.js";
import { buildCommanderChildFailure } from "./failure.js";

type ControlCapabilityId = Exclude<CommanderChildCapabilityId, "issue-human-command" | "mark-review-required" | "show-mission-status">;

type MissionControlExecutionInput = {
  childCapabilityId: ControlCapabilityId;
  commandType: string;
  rawInput: Record<string, unknown>;
  operatorRef: string;
  context: CommanderChildContext;
};

const executeMissionControl = async (
  input: MissionControlExecutionInput,
): Promise<CommanderConsoleResult> => {
  const parsed = MissionControlInputSchema.safeParse(input.rawInput);
  if (!parsed.success) {
    return buildCommanderChildFailure({
      childCapabilityId: input.childCapabilityId,
      commandType: input.commandType,
      operatorRef: input.operatorRef,
      missionId: null,
      failureReason: `input_schema_invalid: ${parsed.error.message}`,
    });
  }
  const commandId = randomUUID();
  return sendCommandEnvelope({
    childCapabilityId: input.childCapabilityId,
    commandId,
    commandType: input.commandType,
    operatorRef: input.operatorRef,
    missionId: parsed.data.targetMissionId ?? null,
    userRequirementText: null,
    selectedPlatforms: [],
    requestedPlatformId: null,
    maxRounds: null,
    maxMinutes: null,
    payload: { reason: parsed.data.reason ?? null },
    idempotencyKey: `${input.commandType}:${commandId}`,
    timeoutMs: 15_000,
  }, input.context.commandTransport);
};

export const executePauseMission = (rawInput: Record<string, unknown>, operatorRef: string, context: CommanderChildContext) =>
  executeMissionControl({ childCapabilityId: "pause-mission", commandType: "pause-mission", rawInput, operatorRef, context });

export const executeResumeMission = (rawInput: Record<string, unknown>, operatorRef: string, context: CommanderChildContext) =>
  executeMissionControl({ childCapabilityId: "resume-mission", commandType: "resume-mission", rawInput, operatorRef, context });

export const executeStopMission = (rawInput: Record<string, unknown>, operatorRef: string, context: CommanderChildContext) =>
  executeMissionControl({ childCapabilityId: "stop-mission", commandType: "stop-mission", rawInput, operatorRef, context });

export const executeEmergencyStop = (rawInput: Record<string, unknown>, operatorRef: string, context: CommanderChildContext) =>
  executeMissionControl({ childCapabilityId: "emergency-stop", commandType: "emergency-stop", rawInput, operatorRef, context });
