import type { ZodType } from "zod";

import type { CommanderReadChildContract } from "../contract.js";
import type { CommanderConsoleChildContext } from "./commander-console-executor.js";
import { gateCommanderRead } from "./commander-read-gate.js";
import { commanderFlag, type CommanderDataQualityFlag, type CommanderEvidenceRef } from "../shared/commander-proof.js";
import type { CommanderExecutionOutcome } from "../shared/commander-result.js";

type ReadExecutorInput<TInput, TOutput> = {
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
};

const createBlockedReadOutcome = <TOutput>(input: {
  contract: CommanderReadChildContract;
  gated: Extract<ReturnType<typeof gateCommanderRead>, { ok: false }>;
}): CommanderExecutionOutcome<TOutput> => ({
  status: "failed",
  output: null,
  failureReason: input.gated.reason,
  reviewRequiredReason: null,
  inputRef: input.gated.inputRef,
  outputRef: null,
  commandId: null,
  readRequestId: input.gated.readRequestId,
  runId: null,
  missionId: null,
  traceId: null,
  commandEnvelopeRef: null,
  resultEnvelopeRef: null,
  readModelSource: input.contract.readModelSource,
  targetRecordRef: null,
  evidenceRefs: [],
  dataQualityFlags: [commanderFlag("read_gate_blocked", "fatal", input.gated.reason)],
  boundaryDecision: input.contract.boundaryDecision,
  commandDecision: null,
  readDecision: "blocked-by-read-gate",
  transportDecision: null,
  hardStopDecision: null,
  policyDecision: "blocked",
});

const createReadSuccessOutcome = <TOutput>(input: {
  contract: CommanderReadChildContract;
  gated: Extract<ReturnType<typeof gateCommanderRead>, { ok: true }>;
  output: TOutput;
  buildEvidenceRefs: (output: TOutput) => CommanderEvidenceRef[];
  buildOutputPolicy?: ReadExecutorInput<unknown, TOutput>["buildOutputPolicy"];
}): CommanderExecutionOutcome<TOutput> => {
  const policy = input.buildOutputPolicy?.(input.output);
  const status = policy?.status ?? "success";
  return {
    status,
    output: input.output,
    failureReason: policy?.failureReason ?? null,
    reviewRequiredReason: policy?.reviewRequiredReason ?? null,
    inputRef: input.gated.inputRef,
    outputRef: `commander_read_output:${input.contract.childCapabilityId}:${input.gated.readRequestId}`,
    commandId: null,
    readRequestId: input.gated.readRequestId,
    runId: null,
    missionId: policy?.missionId ?? null,
    traceId: null,
    commandEnvelopeRef: null,
    resultEnvelopeRef: null,
    readModelSource: input.contract.readModelSource,
    targetRecordRef: policy?.targetRecordRef ?? null,
    evidenceRefs: input.buildEvidenceRefs(input.output),
    dataQualityFlags: policy?.dataQualityFlags ?? [],
    boundaryDecision: input.contract.boundaryDecision,
    commandDecision: null,
    readDecision: "accepted-by-read-gate",
    transportDecision: null,
    hardStopDecision: null,
    policyDecision: status === "success" ? "allowed" : "review_required",
  };
};

const createReadFailureOutcome = <TOutput>(input: {
  contract: CommanderReadChildContract;
  gated: Extract<ReturnType<typeof gateCommanderRead>, { ok: true }>;
  error: unknown;
}): CommanderExecutionOutcome<TOutput> => {
  const failureReason = input.error instanceof Error && input.error.message.trim()
    ? input.error.message
    : `${input.contract.childCapabilityId} read execution failed.`;
  return {
    status: "failed",
    output: null,
    failureReason,
    reviewRequiredReason: null,
    inputRef: input.gated.inputRef,
    outputRef: null,
    commandId: null,
    readRequestId: input.gated.readRequestId,
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
};

export async function executeCommanderReadChild<TInput, TOutput>(input: ReadExecutorInput<TInput, TOutput>): Promise<CommanderExecutionOutcome<TOutput>> {
  const gated = gateCommanderRead({
    childCapabilityId: input.contract.childCapabilityId,
    operatorRef: input.operatorRef,
    readInput: input.rawInput,
    inputSchema: input.inputSchema,
  });

  if (!gated.ok) {
    return createBlockedReadOutcome({ contract: input.contract, gated });
  }

  try {
    const output = await input.read(gated.parsedInput, input.context);
    return createReadSuccessOutcome({
      contract: input.contract,
      gated,
      output,
      buildEvidenceRefs: input.buildEvidenceRefs,
      buildOutputPolicy: input.buildOutputPolicy,
    });
  } catch (error) {
    return createReadFailureOutcome({ contract: input.contract, gated, error });
  }
}