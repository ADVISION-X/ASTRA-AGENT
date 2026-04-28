import type { AiRequestHandler } from "../../contract.js";
import type { AiRequestEnvelope, AiResponseEnvelope } from "../../shared/envelope.js";
import { createTransferProof, type TransferProof } from "../../shared/transport-proof.js";

export const ORCHESTRATION_TO_AI_CHANNEL_ID = "orchestration-to-ai";

function buildUnavailableAiResponse(envelope: AiRequestEnvelope, endedAt: string): AiResponseEnvelope {
  return {
    envelopeId: `${envelope.envelopeId}:response`,
    responseId: `${envelope.requestId}:unavailable-ai`,
    missionId: envelope.missionId,
    mapId: envelope.mapId,
    stepId: envelope.stepId,
    from: "local-ai-decision",
    to: "orchestration",
    status: "failed",
    decision: "local_ai_unavailable",
    confidence: null,
    payloadRef: envelope.payloadRef,
    payload: { reason: "missing_ai_handler", taskType: envelope.taskType },
    failureReason: "No Nerve Bus AI handler is registered.",
    createdAt: endedAt,
  };
}

export function createOrchestrationToAiChannel(input: {
  aiHandler?: AiRequestHandler;
  now?: () => string;
}): {
  channelId: typeof ORCHESTRATION_TO_AI_CHANNEL_ID;
  send(envelope: AiRequestEnvelope): Promise<{ responseEnvelope: AiResponseEnvelope; proof: TransferProof }>;
} {
  const now = input.now ?? (() => new Date().toISOString());

  return {
    channelId: ORCHESTRATION_TO_AI_CHANNEL_ID,
    async send(envelope) {
      const startedAt = now();
      const responseEnvelope = input.aiHandler ? await input.aiHandler(envelope) : buildUnavailableAiResponse(envelope, now());
      const endedAt = now();

      return {
        responseEnvelope,
        proof: createTransferProof({
          envelopeId: envelope.envelopeId,
          missionId: envelope.missionId,
          mapId: envelope.mapId,
          stepId: envelope.stepId,
          from: envelope.from,
          to: envelope.to,
          payloadRef: envelope.payloadRef,
          startedAt,
          endedAt,
          status: responseEnvelope.status,
          failureReason: responseEnvelope.failureReason,
        }),
      };
    },
  };
}