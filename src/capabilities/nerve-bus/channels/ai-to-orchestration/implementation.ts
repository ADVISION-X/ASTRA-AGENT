import type { AiRequestEnvelope, AiResponseEnvelope } from "../../shared/envelope.js";
import { createTransferProof, type TransferProof } from "../../shared/transport-proof.js";

export const AI_TO_ORCHESTRATION_CHANNEL_ID = "ai-to-orchestration";

export function createAiToOrchestrationChannel(input: {
  now?: () => string;
}): {
  channelId: typeof AI_TO_ORCHESTRATION_CHANNEL_ID;
  send(envelope: AiRequestEnvelope, responseEnvelope: AiResponseEnvelope): Promise<TransferProof>;
} {
  const now = input.now ?? (() => new Date().toISOString());

  return {
    channelId: AI_TO_ORCHESTRATION_CHANNEL_ID,
    async send(envelope, responseEnvelope) {
      const startedAt = now();
      const endedAt = now();

      return createTransferProof({
        envelopeId: responseEnvelope.envelopeId,
        missionId: envelope.missionId,
        mapId: envelope.mapId,
        stepId: envelope.stepId,
        from: responseEnvelope.from,
        to: responseEnvelope.to,
        payloadRef: responseEnvelope.payloadRef,
        startedAt,
        endedAt,
        status: responseEnvelope.status,
        failureReason: responseEnvelope.failureReason,
      });
    },
  };
}