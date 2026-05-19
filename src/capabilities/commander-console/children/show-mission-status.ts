import { randomUUID } from "node:crypto";

import { CommanderMissionStatusViewSchema, type CommanderConsoleResult } from "../schema.js";
import { buildCommanderProof, buildCommanderSuccessResult } from "../result.js";
import type { CommanderChildContext, CommanderMissionStatusSnapshot } from "./context.js";
import { buildCommanderChildFailure } from "./failure.js";

const buildStatusProof = (
  operatorRef: string,
  snapshot: CommanderMissionStatusSnapshot,
  startedAt: string,
) => buildCommanderProof({
  childCapabilityId: "show-mission-status",
  commandId: randomUUID(),
  commandType: "show-mission-status",
  operatorRef,
  missionId: snapshot.missionId,
  status: "success",
  failureReason: null,
  reviewRequiredReason: null,
  envelopeId: null,
  startedAt,
  endedAt: new Date().toISOString(),
});

export const executeShowMissionStatus = async (
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
): Promise<CommanderConsoleResult> => {
  const parsed = CommanderMissionStatusViewSchema.safeParse(context.getMissionStatus());
  if (Object.keys(rawInput).length > 0) {
    return buildCommanderChildFailure({
      childCapabilityId: "show-mission-status",
      commandType: "show-mission-status",
      operatorRef,
      missionId: null,
      failureReason: "input_schema_invalid: show-mission-status accepts no fields",
    });
  }
  if (!parsed.success) {
    return buildCommanderChildFailure({
      childCapabilityId: "show-mission-status",
      commandType: "show-mission-status",
      operatorRef,
      missionId: null,
      failureReason: parsed.error.message,
    });
  }
  const startedAt = new Date().toISOString();
  const proof = buildStatusProof(operatorRef, parsed.data, startedAt);
  return buildCommanderSuccessResult(parsed.data, proof);
};
