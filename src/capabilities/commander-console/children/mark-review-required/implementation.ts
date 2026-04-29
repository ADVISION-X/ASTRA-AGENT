import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderCommand } from "../../runtime/commander-command-gate.js";
import type { MarkReviewRequiredInput, MarkReviewRequiredOutput } from "./contract.js";
import { MarkReviewRequiredInputSchema, MarkReviewRequiredOutputSchema } from "./schema.js";

export const MARK_REVIEW_REQUIRED_CHILD: CommanderConsoleChildDefinition<MarkReviewRequiredInput, MarkReviewRequiredOutput> = {
  childCapabilityId: "mark-review-required",
  inputSchema: MarkReviewRequiredInputSchema,
  outputSchema: MarkReviewRequiredOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderCommand({
      childCapabilityId: "mark-review-required",
      operatorRef: input.operatorRef,
      commandInput: {
        commandType: "mark-review-required",
        targetRecordRef: { recordType: "candidate", recordId: input.input.candidateId },
        operatorNote: input.input.operatorNote ?? null,
      },
    });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "mark-review-required", outputRef: null, evidenceRefs: [input.input.candidateId], dataQualityFlags: ["command_gate_blocked"], boundaryDecision: "command-transport-only" };
    }

    const transport = await context.commandTransport.emitHumanCommand(gated.command);
    const status = transport.status === "accepted" ? "success" : transport.status;
    return {
      status,
      output:
        status === "success"
          ? {
              commandId: gated.command.commandId,
              commandType: "mark-review-required",
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