import type { CommandTransportPort, CommanderHumanCommand } from "../../capabilities/commander-console/ports/command-transport-port.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { buildHumanCommandDispatchInput, describeHumanCommandTransportMessage } from "./workbench-human-command-dispatch.js";

export const createCommandTransport = (
  runtime: WorkbenchRuntime,
): CommandTransportPort => ({
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