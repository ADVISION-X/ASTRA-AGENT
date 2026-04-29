import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderCommand } from "../../runtime/commander-command-gate.js";
import type { RejectCandidateInput, RejectCandidateOutput } from "./contract.js";
import { RejectCandidateInputSchema, RejectCandidateOutputSchema } from "./schema.js";

export const REJECT_CANDIDATE_CHILD: CommanderConsoleChildDefinition<RejectCandidateInput, RejectCandidateOutput> = {
  childCapabilityId: "reject-candidate",
  inputSchema: RejectCandidateInputSchema,
  outputSchema: RejectCandidateOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderCommand({
      childCapabilityId: "reject-candidate",
      operatorRef: input.operatorRef,
      commandInput: {
        commandType: "reject-candidate",
        targetRecordRef: { recordType: "candidate", recordId: input.input.candidateId },
        operatorNote: input.input.operatorNote ?? null,
      },
    });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "reject-candidate", outputRef: null, evidenceRefs: [input.input.candidateId], dataQualityFlags: ["command_gate_blocked"], boundaryDecision: "command-transport-only" };
    }

    const transport = await context.commandTransport.emitHumanCommand(gated.command);
    const status = transport.status === "accepted" ? "success" : transport.status;
    return {
      status,
      output:
        status === "success"
          ? {
              commandId: gated.command.commandId,
              commandType: "reject-candidate",
              priority: gated.command.priority,
              envelopeRef: transport.envelopeRef,
              resultEnvelopeRef: transport.resultEnvelopeRef,
              transportStatus: transport.status,
              targetMissionId: null,
              targetRecordId: input.input.candidateId,
              message: transport.message,
            }
          : null,
      failureReason: status === "failed" ? (transport.failureReason ?? transport.message) : null,
      reviewRequiredReason: status === "review_required" ? (transport.reviewRequiredReason ?? transport.message) : null,
      inputRef: gated.inputRef,
      outputRef: gated.command.commandId,
      evidenceRefs: [input.input.candidateId],
      dataQualityFlags: status === "success" ? [] : ["transport_guarded"],
      boundaryDecision: "command-transport-only",
    };
  },
};