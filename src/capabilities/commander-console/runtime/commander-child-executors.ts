import type { ZodType } from "zod";

import type {
  CommanderCommandChildContract,
  CommanderConsoleChildRuntimeInput,
  CommanderHumanCommandInput,
  CommanderReadChildContract,
} from "../contract.js";
import type { CommanderConsoleChildContext } from "./commander-console-executor.js";
import { deriveCommandEvidenceRefs, deriveCommandTargetRecordRef, missingEnvelopeFlag } from "./commander-boundary-policy.js";
import { gateCommanderCommand, parseCommandTransportResult } from "./commander-command-gate.js";
import { gateCommanderRead } from "./commander-read-gate.js";
import { buildCommanderCommandReceipt } from "./commander-result-builder.js";
import { commanderFlag, type CommanderDataQualityFlag, type CommanderEvidenceRef } from "../shared/commander-proof.js";
import type { CommanderExecutionOutcome } from "../shared/commander-result.js";
import type { CommanderCommandReceiptView } from "../shared/commander-view-types.js";

function buildCommandReceipt(input: {
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
}): CommanderCommandReceiptView {
  return buildCommanderCommandReceipt({
    commandId: input.commandId,
    commandType: input.commandType,
    priority: input.priority,
    envelopeRef: input.envelopeRef,
    resultEnvelopeRef: input.resultEnvelopeRef,
    transportStatus: input.transportStatus,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    targetMissionId: input.targetMissionId,
    targetRecordId: input.targetRecordId,
    message: input.message,
  });
}

