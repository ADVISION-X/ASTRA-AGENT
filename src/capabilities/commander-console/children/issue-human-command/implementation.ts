import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderCommand } from "../../runtime/commander-command-gate.js";
import type { IssueHumanCommandInput, IssueHumanCommandOutput } from "./contract.js";
import { IssueHumanCommandInputSchema, IssueHumanCommandOutputSchema } from "./schema.js";

export const ISSUE_HUMAN_COMMAND_CHILD: CommanderConsoleChildDefinition<IssueHumanCommandInput, IssueHumanCommandOutput> = {
  childCapabilityId: "issue-human-command",
  inputSchema: IssueHumanCommandInputSchema,
  outputSchema: IssueHumanCommandOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderCommand({
      childCapabilityId: "issue-human-command",
      operatorRef: input.operatorRef,
      commandInput: input.input,
    });
    if (!gated.ok) {
      return {
        status: "failed",
        output: null,
        failureReason: gated.reason,
        reviewRequiredReason: null,
        inputRef: "issue-human-command",
        outputRef: null,
        evidenceRefs: [],
        dataQualityFlags: ["command_gate_blocked"],
        boundaryDecision: "command-transport-only",
      };
    }

    const transport = await context.commandTransport.emitHumanCommand(gated.command);
    const status = transport.status === "accepted" ? "success" : transport.status;
    return {
      status,
      output:
        status === "success"
          ? {
              commandId: gated.command.commandId,
              commandType: gated.command.commandType,
              priority: gated.command.priority,
              envelopeRef: transport.envelopeRef,
              resultEnvelopeRef: transport.resultEnvelopeRef,
              transportStatus: transport.status,
              targetMissionId: gated.command.targetMissionId,
              targetRecordId: gated.command.targetRecordRef?.recordId ?? null,
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