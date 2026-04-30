import type { AiAbilityResult, AiChildContract, AiExecutionContext, ParsedAiAbilityInput } from "../contract.js";
import {
  buildAiExecutionPlan,
  buildAiInputGateFailureResult,
  resolveAiPreRuntimeResult,
  runAiExecutorInputGate,
} from "./ai-pre-runtime.js";
import { runAiRuntimeCall } from "./ai-runtime-call-runner.js";
import { resolveAiRuntimeResult } from "./ai-runtime-result.js";

export async function executeAiChild(input: { request: ParsedAiAbilityInput; childContract: AiChildContract; context: AiExecutionContext }): Promise<AiAbilityResult> {
  const promptContract = input.context.promptRegistry.resolvePromptContract({
    promptContractId: input.request.promptContractId,
    taskType: input.request.taskType,
  });

  const inputGate = runAiExecutorInputGate(input.request, input.childContract.childCapabilityId);
  if (inputGate.ok === false) {
    return buildAiInputGateFailureResult({
      request: input.request,
      childContract: input.childContract,
      context: input.context,
      promptContract,
      reason: inputGate.reason,
    });
  }

  const plan = buildAiExecutionPlan({
    request: inputGate.request,
    childContract: input.childContract,
    context: input.context,
    promptContract,
  });
  const preRuntimeResult = await resolveAiPreRuntimeResult(plan);
  if (preRuntimeResult) {
    return preRuntimeResult;
  }
  const runtimeResult = await runAiRuntimeCall({
    request: inputGate.request,
    context: input.context,
  });
  return resolveAiRuntimeResult(plan, runtimeResult);
}
