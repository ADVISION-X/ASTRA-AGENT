import type { ParsedTextInputAbilityInput } from "../contract.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";
import type { TextInputRuntimeDecisionState } from "./text-input-execution-support.js";
import { createTextInputActionExecutionRef } from "./text-input-execution-support.js";
import { executeTextInputPlan } from "./text-input-executor-plan.js";
import type { TextInputExecutionSeed } from "./text-input-input-gate.js";

export async function executeTextInputFlow(input: {
  request: ParsedTextInputAbilityInput;
  context: TextInputRuntimeContext;
  seed: TextInputExecutionSeed;
  state: TextInputRuntimeDecisionState;
}) {
  return executeTextInputPlan({
    request: input.request,
    context: input.context,
    seed: input.seed,
    state: input.state,
    actionExecutionRef: createTextInputActionExecutionRef(input.seed),
  });
}
