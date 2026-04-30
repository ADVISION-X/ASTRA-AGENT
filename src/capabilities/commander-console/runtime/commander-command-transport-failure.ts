import type { CommanderCommandChildContract, CommanderHumanCommandInput } from "../contract.js";
import { deriveCommandEvidenceRefs, deriveCommandTargetRecordRef } from "./commander-boundary-policy.js";
import { gateCommanderCommand } from "./commander-command-gate.js";
import { buildCommanderCommandReceipt } from "./commander-result-builder.js";
import { commanderFlag } from "../shared/commander-proof.js";
import type { CommanderExecutionOutcome } from "../shared/commander-result.js";
import type { CommanderCommandReceiptView } from "../shared/commander-view-types.js";

const buildTransportFailureReason = (error: unknown) => (
  error instanceof Error && error.message.trim()
    ? error.message
    : "Commander command transport failed unexpectedly."
);

export const createTransportFailureOutcome = (input: {
  contract: CommanderCommandChildContract;
  commandInput: CommanderHumanCommandInput;
  gated: Extract<ReturnType<typeof gateCommanderCommand>, { ok: true }>;
  error: unknown;
}): CommanderExecutionOutcome<CommanderCommandReceiptView> => {
  const failureReason = buildTransportFailureReason(input.error);
  return {
    status: "failed",
    output: buildCommanderCommandReceipt({
      commandId: input.gated.command.commandId,
      commandType: input.gated.command.commandType,
      priority: input.gated.command.priority,
      envelopeRef: null,
      resultEnvelopeRef: null,
      transportStatus: "failed",
      failureReason,
      reviewRequiredReason: null,
      targetMissionId: input.gated.command.targetMissionId,
      targetRecordId: input.gated.command.targetRecordRef?.recordId ?? null,
      message: failureReason,
    }),
    failureReason,
    reviewRequiredReason: null,
    inputRef: input.gated.inputRef,
    outputRef: `commander_receipt:${input.gated.command.commandId}`,
    commandId: input.gated.command.commandId,
    readRequestId: null,
    runId: null,
    missionId: input.gated.command.targetMissionId,
    traceId: null,
    commandEnvelopeRef: null,
    resultEnvelopeRef: null,
    readModelSource: null,
    targetRecordRef: deriveCommandTargetRecordRef(input.commandInput),
    evidenceRefs: deriveCommandEvidenceRefs(input.commandInput, input.contract.evidencePolicy),
    dataQualityFlags: [
      commanderFlag(
        input.contract.childCapabilityId === "emergency-stop" ? "hard_stop_guarded" : "transport_guarded",
        "fatal",
        failureReason,
      ),
    ],
    boundaryDecision: input.contract.boundaryDecision,
    commandDecision: "accepted-by-command-gate",
    readDecision: null,
    transportDecision: "failed",
    hardStopDecision: input.contract.hardStopPriority === "emergency" ? "hard-stop-dispatch-failed" : "not-hard-stop",
    policyDecision: "blocked",
  };
};