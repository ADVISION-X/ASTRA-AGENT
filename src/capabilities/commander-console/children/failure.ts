import { randomUUID } from "node:crypto";

import { buildCommanderFailureResult, buildCommanderProof } from "../result.js";
import type { CommanderChildCapabilityId, CommanderConsoleResult } from "../schema.js";

type FailureInput = {
  childCapabilityId: CommanderChildCapabilityId;
  commandType: string;
  operatorRef: string;
  missionId: string | null;
  failureReason: string;
  envelopeId?: string | null;
  commandId?: string | null;
  startedAt?: string | null;
};

export const buildCommanderChildFailure = (input: FailureInput): CommanderConsoleResult => {
  const startedAt = input.startedAt ?? new Date().toISOString();
  const proof = buildCommanderProof({
    childCapabilityId: input.childCapabilityId,
    commandId: input.commandId ?? randomUUID(),
    commandType: input.commandType,
    operatorRef: input.operatorRef,
    missionId: input.missionId,
    status: "failed",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    envelopeId: input.envelopeId ?? null,
    startedAt,
    endedAt: new Date().toISOString(),
  });
  return buildCommanderFailureResult(input.failureReason, proof);
};
