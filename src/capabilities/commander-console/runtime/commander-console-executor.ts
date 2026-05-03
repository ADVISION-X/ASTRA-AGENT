import type { ZodType } from "zod";

import type {
  CommanderChildContract,
  CommanderConsoleChildRuntimeInput,
  CommanderConsoleInput,
  CreateCommanderConsoleAbilityGroupInput,
} from "../contract.js";
import { commanderFlag } from "../shared/commander-proof.js";
import type { CommanderConsoleResult, CommanderExecutionOutcome } from "../shared/commander-result.js";
import { buildCommanderRuntimeProof } from "./commander-proof-builder.js";
import { buildCommanderConsoleResult } from "./commander-result-builder.js";
import { createMissingChildOutcome, describeCommanderUnhandledError } from "./commander-dispatch-failure.js";
import type { CommanderIdempotencyState } from "./commander-idempotency-gate.js";

export type CommanderConsoleChildContext = Omit<CreateCommanderConsoleAbilityGroupInput, "clock"> & {
  clock: NonNullable<CreateCommanderConsoleAbilityGroupInput["clock"]>;
  idempotencyState: CommanderIdempotencyState;
};

export type CommanderConsoleChildDefinition<TInput, TOutput> = CommanderChildContract & {
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  execute(
    input: CommanderConsoleChildRuntimeInput<TInput>,
    context: CommanderConsoleChildContext,
  ): Promise<CommanderExecutionOutcome<TOutput>>;
};

const resolveRuntimeProofChild = (input: {
  child: CommanderConsoleChildDefinition<unknown, unknown> | null;
  executionInput: CommanderConsoleInput;
}) => input.child
  ? {
    childCapabilityId: input.child.childCapabilityId,
    childKind: input.child.childKind,
    boundaryDecision: input.child.boundaryDecision,
    readModelSource: input.child.readModelSource,
  }
  : {
    childCapabilityId: input.executionInput.childCapabilityId,
    childKind: "read" as const,
    boundaryDecision: "blocked" as const,
    readModelSource: null,
  };

function createInputSchemaFailureOutcome<TOutput>(
  child: CommanderConsoleChildDefinition<unknown, TOutput>,
  message: string,
): CommanderExecutionOutcome<TOutput> {
  return {
    status: "failed",
    output: null,
    failureReason: message,
    reviewRequiredReason: null,
    inputRef: `${child.childCapabilityId}:input-schema-failed`,
    outputRef: null,
    commandId: null,
    readRequestId: null,
    runId: null,
    missionId: null,
    traceId: null,
    commandEnvelopeRef: null,
    resultEnvelopeRef: null,
    readModelSource: child.readModelSource,
    targetRecordRef: null,
    evidenceRefs: [],
    dataQualityFlags: [commanderFlag("input_schema_failed", "fatal", message)],
    boundaryDecision: child.boundaryDecision,
    commandDecision: child.childKind === "command" ? "blocked-by-command-gate" : null,
    readDecision: child.childKind === "read" ? "blocked-by-read-gate" : null,
    transportDecision: child.childKind === "command" ? "not-dispatched" : null,
    hardStopDecision: child.hardStopPriority === "emergency" ? "hard-stop-required" : null,
    policyDecision: "blocked",
  };
}

function createOutputSchemaFailureOutcome<TOutput>(
  child: CommanderConsoleChildDefinition<unknown, TOutput>,
  outcome: CommanderExecutionOutcome<TOutput>,
  message: string,
): CommanderExecutionOutcome<TOutput> {
  return {
    ...outcome,
    status: "failed",
    output: null,
    failureReason: message,
    reviewRequiredReason: null,
    dataQualityFlags: [...outcome.dataQualityFlags, commanderFlag("output_schema_failed", "fatal", message)],
    policyDecision: "blocked",
  };
}

