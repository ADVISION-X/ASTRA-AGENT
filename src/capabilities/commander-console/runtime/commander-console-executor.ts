import type { ZodType } from "zod";

import type { CommanderConsoleChildAbilityId, CommanderConsoleInput, CreateCommanderConsoleAbilityGroupInput } from "../contract.js";
import { resolveCommanderBoundaryDecision } from "./commander-boundary-policy.js";
import { describeCommanderUnhandledError } from "./commander-dispatch-failure.js";
import { buildCommanderRuntimeProof } from "./commander-proof-builder.js";
import { buildCommanderConsoleResult } from "./commander-result-builder.js";
import type { CommanderExecutionOutcome, CommanderConsoleResult } from "../shared/commander-result.js";

export type CommanderConsoleChildContext = CreateCommanderConsoleAbilityGroupInput & {
  now: () => string;
};

export type CommanderConsoleChildDefinition<TInput, TOutput> = {
  childCapabilityId: CommanderConsoleChildAbilityId;
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  execute(input: { operatorRef: string; input: TInput }, context: CommanderConsoleChildContext): Promise<CommanderExecutionOutcome<TOutput>>;
};

export async function executeCommanderConsoleChild<TInput, TOutput>(input: {
  child: CommanderConsoleChildDefinition<TInput, TOutput>;
  executionInput: CommanderConsoleInput;
  context: CommanderConsoleChildContext;
}): Promise<CommanderConsoleResult<TOutput>> {
  const startedAt = input.context.now();
  const parsedInput = input.child.inputSchema.parse(input.executionInput.input) as TInput;

  try {
    const outcome = await input.child.execute({ operatorRef: input.executionInput.operatorRef, input: parsedInput }, input.context);
    const endedAt = input.context.now();
    const parsedOutput = outcome.output === null ? null : input.child.outputSchema.parse(outcome.output);
    return buildCommanderConsoleResult({
      childCapabilityId: input.child.childCapabilityId,
      status: outcome.status,
      output: parsedOutput,
      failureReason: outcome.failureReason,
      reviewRequiredReason: outcome.reviewRequiredReason,
      runtimeProof: buildCommanderRuntimeProof({
        childCapabilityId: input.child.childCapabilityId,
        operatorRef: input.executionInput.operatorRef,
        status: outcome.status,
        startedAt,
        endedAt,
        inputRef: outcome.inputRef,
        outputRef: outcome.outputRef,
        evidenceRefs: outcome.evidenceRefs,
        dataQualityFlags: outcome.dataQualityFlags,
        boundaryDecision: outcome.boundaryDecision ?? resolveCommanderBoundaryDecision(input.child.childCapabilityId),
        ...(resolveCommanderBoundaryDecision(input.child.childCapabilityId) === "command-transport-only"
          ? { commandId: outcome.outputRef }
          : { readRequestId: outcome.inputRef }),
      }),
    });
  } catch (error) {
    const endedAt = input.context.now();
    const failure = describeCommanderUnhandledError(error);
    return buildCommanderConsoleResult({
      childCapabilityId: input.child.childCapabilityId,
      status: failure.status,
      output: null,
      failureReason: failure.failureReason,
      reviewRequiredReason: failure.reviewRequiredReason,
      runtimeProof: buildCommanderRuntimeProof({
        childCapabilityId: input.child.childCapabilityId,
        operatorRef: input.executionInput.operatorRef,
        status: failure.status,
        startedAt,
        endedAt,
        inputRef: input.executionInput.childCapabilityId,
        outputRef: null,
        evidenceRefs: [],
        dataQualityFlags: failure.dataQualityFlags,
        boundaryDecision: resolveCommanderBoundaryDecision(input.child.childCapabilityId),
        ...(resolveCommanderBoundaryDecision(input.child.childCapabilityId) === "command-transport-only"
          ? { commandId: null }
          : { readRequestId: input.executionInput.childCapabilityId }),
      }),
    });
  }
}