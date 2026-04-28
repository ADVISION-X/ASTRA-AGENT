import type { AbilityCommandHandlers } from "../../contract.js";
import type { CommandEnvelope, ResultEnvelope } from "../../shared/envelope.js";
import { createTransferProof, type TransferProof } from "../../shared/transport-proof.js";

export const ORCHESTRATION_TO_ABILITY_CHANNEL_ID = "orchestration-to-ability";

function buildMissingHandlerResult(envelope: CommandEnvelope, endedAt: string): ResultEnvelope {
  return {
    envelopeId: `${envelope.envelopeId}:result`,
    resultId: `${envelope.commandId}:missing-handler`,
    missionId: envelope.missionId,
    mapId: envelope.mapId,
    stepId: envelope.stepId,
    from: envelope.to,
    to: "orchestration",
    abilityGroupId: envelope.to,
    status: "failed",
    payloadRef: envelope.payloadRef,
    payload: { reason: "missing_ability_handler", commandName: envelope.commandName },
    failureReason: `No Nerve Bus handler is registered for ${envelope.to}`,
    createdAt: endedAt,
  };
}

export function createOrchestrationToAbilityChannel(input: {
  abilityHandlers: AbilityCommandHandlers;
  now?: () => string;
}): {
  channelId: typeof ORCHESTRATION_TO_ABILITY_CHANNEL_ID;
  send(envelope: CommandEnvelope): Promise<{ resultEnvelope: ResultEnvelope; proof: TransferProof }>;
} {
  const now = input.now ?? (() => new Date().toISOString());

  return {
    channelId: ORCHESTRATION_TO_ABILITY_CHANNEL_ID,
    async send(envelope) {
      const startedAt = now();
      const handler = input.abilityHandlers[envelope.to];
      const resultEnvelope = handler ? await handler(envelope) : buildMissingHandlerResult(envelope, now());
      const endedAt = now();

      return {
        resultEnvelope,
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
          status: resultEnvelope.status,
          failureReason: resultEnvelope.failureReason,
        }),
      };
    },
  };
}