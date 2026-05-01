import type { ParsedTextInputAbilityInput } from "../contract.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";
import { finalizeTextInputExecutionResult } from "./text-input-executor-finalize.js";
import { executeTextInputAttempt } from "./text-input-executor-attempt.js";
import type { TextInputResultSeed } from "./text-input-input-gate.js";
import type { TextInputRuntimeDecisionState } from "./text-input-execution-support.js";

export async function executeTextInputPlan(input: {
  request: ParsedTextInputAbilityInput;
  context: TextInputRuntimeContext;
  seed: TextInputResultSeed;
  state: TextInputRuntimeDecisionState;
  actionExecutionRef: string;
}) {
  return finalizeTextInputExecutionResult({
    executionResult: await executeTextInputAttempt({
      request: input.request,
      context: input.context,
      seed: input.seed,
      state: input.state,
      actionExecutionRef: input.actionExecutionRef,
    }),
    seed: input.seed,
    context: input.context,
    state: input.state,
  });
}
