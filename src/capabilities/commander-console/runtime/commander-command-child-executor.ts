import type {
  CommanderCommandChildContract,
  CommanderHumanCommandInput,
} from "../contract.js";
import type { CommanderConsoleChildContext } from "./commander-console-executor.js";
import { deriveCommandEvidenceRefs, deriveCommandTargetRecordRef, missingEnvelopeFlag } from "./commander-boundary-policy.js";
import { gateCommanderCommand, parseCommandTransportResult } from "./commander-command-gate.js";
import { createTransportFailureOutcome } from "./commander-command-transport-failure.js";
import { buildCommanderCommandReceipt } from "./commander-result-builder.js";
import { commanderFlag, type CommanderDataQualityFlag } from "../shared/commander-proof.js";
import type { CommanderExecutionOutcome } from "../shared/commander-result.js";
import type { CommanderCommandReceiptView } from "../shared/commander-view-types.js";

type CommandExecutorInput<TInput> = {
  contract: CommanderCommandChildContract;
  input: TInput;
  operatorRef: string;
  context: CommanderConsoleChildContext;
  buildCommandInput: (childInput: TInput) => CommanderHumanCommandInput;
};

const buildCommandReceipt = (input: {
  commandId: string;
  commandType: CommanderHumanCommandInput["commandType"];
  priority: CommanderCommandReceiptView["priority"];
  envelopeRef: string | null;
  resultEnvelopeRef: string | null;
  transportStatus: CommanderCommandReceiptView["transportStatus"];
  failureReason: string | null;
  reviewRequiredReason: string | null;
  targetMissionId: string | null;
  targetRecordId: string | null;
  message: string;
}): CommanderCommandReceiptView => buildCommanderCommandReceipt(input);

const resolveHardStopDecision = (input: {
  hardStopPriority: CommanderCommandChildContract["hardStopPriority"];
  status: "success" | "failed" | "review_required";
}) => {
  if (input.hardStopPriority !== "emergency") {
    return "not-hard-stop" as const;
  }
  if (input.status === "success") {
    return "hard-stop-dispatched" as const;
  }
  if (input.status === "review_required") {
    return "hard-stop-review-required" as const;
  }
  return "hard-stop-dispatch-failed" as const;
};

const buildTransportFlags = (input: {
  childCapabilityId: CommanderCommandChildContract["childCapabilityId"];
  envelopeRef: string | null;
  status: "success" | "failed" | "review_required";
  transportMessage: string;
}) => {
  const flags: CommanderDataQualityFlag[] = [];
  if (!input.envelopeRef) {
    flags.push(missingEnvelopeFlag());
  }
  if (input.status !== "success") {
    flags.push(
      commanderFlag(
        input.childCapabilityId === "emergency-stop" ? "hard_stop_guarded" : "transport_guarded",
        input.status === "failed" ? "fatal" : "warn",
        input.transportMessage,
      ),
    );
  }
  if (input.childCapabilityId === "emergency-stop") {
    flags.push(commanderFlag("hard_stop", "info", "Emergency stop executed through the hard command path."));
  }
  return flags;
};

const buildBlockedCommandReceipt = (gated: Extract<ReturnType<typeof gateCommanderCommand>, { ok: false }>) => buildCommandReceipt({
  commandId: gated.commandId,
  commandType: gated.commandType,
  priority: gated.priority,
  envelopeRef: null,
  resultEnvelopeRef: null,
  transportStatus: "failed",
  failureReason: gated.reason,
  reviewRequiredReason: null,
  targetMissionId: gated.targetMissionId,
  targetRecordId: gated.targetRecordRef?.recordId ?? null,
  message: gated.reason,
});

const buildBlockedCommandFlags = (input: {
  contract: CommanderCommandChildContract;
  reason: string;
}) => [
  commanderFlag(
    input.contract.childCapabilityId === "emergency-stop" ? "hard_stop_gate_failed" : "command_gate_blocked",
    "fatal",
    input.reason,
  ),
];

const buildTransportOutcomeReceipt = (input: {
  gated: Extract<ReturnType<typeof gateCommanderCommand>, { ok: true }>;
  transport: ReturnType<typeof parseCommandTransportResult>;
  failureReason: string | null;
  reviewRequiredReason: string | null;
}) => buildCommandReceipt({
  commandId: input.gated.command.commandId,
  commandType: input.gated.command.commandType,
  priority: input.gated.command.priority,
  envelopeRef: input.transport.envelopeRef,
  resultEnvelopeRef: input.transport.resultEnvelopeRef,
  transportStatus: input.transport.status,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  targetMissionId: input.gated.command.targetMissionId,
  targetRecordId: input.gated.command.targetRecordRef?.recordId ?? null,
  message: input.transport.message,
});

