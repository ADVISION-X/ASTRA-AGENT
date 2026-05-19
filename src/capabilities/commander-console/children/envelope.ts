import { randomUUID } from "node:crypto";

import type { CommandTransportPort } from "../envelope.js";
import { buildCommanderProof, buildCommanderSuccessResult } from "../result.js";
import type { CommanderChildCapabilityId, CommanderConsoleResult } from "../schema.js";
import { buildCommanderChildFailure } from "./failure.js";

type SendEnvelopeInput = {
  childCapabilityId: CommanderChildCapabilityId;
  commandId: string;
  commandType: string;
  operatorRef: string;
  missionId: string | null;
  userRequirementText: string | null;
  selectedPlatforms: string[];
  requestedPlatformId: string | null;
  maxRounds: number | null;
  maxMinutes: number | null;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  timeoutMs: number;
};

const buildEnvelope = (input: SendEnvelopeInput, envelopeId: string, createdAt: string) => ({
  envelopeId,
  commandId: input.commandId,
  commandType: input.commandType,
  operatorRef: input.operatorRef,
  missionId: input.missionId,
  userRequirementText: input.userRequirementText,
  selectedPlatforms: input.selectedPlatforms,
  requestedPlatformId: input.requestedPlatformId,
  maxRounds: input.maxRounds,
  maxMinutes: input.maxMinutes,
  payload: input.payload,
  idempotencyKey: input.idempotencyKey,
  timeoutMs: input.timeoutMs,
  createdAt,
});

const buildTransportSuccess = (
  input: SendEnvelopeInput,
  envelopeId: string,
  transportRef: string | null,
  startedAt: string,
): CommanderConsoleResult => {
  const proof = buildCommanderProof({
    childCapabilityId: input.childCapabilityId,
    commandId: input.commandId,
    commandType: input.commandType,
    operatorRef: input.operatorRef,
    missionId: input.missionId,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    envelopeId,
    startedAt,
    endedAt: new Date().toISOString(),
  });
  return buildCommanderSuccessResult({ envelopeId, transportRef }, proof);
};

export const sendCommandEnvelope = async (
  input: SendEnvelopeInput,
  transport: CommandTransportPort,
): Promise<CommanderConsoleResult> => {
  const startedAt = new Date().toISOString();
  const envelopeId = randomUUID();
  const envelope = buildEnvelope(input, envelopeId, startedAt);
  try {
    const result = await transport.sendHumanCommandEnvelope(envelope);
    if (result.ok) return buildTransportSuccess(input, envelopeId, result.transportRef, startedAt);
    return buildCommanderChildFailure({ ...input, failureReason: result.failureReason ?? "Transport returned not-ok", envelopeId, startedAt });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "Transport threw unknown error";
    return buildCommanderChildFailure({ ...input, failureReason, envelopeId: null, startedAt });
  }
};
