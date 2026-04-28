import type { CommandEnvelope, ResultEnvelope } from "../../shared/envelope.js";
import { createTransferProof, type TransferProof } from "../../shared/transport-proof.js";

export const ABILITY_TO_ORCHESTRATION_CHANNEL_ID = "ability-to-orchestration";

export function createAbilityToOrchestrationChannel(input: {
  now?: () => string;
}): {
  channelId: typeof ABILITY_TO_ORCHESTRATION_CHANNEL_ID;
  send(envelope: CommandEnvelope, resultEnvelope: ResultEnvelope): Promise<TransferProof>;
} {
  const now = input.now ?? (() => new Date().toISOString());

  return {
    channelId: ABILITY_TO_ORCHESTRATION_CHANNEL_ID,
    async send(envelope, resultEnvelope) {
      const startedAt = now();
      const endedAt = now();

      return createTransferProof({
        envelopeId: resultEnvelope.envelopeId,
        missionId: envelope.missionId,
        mapId: envelope.mapId,
        stepId: envelope.stepId,
        from: resultEnvelope.from,
        to: resultEnvelope.to,
        payloadRef: resultEnvelope.payloadRef,
        startedAt,
        endedAt,
        status: resultEnvelope.status,
        failureReason: resultEnvelope.failureReason,
      });
    },
  };
}