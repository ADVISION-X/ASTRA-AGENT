import type { WorkbenchRuntime } from "./workbench-contract.js";
import { buildHumanCommandDispatchInput, describeHumanCommandTransportMessage } from "./workbench-human-command-dispatch.js";

type CommanderHumanCommand = {
  commandId: string;
  commandType: string;
  priority: string;
  operatorRef: string;
  targetMissionId: string | null;
  selectedMapId: string | null;
  targetRecordRef: { recordId: string } | null;
  requestedPlatformId: "facebook-web" | "tiktok-web" | null;
  humanGoal: string | null;
  maxRounds: number | null;
  maxMinutes: number | null;
  operatorNote: string | null;
  idempotencyKey: string;
  timeoutMs: number;
  payload: unknown;
};

export const createCommandTransport = (
  runtime: WorkbenchRuntime,
 ) => ({
  emitHumanCommand: async (command: CommanderHumanCommand) => {
    const transport = await runtime.nerveBusAbilityGroup.dispatchHumanCommand(buildHumanCommandDispatchInput(command));
    const status: "accepted" | "failed" | "review_required" = transport.resultEnvelope.status === "success"
      ? "accepted"
      : transport.resultEnvelope.status;
    return {
      commandId: command.commandId,
      envelopeRef: transport.commandEnvelope.envelopeId,
      resultEnvelopeRef: transport.resultEnvelope.envelopeId,
      status,
      failureReason: transport.resultEnvelope.failureReason,
      reviewRequiredReason: transport.resultEnvelope.status === "review_required" ? transport.resultEnvelope.failureReason ?? "review required" : null,
      message: describeHumanCommandTransportMessage(transport.resultEnvelope),
      debugLogRef: null,
    };
  },
});