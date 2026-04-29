import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderCommand } from "../../runtime/commander-command-gate.js";
import type { StopMissionInput, StopMissionOutput } from "./contract.js";
import { StopMissionInputSchema, StopMissionOutputSchema } from "./schema.js";

export const STOP_MISSION_CHILD: CommanderConsoleChildDefinition<StopMissionInput, StopMissionOutput> = {
  childCapabilityId: "stop-mission",
  inputSchema: StopMissionInputSchema,
  outputSchema: StopMissionOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderCommand({
      childCapabilityId: "stop-mission",
      operatorRef: input.operatorRef,
      commandInput: {
        commandType: "stop-mission",
        targetMissionId: input.input.targetMissionId ?? null,
        operatorNote: input.input.operatorNote ?? null,
      },
    });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "stop-mission", outputRef: null, evidenceRefs: [], dataQualityFlags: ["command_gate_blocked"], boundaryDecision: "command-transport-only" };
    }

    const transport = await context.commandTransport.emitHumanCommand(gated.command);
    const status = transport.status === "accepted" ? "success" : transport.status;
    return {
      status,
      output:
        status === "success"
          ? {
              commandId: gated.command.commandId,
              commandType: "stop-mission",
              priority: gated.command.priority,
              envelopeRef: transport.envelopeRef,
              resultEnvelopeRef: transport.resultEnvelopeRef,
              transportStatus: transport.status,
              targetMissionId: gated.command.targetMissionId,
              targetRecordId: null,
              message: transport.message,
            }
          : null,
      failureReason: status === "failed" ? (transport.failureReason ?? transport.message) : null,
      reviewRequiredReason: status === "review_required" ? (transport.reviewRequiredReason ?? transport.message) : null,
      inputRef: gated.inputRef,
      outputRef: gated.command.commandId,
      evidenceRefs: [],
      dataQualityFlags: status === "success" ? [] : ["transport_guarded"],
      boundaryDecision: "command-transport-only",
    };
  },
};