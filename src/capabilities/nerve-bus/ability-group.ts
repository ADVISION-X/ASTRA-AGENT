import type { NerveBusAbilityGroup } from "./contract.js";
import { type AbilityCommandHandlers, type AiRequestHandler, type HumanCommandHandler } from "./contract.js";
import { createAbilityToOrchestrationChannel } from "./channels/ability-to-orchestration/implementation.js";
import { createAiToOrchestrationChannel } from "./channels/ai-to-orchestration/implementation.js";
import { createOrchestrationToAbilityChannel } from "./channels/orchestration-to-ability/implementation.js";
import { createOrchestrationToAiChannel } from "./channels/orchestration-to-ai/implementation.js";
import type { HumanCommandEnvelope, HumanCommandResultEnvelope } from "./shared/envelope.js";
import { createTransferProof } from "./shared/transport-proof.js";

function buildUnavailableHumanCommandResult(envelope: HumanCommandEnvelope, endedAt: string): HumanCommandResultEnvelope {
  return {
    envelopeId: `${envelope.envelopeId}:result`,
    resultId: `${envelope.commandId}:missing-handler`,
    missionId: envelope.missionId,
    mapId: envelope.mapId,
    stepId: envelope.stepId,
    from: envelope.to,
    to: "commander-console",
    status: "failed",
    payloadRef: envelope.payloadRef,
    payload: { reason: "missing_human_command_handler", commandType: envelope.commandType },
    failureReason: "No Nerve Bus human command handler is registered.",
    createdAt: endedAt,
  };
}

export function createNerveBusAbilityGroup(input: {
  abilityHandlers: AbilityCommandHandlers;
  aiHandler?: AiRequestHandler;
  humanCommandHandler?: HumanCommandHandler;
  now?: () => string;
}): NerveBusAbilityGroup {
  const orchestrationToAbility = createOrchestrationToAbilityChannel({
    abilityHandlers: input.abilityHandlers,
    ...(input.now ? { now: input.now } : {}),
  });
  const abilityToOrchestration = createAbilityToOrchestrationChannel(
    input.now ? { now: input.now } : {},
  );
  const orchestrationToAi = createOrchestrationToAiChannel({
    ...(input.aiHandler ? { aiHandler: input.aiHandler } : {}),
    ...(input.now ? { now: input.now } : {}),
  });
  const aiToOrchestration = createAiToOrchestrationChannel(
    input.now ? { now: input.now } : {},
  );

  return {
    listChannelIds() {
      return [
        "commander-to-governed",
        "governed-to-commander",
        orchestrationToAbility.channelId,
        abilityToOrchestration.channelId,
        orchestrationToAi.channelId,
        aiToOrchestration.channelId,
      ];
    },
    async dispatchHumanCommand(envelope) {
      const now = input.now ?? (() => new Date().toISOString());
      const startedAt = now();
      const resultEnvelope = input.humanCommandHandler
        ? await input.humanCommandHandler(envelope)
        : buildUnavailableHumanCommandResult(envelope, now());
      const endedAt = now();

      return {
        commandEnvelope: envelope,
        resultEnvelope,
        proofs: [
          createTransferProof({
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
          createTransferProof({
            envelopeId: resultEnvelope.envelopeId,
            missionId: resultEnvelope.missionId,
            mapId: resultEnvelope.mapId,
            stepId: resultEnvelope.stepId,
            from: resultEnvelope.from,
            to: resultEnvelope.to,
            payloadRef: resultEnvelope.payloadRef,
            startedAt: endedAt,
            endedAt,
            status: resultEnvelope.status,
            failureReason: resultEnvelope.failureReason,
          }),
        ],
      };
    },
    async dispatchAbilityCommand(envelope) {
      const outbound = await orchestrationToAbility.send(envelope);
      const inbound = await abilityToOrchestration.send(envelope, outbound.resultEnvelope);
      return {
        commandEnvelope: envelope,
        resultEnvelope: outbound.resultEnvelope,
        proofs: [outbound.proof, inbound],
      };
    },
    async requestAi(envelope) {
      const outbound = await orchestrationToAi.send(envelope);
      const inbound = await aiToOrchestration.send(envelope, outbound.responseEnvelope);
      return {
        requestEnvelope: envelope,
        responseEnvelope: outbound.responseEnvelope,
        proofs: [outbound.proof, inbound],
      };
    },
  };
}