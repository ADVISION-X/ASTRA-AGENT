import type {
  CommanderCommandChildContract,
  CommanderHumanCommandInput,
} from "../contract.js";
import type { CommanderConsoleChildContext } from "./commander-console-executor.js";
import { gateCommanderCommand } from "./commander-command-gate.js";
import {
  createBlockedCommandOutcome,
  createCommandTimeoutOutcome,
  createTransportOutcome,
} from "./commander-command-outcomes.js";
import { createTransportFailureOutcome } from "./commander-command-transport-failure.js";
import type { CommanderExecutionOutcome } from "../shared/commander-result.js";
import type { CommanderCommandReceiptView } from "../shared/commander-view-types.js";
import { runCommanderIdempotencyGate } from "./commander-idempotency-gate.js";
import { runCommanderTimeoutGate } from "./commander-timeout-gate.js";
import {
  applyCommanderTransportSemanticGate,
  type CommanderTransportSemanticResult,
} from "./commander-transport-semantic-gate.js";

type CommandExecutorInput<TInput> = {
  contract: CommanderCommandChildContract;
  input: TInput;
  operatorRef: string;
  context: CommanderConsoleChildContext;
  buildCommandInput: (childInput: TInput) => CommanderHumanCommandInput;
};

type CommandTimeoutSuccess = Extract<
  Awaited<ReturnType<typeof runCommanderTimeoutGate<CommanderExecutionOutcome<CommanderCommandReceiptView>>>>,
  { timedOut: false }
>;

const resolveInitialIdempotencyDecision = (contract: CommanderCommandChildContract) => {
  return contract.idempotencyPolicy === "hard-stop-non-dedupe" ? "emergency-bypass" as const : "not-applicable" as const;
};

const runTransportExecution = async <TInput>(input: {
  contract: CommanderCommandChildContract;
  commandInput: CommanderHumanCommandInput;
  gated: Extract<ReturnType<typeof gateCommanderCommand>, { ok: true }>;
  operatorRef: string;
  context: CommanderConsoleChildContext;
}): Promise<{
  timeoutResult: Awaited<ReturnType<typeof runCommanderTimeoutGate<CommanderExecutionOutcome<CommanderCommandReceiptView>>>>;
  idempotencyDecision: CommanderExecutionOutcome<CommanderCommandReceiptView>["idempotencyDecision"];
}> => {
  let idempotencyDecision: CommanderExecutionOutcome<CommanderCommandReceiptView>["idempotencyDecision"] = resolveInitialIdempotencyDecision(input.contract);
  const timeoutResult = await runCommanderTimeoutGate<CommanderExecutionOutcome<CommanderCommandReceiptView>>({
    maxDurationMs: input.contract.maxDurationMs,
    run: () => {
      const idempotencyGate = runCommanderIdempotencyGate<CommanderExecutionOutcome<CommanderCommandReceiptView>>({
        state: input.context.idempotencyState,
        childCapabilityId: input.contract.childCapabilityId,
        operatorRef: input.operatorRef,
        policy: input.contract.idempotencyPolicy,
        payload: input.commandInput,
        execute: async () => {
          try {
            const rawTransport = await input.context.commandTransport.emitHumanCommand(input.gated.command);
            const transport = applyCommanderTransportSemanticGate({
              command: input.gated.command,
              transport: rawTransport,
            });
            return createTransportOutcome({
              contract: input.contract,
              commandInput: input.commandInput,
              gated: input.gated,
              transport,
            });
          } catch (error) {
            return createTransportFailureOutcome({ contract: input.contract, commandInput: input.commandInput, gated: input.gated, error });
          }
        },
      });
      idempotencyDecision = idempotencyGate.idempotencyDecision;
      return idempotencyGate.resultPromise;
    },
  });
  return { timeoutResult, idempotencyDecision };
};

const finalizeCommandExecution = (input: {
  timeoutResult: CommandTimeoutSuccess;
  idempotencyDecision: CommanderExecutionOutcome<CommanderCommandReceiptView>["idempotencyDecision"];
}) => ({
  ...input.timeoutResult.value,
  timeoutDecision: input.timeoutResult.timeoutDecision,
  idempotencyDecision: input.idempotencyDecision ?? "not-applicable",
});

export async function executeCommanderCommandChild<TInput>(input: CommandExecutorInput<TInput>): Promise<CommanderExecutionOutcome<CommanderCommandReceiptView>> {
  const commandInput = input.buildCommandInput(input.input);
  const gated = gateCommanderCommand({
    childCapabilityId: input.contract.childCapabilityId as import("../shared/commander-schema-base.js").CommanderCommandChildAbilityId,
    operatorRef: input.operatorRef,
    commandInput,
    maxDurationMs: input.contract.maxDurationMs,
  });

  if (!gated.ok) {
    return {
      ...createBlockedCommandOutcome({ contract: input.contract, commandInput, gated }),
      timeoutDecision: "not-applicable",
      idempotencyDecision: "not-applicable",
    };
  }

  const execution = await runTransportExecution({
    contract: input.contract,
    commandInput,
    gated,
    operatorRef: input.operatorRef,
    context: input.context,
  });

  if (execution.timeoutResult.timedOut) {
    return createCommandTimeoutOutcome({
      contract: input.contract,
      commandInput,
      gated,
      idempotencyDecision: execution.idempotencyDecision,
    });
  }

  const timeoutResult = execution.timeoutResult;

  return finalizeCommandExecution({
    timeoutResult,
    idempotencyDecision: execution.idempotencyDecision,
  });
}