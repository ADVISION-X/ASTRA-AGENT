import type {
  CommanderCommandChildContract,
  CommanderHumanCommandInput,
} from "../contract.js";
import { commanderFlag, type CommanderDataQualityFlag } from "../shared/commander-proof.js";
import type { CommanderExecutionOutcome } from "../shared/commander-result.js";
import type { CommanderCommandReceiptView } from "../shared/commander-view-types.js";
import { deriveCommandEvidenceRefs, deriveCommandTargetRecordRef, missingEnvelopeFlag } from "./commander-boundary-policy.js";
import { gateCommanderCommand } from "./commander-command-gate.js";
import { buildCommanderCommandReceipt } from "./commander-result-builder.js";
import type { CommanderTransportSemanticResult } from "./commander-transport-semantic-gate.js";

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
}) => buildCommanderCommandReceipt(input);

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

const buildBlockedCommandReceipt = (gated: Extract<ReturnType<typeof gateCommanderCommand>, { ok: false }>) => {
  return buildCommandReceipt({
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
};

const buildBlockedCommandFlags = (input: {
  contract: CommanderCommandChildContract;
  reason: string;
}) => {
  return [
    commanderFlag(
      input.contract.childCapabilityId === "emergency-stop" ? "hard_stop_gate_failed" : "command_gate_blocked",
      "fatal",
      input.reason,
    ),
  ];
};

const buildTransportOutcomeReceipt = (input: {
  gated: Extract<ReturnType<typeof gateCommanderCommand>, { ok: true }>;
  transport: CommanderTransportSemanticResult;
  failureReason: string | null;
  reviewRequiredReason: string | null;
}) => {
  return buildCommandReceipt({
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
};

const resolveTransportOutcomeState = (transport: CommanderTransportSemanticResult) => {
  const status: "success" | "failed" | "review_required" = transport.status === "accepted" ? "success" : transport.status;
  return {
    status,
    failureReason: status === "failed" ? (transport.failureReason ?? transport.message) : null,
    reviewRequiredReason: status === "review_required" ? (transport.reviewRequiredReason ?? transport.message) : null,
  };
};

export const createBlockedCommandOutcome = (input: {
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

export const createTransportOutcome = (input: {
  contract: CommanderCommandChildContract;
  commandInput: CommanderHumanCommandInput;
  gated: Extract<ReturnType<typeof gateCommanderCommand>, { ok: true }>;
  transport: CommanderTransportSemanticResult;
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
    dataQualityFlags: [
      ...buildTransportFlags({
        childCapabilityId: input.contract.childCapabilityId,
        envelopeRef: input.transport.envelopeRef,
        status: outcomeState.status,
        transportMessage: input.transport.message,
      }),
      ...input.transport.dataQualityFlags,
    ],
    boundaryDecision: input.contract.boundaryDecision,
    commandDecision: "accepted-by-command-gate",
    readDecision: null,
    transportDecision: input.transport.status === "accepted" ? "accepted" : input.transport.status,
    hardStopDecision: resolveHardStopDecision({ hardStopPriority: input.contract.hardStopPriority, status: outcomeState.status }),
    policyDecision: outcomeState.status === "success" ? "allowed" : outcomeState.status === "review_required" ? "review_required" : "blocked",
  };
};

export const createCommandTimeoutOutcome = (input: {
  contract: CommanderCommandChildContract;
  commandInput: CommanderHumanCommandInput;
  gated: Extract<ReturnType<typeof gateCommanderCommand>, { ok: true }>;
  idempotencyDecision: CommanderExecutionOutcome<CommanderCommandReceiptView>["idempotencyDecision"];
}): CommanderExecutionOutcome<CommanderCommandReceiptView> => {
  const reviewRequiredReason = `${input.contract.childCapabilityId} timed out after ${input.contract.maxDurationMs}ms.`;
  return {
    status: "review_required",
    output: buildCommandReceipt({
      commandId: input.gated.command.commandId,
      commandType: input.gated.command.commandType,
      priority: input.gated.command.priority,
      envelopeRef: null,
      resultEnvelopeRef: null,
      transportStatus: "review_required",
      failureReason: null,
      reviewRequiredReason,
      targetMissionId: input.gated.command.targetMissionId,
      targetRecordId: input.gated.command.targetRecordRef?.recordId ?? null,
      message: reviewRequiredReason,
    }),
    failureReason: null,
    reviewRequiredReason,
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
    dataQualityFlags: [commanderFlag("timeout_guarded", "warn", reviewRequiredReason)],
    boundaryDecision: input.contract.boundaryDecision,
    commandDecision: "accepted-by-command-gate",
    readDecision: null,
    transportDecision: "review_required",
    hardStopDecision: input.contract.hardStopPriority === "emergency" ? "hard-stop-review-required" : "not-hard-stop",
    timeoutDecision: "timed-out-review-required",
    idempotencyDecision: input.idempotencyDecision ?? "not-applicable",
    policyDecision: "review_required",
  };
};