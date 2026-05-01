import type { ParsedTextInputAbilityInput } from "../contract.js";
import { buildTextInputExecutionSeed } from "./text-input-input-gate.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";
import {
  createInitialDecisionState,
} from "./text-input-execution-support.js";
import { runTextInputExecutionGates } from "./text-input-execution-gates.js";
import { executeTextInputFlow } from "./text-input-executor-flow.js";

export async function executeTextInput(input: {
  request: ParsedTextInputAbilityInput;
  context: TextInputRuntimeContext;
}) {
  const seed = buildTextInputExecutionSeed(input.request);
  const state = createInitialDecisionState(input.request);
  const gateResult = runTextInputExecutionGates({ request: input.request, context: input.context, seed, state });
  if (gateResult !== null) {
    return gateResult;
  }
  return executeTextInputFlow({
    request: input.request,
    context: input.context,
    seed,
    state,
  });
}
