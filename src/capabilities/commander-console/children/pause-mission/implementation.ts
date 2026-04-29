import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderCommand } from "../../runtime/commander-command-gate.js";
import type { PauseMissionInput, PauseMissionOutput } from "./contract.js";
import { PauseMissionInputSchema, PauseMissionOutputSchema } from "./schema.js";

export const PAUSE_MISSION_CHILD: CommanderConsoleChildDefinition<PauseMissionInput, PauseMissionOutput> = {
  childCapabilityId: "pause-mission",
  inputSchema: PauseMissionInputSchema,
  outputSchema: PauseMissionOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderCommand({
      childCapabilityId: "pause-mission",
      operatorRef: input.operatorRef,
      commandInput: {
        commandType: "pause-mission",
        targetMissionId: input.input.targetMissionId ?? null,
        operatorNote: input.input.operatorNote ?? null,
      },
    });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "pause-mission", outputRef: null, evidenceRefs: [], dataQualityFlags: ["command_gate_blocked"], boundaryDecision: "command-transport-only" };
    }

    const transport = await context.commandTransport.emitHumanCommand(gated.command);
    const status = transport.status === "accepted" ? "success" : transport.status;
    return {
      status,
      output:
        status === "success"
          ? {
              commandId: gated.command.commandId,
              commandType: "pause-mission",
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