function createExecutionErrorOutcome<TInput, TOutput>(
  child: CommanderConsoleChildDefinition<TInput, TOutput>,
  error: unknown,
): CommanderExecutionOutcome<TOutput> {
  const failureReason = describeCommanderUnhandledError(error);
  return {
    status: "failed",
    output: null,
    failureReason,
    reviewRequiredReason: null,
    inputRef: `${child.childCapabilityId}:execution-error`,
    outputRef: null,
    commandId: null,
    readRequestId: null,
    runId: null,
    missionId: null,
    traceId: null,
    commandEnvelopeRef: null,
    resultEnvelopeRef: null,
    readModelSource: child.readModelSource,
    targetRecordRef: null,
    evidenceRefs: [],
    dataQualityFlags: [commanderFlag("execution_error", "fatal", failureReason)],
    boundaryDecision: child.boundaryDecision,
    commandDecision: child.childKind === "command" ? "blocked-by-command-gate" : null,
    readDecision: child.childKind === "read" ? "blocked-by-read-gate" : null,
    transportDecision: child.childKind === "command" ? "not-dispatched" : null,
    hardStopDecision: child.hardStopPriority === "emergency" ? "hard-stop-dispatch-failed" : null,
    policyDecision: "blocked",
  };
}

function validateChildOutput<TInput, TOutput>(input: {
  child: CommanderConsoleChildDefinition<TInput, TOutput>;
  outcome: CommanderExecutionOutcome<TOutput>;
}): CommanderExecutionOutcome<TOutput> {
  if (input.outcome.output === null) {
    return input.outcome;
  }
  const parsedOutput = input.child.outputSchema.safeParse(input.outcome.output);
  if (!parsedOutput.success) {
    return createOutputSchemaFailureOutcome(
      input.child,
      input.outcome,
      parsedOutput.error.issues[0]?.message ?? `${input.child.childCapabilityId} output failed schema validation.`,
    );
  }
  return {
    ...input.outcome,
    output: parsedOutput.data,
    outputRef: input.outcome.outputRef ?? `commander_output:${input.child.childCapabilityId}`,
  };
}

async function executeChildOutcome<TInput, TOutput>(input: {
  child: CommanderConsoleChildDefinition<TInput, TOutput>;
  executionInput: CommanderConsoleInput;
  context: CommanderConsoleChildContext;
}): Promise<CommanderExecutionOutcome<TOutput>> {
  const parsedChildInput = input.child.inputSchema.safeParse(input.executionInput.input);
  if (!parsedChildInput.success) {
    return createInputSchemaFailureOutcome(
      input.child,
      parsedChildInput.error.issues[0]?.message ?? `${input.child.childCapabilityId} input failed schema validation.`,
    );
  }

  try {
    const outcome = await input.child.execute(
      {
        operatorRef: input.executionInput.operatorRef,
        input: parsedChildInput.data,
      },
      input.context,
    );
    return validateChildOutput({ child: input.child, outcome });
  } catch (error) {
    return createExecutionErrorOutcome(input.child, error);
  }
}

export async function executeCommanderConsoleChild<TInput, TOutput>(input: {
  child: CommanderConsoleChildDefinition<TInput, TOutput> | null;
  executionInput: CommanderConsoleInput;
  context: CommanderConsoleChildContext;
}): Promise<CommanderConsoleResult<TOutput>> {
  const startedAt = input.context.clock.nowIso();
  const startedMs = input.context.clock.monotonicNowMs();

  let outcome: CommanderExecutionOutcome<TOutput>;

  if (!input.child) {
    outcome = createMissingChildOutcome(input.executionInput.childCapabilityId, input.executionInput.operatorRef) as CommanderExecutionOutcome<TOutput>;
  } else {
    outcome = await executeChildOutcome({ child: input.child, executionInput: input.executionInput, context: input.context });
  }

  const endedAt = input.context.clock.nowIso();
  const endedMs = input.context.clock.monotonicNowMs();
  const runtimeProof = buildCommanderRuntimeProof({
    child: resolveRuntimeProofChild({ child: input.child, executionInput: input.executionInput }),
    operatorRef: input.executionInput.operatorRef,
    startedAt,
    endedAt,
    durationMs: input.context.clock.elapsedMs(startedMs, endedMs),
    outcome,
  });

  return buildCommanderConsoleResult({
    childCapabilityId: input.executionInput.childCapabilityId,
    status: outcome.status,
    output: outcome.output,
    failureReason: outcome.failureReason,
    reviewRequiredReason: outcome.reviewRequiredReason,
    runtimeProof,
  });
}