export async function executeCommanderCommandChild<TInput>(input: {
  contract: CommanderCommandChildContract;
  input: TInput;
  operatorRef: string;
  context: CommanderConsoleChildContext;
  buildCommandInput: (childInput: TInput) => CommanderHumanCommandInput;
}): Promise<CommanderExecutionOutcome<CommanderCommandReceiptView>> {
  const commandInput = input.buildCommandInput(input.input);
  const gated = gateCommanderCommand({
    childCapabilityId: input.contract.childCapabilityId,
    operatorRef: input.operatorRef,
    commandInput,
  });

  if (!gated.ok) {
    const receipt = buildCommandReceipt({
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
    return {
      status: "failed",
      output: receipt,
      failureReason: gated.reason,
      reviewRequiredReason: null,
      inputRef: gated.inputRef,
      outputRef: `commander_receipt:${gated.commandId}`,
      commandId: gated.commandId,
      readRequestId: null,
      runId: null,
      missionId: gated.targetMissionId,
      traceId: null,
      commandEnvelopeRef: null,
      resultEnvelopeRef: null,
      readModelSource: null,
      targetRecordRef: gated.targetRecordRef,
      evidenceRefs: deriveCommandEvidenceRefs(commandInput, input.contract.evidencePolicy),
      dataQualityFlags: [
        commanderFlag(
          input.contract.childCapabilityId === "emergency-stop" ? "hard_stop_gate_failed" : "command_gate_blocked",
          "fatal",
          gated.reason,
        ),
      ],
      boundaryDecision: input.contract.boundaryDecision,
      commandDecision: "blocked-by-command-gate",
      readDecision: null,
      transportDecision: "not-dispatched",
      hardStopDecision: input.contract.hardStopPriority === "emergency" ? "hard-stop-required" : "not-hard-stop",
      policyDecision: "blocked",
    };
  }

  try {
    const transport = parseCommandTransportResult(await input.context.commandTransport.emitHumanCommand(gated.command));
    const transportStatus = transport.status;
    const status = transportStatus === "accepted" ? "success" : transportStatus;
    const failureReason = status === "failed" ? (transport.failureReason ?? transport.message) : null;
    const reviewRequiredReason = status === "review_required" ? (transport.reviewRequiredReason ?? transport.message) : null;
    const receipt = buildCommandReceipt({
      commandId: gated.command.commandId,
      commandType: gated.command.commandType,
      priority: gated.command.priority,
      envelopeRef: transport.envelopeRef,
      resultEnvelopeRef: transport.resultEnvelopeRef,
      transportStatus,
      failureReason,
      reviewRequiredReason,
      targetMissionId: gated.command.targetMissionId,
      targetRecordId: gated.command.targetRecordRef?.recordId ?? null,
      message: transport.message,
    });
    const flags: CommanderDataQualityFlag[] = [];
    if (!transport.envelopeRef) {
      flags.push(missingEnvelopeFlag());
    }
    if (status !== "success") {
      flags.push(
        commanderFlag(
          input.contract.childCapabilityId === "emergency-stop" ? "hard_stop_guarded" : "transport_guarded",
          status === "failed" ? "fatal" : "warn",
          transport.message,
        ),
      );
    }
    if (input.contract.childCapabilityId === "emergency-stop") {
      flags.push(commanderFlag("hard_stop", "info", "Emergency stop executed through the hard command path."));
    }
    return {
      status,
      output: receipt,
      failureReason,
      reviewRequiredReason,
      inputRef: gated.inputRef,
      outputRef: `commander_receipt:${gated.command.commandId}`,
      commandId: gated.command.commandId,
      readRequestId: null,
      runId: null,
      missionId: gated.command.targetMissionId,
      traceId: null,
      commandEnvelopeRef: transport.envelopeRef,
      resultEnvelopeRef: transport.resultEnvelopeRef,
      readModelSource: null,
      targetRecordRef: deriveCommandTargetRecordRef(commandInput),
      evidenceRefs: deriveCommandEvidenceRefs(commandInput, input.contract.evidencePolicy),
      dataQualityFlags: flags,
      boundaryDecision: input.contract.boundaryDecision,
      commandDecision: "accepted-by-command-gate",
      readDecision: null,
      transportDecision: transportStatus,
      hardStopDecision: input.contract.hardStopPriority === "emergency"
        ? (status === "success"
          ? "hard-stop-dispatched"
          : status === "review_required"
            ? "hard-stop-review-required"
            : "hard-stop-dispatch-failed")
        : "not-hard-stop",
      policyDecision: status === "success" ? "allowed" : status === "review_required" ? "review_required" : "blocked",
    };
  } catch (error) {
    const failureReason = error instanceof Error && error.message.trim()
      ? error.message
      : "Commander command transport failed unexpectedly.";
    const receipt = buildCommandReceipt({
      commandId: gated.command.commandId,
      commandType: gated.command.commandType,
      priority: gated.command.priority,
      envelopeRef: null,
      resultEnvelopeRef: null,
      transportStatus: "failed",
      failureReason,
      reviewRequiredReason: null,
      targetMissionId: gated.command.targetMissionId,
      targetRecordId: gated.command.targetRecordRef?.recordId ?? null,
      message: failureReason,
    });
    return {
      status: "failed",
      output: receipt,
      failureReason,
      reviewRequiredReason: null,
      inputRef: gated.inputRef,
      outputRef: `commander_receipt:${gated.command.commandId}`,
      commandId: gated.command.commandId,
      readRequestId: null,
      runId: null,
      missionId: gated.command.targetMissionId,
      traceId: null,
      commandEnvelopeRef: null,
      resultEnvelopeRef: null,
      readModelSource: null,
      targetRecordRef: deriveCommandTargetRecordRef(commandInput),
      evidenceRefs: deriveCommandEvidenceRefs(commandInput, input.contract.evidencePolicy),
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
  }
}

export async function executeCommanderReadChild<TInput, TOutput>(input: {
  contract: CommanderReadChildContract;
  operatorRef: string;
  rawInput: unknown;
  inputSchema: ZodType<TInput>;
  context: CommanderConsoleChildContext;
  read: (parsedInput: TInput, context: CommanderConsoleChildContext) => Promise<TOutput>;
  buildEvidenceRefs: (output: TOutput) => CommanderEvidenceRef[];
  buildOutputPolicy?: (output: TOutput) => {
    status?: "success" | "review_required";
    failureReason?: string | null;
    reviewRequiredReason?: string | null;
    targetRecordRef?: CommanderExecutionOutcome<TOutput>["targetRecordRef"];
    missionId?: string | null;
    dataQualityFlags?: CommanderDataQualityFlag[];
  };
}): Promise<CommanderExecutionOutcome<TOutput>> {
  const gated = gateCommanderRead({
    childCapabilityId: input.contract.childCapabilityId,
    operatorRef: input.operatorRef,
    readInput: input.rawInput,
    inputSchema: input.inputSchema,
  });

  if (!gated.ok) {
    return {
      status: "failed",
      output: null,
      failureReason: gated.reason,
      reviewRequiredReason: null,
      inputRef: gated.inputRef,
      outputRef: null,
      commandId: null,
      readRequestId: gated.readRequestId,
      runId: null,
      missionId: null,
      traceId: null,
      commandEnvelopeRef: null,
      resultEnvelopeRef: null,
      readModelSource: input.contract.readModelSource,
      targetRecordRef: null,
      evidenceRefs: [],
      dataQualityFlags: [commanderFlag("read_gate_blocked", "fatal", gated.reason)],
      boundaryDecision: input.contract.boundaryDecision,
      commandDecision: null,
      readDecision: "blocked-by-read-gate",
      transportDecision: null,
      hardStopDecision: null,
      policyDecision: "blocked",
    };
  }

  try {
    const output = await input.read(gated.parsedInput, input.context);
    const policy = input.buildOutputPolicy?.(output);
    const status = policy?.status ?? "success";
    return {
      status,
      output,
      failureReason: policy?.failureReason ?? null,
      reviewRequiredReason: policy?.reviewRequiredReason ?? null,
      inputRef: gated.inputRef,
      outputRef: `commander_read_output:${input.contract.childCapabilityId}:${gated.readRequestId}`,
      commandId: null,
      readRequestId: gated.readRequestId,
      runId: null,
      missionId: policy?.missionId ?? null,
      traceId: null,
      commandEnvelopeRef: null,
      resultEnvelopeRef: null,
      readModelSource: input.contract.readModelSource,
      targetRecordRef: policy?.targetRecordRef ?? null,
      evidenceRefs: input.buildEvidenceRefs(output),
      dataQualityFlags: policy?.dataQualityFlags ?? [],
      boundaryDecision: input.contract.boundaryDecision,
      commandDecision: null,
      readDecision: "accepted-by-read-gate",
      transportDecision: null,
      hardStopDecision: null,
      policyDecision: status === "success" ? "allowed" : "review_required",
    };
  } catch (error) {
    const failureReason = error instanceof Error && error.message.trim()
      ? error.message
      : `${input.contract.childCapabilityId} read execution failed.`;
    return {
      status: "failed",
      output: null,
      failureReason,
      reviewRequiredReason: null,
      inputRef: gated.inputRef,
      outputRef: null,
      commandId: null,
      readRequestId: gated.readRequestId,
      runId: null,
      missionId: null,
      traceId: null,
      commandEnvelopeRef: null,
      resultEnvelopeRef: null,
      readModelSource: input.contract.readModelSource,
      targetRecordRef: null,
      evidenceRefs: [],
      dataQualityFlags: [commanderFlag("execution_error", "fatal", failureReason)],
      boundaryDecision: input.contract.boundaryDecision,
      commandDecision: null,
      readDecision: "accepted-by-read-gate",
      transportDecision: null,
      hardStopDecision: null,
      policyDecision: "blocked",
    };
  }
}