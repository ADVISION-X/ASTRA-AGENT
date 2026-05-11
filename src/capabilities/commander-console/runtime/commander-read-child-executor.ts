import type { ZodType } from "zod";

import type { CommanderReadChildContract } from "../contract.js";
import type { CommanderConsoleChildContext } from "./commander-console-executor.js";
import { gateCommanderRead, type CommanderReadGateSuccess } from "./commander-read-gate.js";
import { commanderFlag, type CommanderDataQualityFlag, type CommanderEvidenceRef } from "../shared/commander-proof.js";
import type { CommanderExecutionOutcome } from "../shared/commander-result.js";
import { runCommanderIdempotencyGate } from "./commander-idempotency-gate.js";
import { applyCommanderReadProofGate } from "./commander-read-proof-gate.js";
import { runCommanderTimeoutGate } from "./commander-timeout-gate.js";

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

type ReadTimeoutSuccess<TOutput> = Extract<
  Awaited<ReturnType<typeof runCommanderTimeoutGate<CommanderExecutionOutcome<TOutput>>>>,
  { timedOut: false }
>;

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
  timeoutDecision: "not-applicable",
  idempotencyDecision: "not-applicable",
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
  const proofGate = applyCommanderReadProofGate({
    contract: input.contract,
    evidenceRefs: input.buildEvidenceRefs(input.output),
    targetRecordRef: policy?.targetRecordRef ?? null,
    missionId: policy?.missionId ?? null,
    dataQualityFlags: policy?.dataQualityFlags ?? [],
  });
  const status = proofGate.status === "review_required" ? "review_required" : policy?.status ?? "success";
  return {
    status,
    output: input.output,
    failureReason: policy?.failureReason ?? null,
    reviewRequiredReason: proofGate.reviewRequiredReason ?? policy?.reviewRequiredReason ?? null,
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
    targetRecordRef: proofGate.targetRecordRef,
    evidenceRefs: proofGate.evidenceRefs,
    dataQualityFlags: proofGate.dataQualityFlags,
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

const createReadTimeoutOutcome = <TOutput>(input: {
  contract: CommanderReadChildContract;
  gated: Extract<ReturnType<typeof gateCommanderRead>, { ok: true }>;
  idempotencyDecision: CommanderExecutionOutcome<TOutput>["idempotencyDecision"];
}): CommanderExecutionOutcome<TOutput> => {
  const reviewRequiredReason = `${input.contract.childCapabilityId} timed out after ${input.contract.maxDurationMs}ms.`;
  return {
    status: "review_required",
    output: null,
    failureReason: null,
    reviewRequiredReason,
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
    dataQualityFlags: [commanderFlag("timeout_guarded", "warn", reviewRequiredReason)],
    boundaryDecision: input.contract.boundaryDecision,
    commandDecision: null,
    readDecision: "accepted-by-read-gate",
    transportDecision: null,
    hardStopDecision: null,
    timeoutDecision: "timed-out-review-required",
    idempotencyDecision: input.idempotencyDecision ?? "not-applicable",
    policyDecision: "review_required",
  };
};

const runReadExecution = async <TInput, TOutput>(input: ReadExecutorInput<TInput, TOutput> & {
  gated: CommanderReadGateSuccess<TInput>;
}): Promise<{
  timeoutResult: Awaited<ReturnType<typeof runCommanderTimeoutGate<CommanderExecutionOutcome<TOutput>>>>;
  idempotencyDecision: CommanderExecutionOutcome<TOutput>["idempotencyDecision"];
}> => {
  let idempotencyDecision: CommanderExecutionOutcome<TOutput>["idempotencyDecision"] = "not-applicable";
  const timeoutResult = await runCommanderTimeoutGate<CommanderExecutionOutcome<TOutput>>({
    maxDurationMs: input.contract.maxDurationMs,
    run: () => {
      const idempotencyGate = runCommanderIdempotencyGate<CommanderExecutionOutcome<TOutput>>({
        state: input.context.idempotencyState,
        childCapabilityId: input.contract.childCapabilityId,
        operatorRef: input.operatorRef,
        policy: input.contract.idempotencyPolicy,
        payload: input.gated.parsedInput,
        execute: async () => {
          try {
            const output = await input.read(input.gated.parsedInput, input.context);
            return createReadSuccessOutcome({
              contract: input.contract,
              gated: input.gated,
              output,
              buildEvidenceRefs: input.buildEvidenceRefs,
              buildOutputPolicy: input.buildOutputPolicy,
            });
          } catch (error) {
            return createReadFailureOutcome({ contract: input.contract, gated: input.gated, error });
          }
        },
      });
      idempotencyDecision = idempotencyGate.idempotencyDecision;
      return idempotencyGate.resultPromise;
    },
  });
  return { timeoutResult, idempotencyDecision };
};

const finalizeReadExecution = <TOutput>(input: {
  timeoutResult: ReadTimeoutSuccess<TOutput>;
  idempotencyDecision: CommanderExecutionOutcome<TOutput>["idempotencyDecision"];
}): CommanderExecutionOutcome<TOutput> => ({
  ...input.timeoutResult.value,
  timeoutDecision: input.timeoutResult.timeoutDecision,
  idempotencyDecision: input.idempotencyDecision ?? "not-applicable",
});

export async function executeCommanderReadChild<TInput, TOutput>(input: ReadExecutorInput<TInput, TOutput>): Promise<CommanderExecutionOutcome<TOutput>> {
  const gated = gateCommanderRead({
    childCapabilityId: input.contract.childCapabilityId as import("../contract.js").CommanderReadChildAbilityId,
    operatorRef: input.operatorRef,
    readInput: input.rawInput,
    inputSchema: input.inputSchema,
  });

  if (!gated.ok) {
    return createBlockedReadOutcome({ contract: input.contract, gated });
  }

  const execution = await runReadExecution({ ...input, gated });

  if (execution.timeoutResult.timedOut) {
    return createReadTimeoutOutcome({
      contract: input.contract,
      gated,
      idempotencyDecision: execution.idempotencyDecision,
    });
  }

  const timeoutResult = execution.timeoutResult;

  return finalizeReadExecution({
    timeoutResult,
    idempotencyDecision: execution.idempotencyDecision,
  });
}