import { randomUUID } from "crypto";
import type { AbilityCommandDispatchInput, AiRequestDispatchInput, HumanCommandDispatchInput } from "../contract.js";

const nowIso = (): string => new Date().toISOString();

const envelopeBase = (input: { missionId: string; runId: string; sessionId: string | null; roundId: string | null }) => ({
  envelopeId: randomUUID(),
  missionId: input.missionId,
  runId: input.runId,
  sessionId: input.sessionId,
  roundId: input.roundId,
  issuedAt: nowIso(),
});

export const buildAbilityCommandEnvelope = (cmd: AbilityCommandDispatchInput) => ({
  ...envelopeBase(cmd),
  kind: "ability-command" as const,
  abilityGroupId: cmd.abilityGroupId,
  childCapabilityId: cmd.childCapabilityId,
  inputPayload: cmd.inputPayload,
});

export const buildAiRequestEnvelope = (cmd: AiRequestDispatchInput) => ({
  ...envelopeBase(cmd),
  kind: "ai-request" as const,
  requestType: cmd.requestType,
});

export const buildHumanCommandEnvelope = (cmd: HumanCommandDispatchInput) => ({
  ...envelopeBase(cmd),
  kind: "human-command" as const,
  commandType: cmd.commandType,
});
