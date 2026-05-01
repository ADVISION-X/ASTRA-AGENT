import type { ParsedTextInputAbilityInput, TextInputAbilityResult } from "../contract.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";
import { finalizeTextInputExecutionResult } from "./text-input-executor-finalize.js";
import { executeTextInputAttempt } from "./text-input-executor-attempt.js";
import type { TextInputExecutionSeed } from "./text-input-input-gate.js";
import type { TextInputRuntimeDecisionState } from "./text-input-execution-support.js";

export async function executeTextInputPlan(input: {
  request: ParsedTextInputAbilityInput;
  context: TextInputRuntimeContext;
  seed: TextInputExecutionSeed;
  state: TextInputRuntimeDecisionState;
  actionExecutionRef: string;
}): Promise<TextInputAbilityResult> {
  const executionResult = await executeTextInputAttempt({
      request: input.request,
      context: input.context,
      seed: input.seed,
      state: input.state,
      actionExecutionRef: input.actionExecutionRef,
    });

  if ("runtimeProof" in executionResult) {
    return executionResult;
  }

  return finalizeTextInputExecutionResult({
    executionResult,
    seed: input.seed,
    context: input.context,
    state: input.state,
  });
}
