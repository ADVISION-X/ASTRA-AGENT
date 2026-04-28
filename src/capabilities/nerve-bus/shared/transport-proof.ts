import type { GovernedAbilityGroupId, EnvelopeStatus } from "./envelope.js";

export type TransferProof = {
  envelopeId: string;
  missionId: string;
  mapId: string;
  stepId: string;
  from: GovernedAbilityGroupId;
  to: GovernedAbilityGroupId;
  payloadRef: string[];
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: EnvelopeStatus;
  failureReason: string | null;
};

export function createTransferProof(input: {
  envelopeId: string;
  missionId: string;
  mapId: string;
  stepId: string;
  from: GovernedAbilityGroupId;
  to: GovernedAbilityGroupId;
  payloadRef: string[];
  startedAt: string;
  endedAt: string;
  status: EnvelopeStatus;
  failureReason: string | null;
}): TransferProof {
  return {
    envelopeId: input.envelopeId,
    missionId: input.missionId,
    mapId: input.mapId,
    stepId: input.stepId,
    from: input.from,
    to: input.to,
    payloadRef: input.payloadRef,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Date.parse(input.endedAt) - Date.parse(input.startedAt),
    status: input.status,
    failureReason: input.failureReason,
  };
}