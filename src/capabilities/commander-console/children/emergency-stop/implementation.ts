import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderCommand } from "../../runtime/commander-command-gate.js";
import type { EmergencyStopInput, EmergencyStopOutput } from "./contract.js";
import { EmergencyStopInputSchema, EmergencyStopOutputSchema } from "./schema.js";

export const EMERGENCY_STOP_CHILD: CommanderConsoleChildDefinition<EmergencyStopInput, EmergencyStopOutput> = {
  childCapabilityId: "emergency-stop",
  inputSchema: EmergencyStopInputSchema,
  outputSchema: EmergencyStopOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderCommand({
      childCapabilityId: "emergency-stop",
      operatorRef: input.operatorRef,
      commandInput: {
        commandType: "emergency-stop",
        targetMissionId: input.input.targetMissionId ?? null,
        operatorNote: input.input.operatorNote ?? "hard emergency stop requested by operator",
      },
    });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: `hard_stop_gate_failed:${gated.reason}`, reviewRequiredReason: null, inputRef: "emergency-stop", outputRef: null, evidenceRefs: [], dataQualityFlags: ["hard_stop_gate_failed"], boundaryDecision: "command-transport-only" };
    }

    const transport = await context.commandTransport.emitHumanCommand(gated.command);
    const status = transport.status === "accepted" ? "success" : transport.status;
    return {
      status,
      output:
        status === "success"
          ? {
              commandId: gated.command.commandId,
              commandType: "emergency-stop",
              priority: gated.command.priority,
              envelopeRef: transport.envelopeRef,
              resultEnvelopeRef: transport.resultEnvelopeRef,
              transportStatus: transport.status,
              targetMissionId: gated.command.targetMissionId,
              targetRecordId: null,
              message: transport.message,
            }
          : null,
      failureReason: status === "failed" ? `hard_stop_dispatch_failed:${transport.failureReason ?? transport.message}` : null,
      reviewRequiredReason: status === "review_required" ? (transport.reviewRequiredReason ?? transport.message) : null,
      inputRef: gated.inputRef,
      outputRef: gated.command.commandId,
      evidenceRefs: [],
      dataQualityFlags: status === "success" ? ["hard_stop"] : ["hard_stop_guarded"],
      boundaryDecision: "command-transport-only",
    };
  },
};