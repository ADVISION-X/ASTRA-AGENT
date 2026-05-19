import { randomUUID } from "node:crypto";
import type { CommandTransportPort } from "../../capabilities/commander-console/index.js";
import type { NerveBusAbilityGroup } from "../../capabilities/nerve-bus/index.js";

type HumanCommandDispatchInput = {
  commandType: string;
  missionId: string | null;
  payload: Record<string, unknown>;
  runId: string;
};

const dispatchHumanCommand = (
  nerveBus: NerveBusAbilityGroup,
  input: HumanCommandDispatchInput,
) => nerveBus.dispatchHumanCommand({
  commandType: input.commandType,
  missionId: input.missionId ?? randomUUID(),
  runId: input.runId,
  sessionId: null,
  roundId: null,
  inputPayload: input.payload,
});

export function createNerveBusCommandTransportPort(nerveBus: NerveBusAbilityGroup): CommandTransportPort {
  return {
    async sendHumanCommandEnvelope(envelope) {
      try {
        const result = await dispatchHumanCommand(nerveBus, {
          commandType: envelope.commandType,
          missionId: envelope.missionId,
          payload: envelope.payload,
          runId: randomUUID(),
        });
        return { ok: result.status === "success", transportRef: envelope.envelopeId, failureReason: result.failureReason ?? null };
      } catch (error) {
        return { ok: false, transportRef: null, failureReason: error instanceof Error ? error.message : "transport error" };
      }
    },
    async emitHumanCommand(command) {
      const runId = randomUUID();
      try {
        const result = await dispatchHumanCommand(nerveBus, {
          commandType: command.commandType,
          missionId: command.targetMissionId ?? null,
          payload: command.payload,
          runId,
        });
        return { commandId: command.commandId, runId, envelopeRef: command.commandId, resultEnvelopeRef: null, status: result.status === "success" ? "accepted" as const : "failed" as const, failureReason: result.failureReason ?? null, reviewRequiredReason: null, message: result.failureReason ?? "dispatched", debugLogRef: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : "transport error";
        return { commandId: command.commandId, runId, envelopeRef: null, resultEnvelopeRef: null, status: "failed" as const, failureReason: message, reviewRequiredReason: null, message, debugLogRef: null };
      }
    },
  };
}