const resolveTransportOutcomeState = (transport: ReturnType<typeof parseCommandTransportResult>) => {
  const status = transport.status === "accepted" ? "success" : transport.status;
  return {
    status,
    failureReason: status === "failed" ? (transport.failureReason ?? transport.message) : null,
    reviewRequiredReason: status === "review_required" ? (transport.reviewRequiredReason ?? transport.message) : null,
  };
};

const createBlockedCommandOutcome = (input: {
  contract: CommanderCommandChildContract;
  commandInput: CommanderHumanCommandInput;
  gated: Extract<ReturnType<typeof gateCommanderCommand>, { ok: false }>;
}): CommanderExecutionOutcome<CommanderCommandReceiptView> => ({
  status: "failed",
  output: buildBlockedCommandReceipt(input.gated),
  failureReason: input.gated.reason,
  reviewRequiredReason: null,
  inputRef: input.gated.inputRef,
  outputRef: `commander_receipt:${input.gated.commandId}`,
  commandId: input.gated.commandId,
  readRequestId: null,
  runId: null,
  missionId: input.gated.targetMissionId,
  traceId: null,
  commandEnvelopeRef: null,
  resultEnvelopeRef: null,
  readModelSource: null,
  targetRecordRef: input.gated.targetRecordRef,
  evidenceRefs: deriveCommandEvidenceRefs(input.commandInput, input.contract.evidencePolicy),
  dataQualityFlags: buildBlockedCommandFlags({ contract: input.contract, reason: input.gated.reason }),
  boundaryDecision: input.contract.boundaryDecision,
  commandDecision: "blocked-by-command-gate",
  readDecision: null,
  transportDecision: "not-dispatched",
  hardStopDecision: input.contract.hardStopPriority === "emergency" ? "hard-stop-required" : "not-hard-stop",
  policyDecision: "blocked",
});

const createTransportOutcome = (input: {
  contract: CommanderCommandChildContract;
  commandInput: CommanderHumanCommandInput;
  gated: Extract<ReturnType<typeof gateCommanderCommand>, { ok: true }>;
  transport: ReturnType<typeof parseCommandTransportResult>;
}): CommanderExecutionOutcome<CommanderCommandReceiptView> => {
  const outcomeState = resolveTransportOutcomeState(input.transport);
  return {
    status: outcomeState.status,
    output: buildTransportOutcomeReceipt({
      gated: input.gated,
      transport: input.transport,
      failureReason: outcomeState.failureReason,
      reviewRequiredReason: outcomeState.reviewRequiredReason,
    }),
    failureReason: outcomeState.failureReason,
    reviewRequiredReason: outcomeState.reviewRequiredReason,
    inputRef: input.gated.inputRef,
    outputRef: `commander_receipt:${input.gated.command.commandId}`,
    commandId: input.gated.command.commandId,
    readRequestId: null,
    runId: null,
    missionId: input.gated.command.targetMissionId,
    traceId: null,
    commandEnvelopeRef: input.transport.envelopeRef,
    resultEnvelopeRef: input.transport.resultEnvelopeRef,
    readModelSource: null,
    targetRecordRef: deriveCommandTargetRecordRef(input.commandInput),
    evidenceRefs: deriveCommandEvidenceRefs(input.commandInput, input.contract.evidencePolicy),
    dataQualityFlags: buildTransportFlags({
      childCapabilityId: input.contract.childCapabilityId,
      envelopeRef: input.transport.envelopeRef,
      status: outcomeState.status,
      transportMessage: input.transport.message,
    }),
    boundaryDecision: input.contract.boundaryDecision,
    commandDecision: "accepted-by-command-gate",
    readDecision: null,
    transportDecision: input.transport.status,
    hardStopDecision: resolveHardStopDecision({ hardStopPriority: input.contract.hardStopPriority, status: outcomeState.status }),
    policyDecision: outcomeState.status === "success" ? "allowed" : outcomeState.status === "review_required" ? "review_required" : "blocked",
  };
};

export async function executeCommanderCommandChild<TInput>(input: CommandExecutorInput<TInput>): Promise<CommanderExecutionOutcome<CommanderCommandReceiptView>> {
  const commandInput = input.buildCommandInput(input.input);
  const gated = gateCommanderCommand({
    childCapabilityId: input.contract.childCapabilityId,
    operatorRef: input.operatorRef,
    commandInput,
  });

  if (!gated.ok) {
    return createBlockedCommandOutcome({ contract: input.contract, commandInput, gated });
  }

  try {
    const transport = parseCommandTransportResult(await input.context.commandTransport.emitHumanCommand(gated.command));
    return createTransportOutcome({ contract: input.contract, commandInput, gated, transport });
  } catch (error) {
    return createTransportFailureOutcome({ contract: input.contract, commandInput, gated, error });
  }
}