import type { AiAbilityResult, AiChildContract, AiExecutionContext, ParsedAiAbilityInput } from "../contract.js";
import {
  buildAiExecutionPlan,
  resolveAiPreRuntimeResult,
  runAiExecutorInputGate,
} from "./ai-pre-runtime.js";
import { emitAiExecutionRequestDebug } from "./ai-execution-request-debug.js";
import { buildRejectedInputDebug } from "./ai-execution-input-debug-rejected.js";
import { buildAiInputGateFailureResult, buildAiPromptGateFailureResult } from "./ai-pre-runtime-terminal-results.js";
import { runAiRuntimeCall } from "./ai-runtime-call-runner.js";
import { resolveAiRuntimeResult } from "./ai-runtime-result.js";

export async function executeAiChild(input: { request: ParsedAiAbilityInput; childContract: AiChildContract; context: AiExecutionContext }): Promise<AiAbilityResult> {
  const inputGate = runAiExecutorInputGate(input.request, input.childContract.childCapabilityId);
  if (inputGate.ok === false) {
    await input.context.emitDebugEvent?.(buildRejectedInputDebug(input.request, inputGate.reason));
    return buildAiInputGateFailureResult({
      request: input.request,
      childContract: input.childContract,
      context: input.context,
      reason: inputGate.reason,
    });
  }

  const promptResolution = input.context.promptRegistry.resolvePromptContract({
    promptContractId: input.request.promptContractId,
    taskType: input.request.taskType,
  });
  if (promptResolution.ok === false) {
    return buildAiPromptGateFailureResult({
      request: input.request,
      childContract: input.childContract,
      context: input.context,
      failureReason: promptResolution.failureReason,
      statusMessage: promptResolution.message,
    });
  }

  const plan = buildAiExecutionPlan({
    request: inputGate.request,
    childContract: input.childContract,
    context: input.context,
    promptContract: promptResolution.contract,
  });
  await emitAiExecutionRequestDebug({
    request: inputGate.request,
    childContract: input.childContract,
    context: input.context,
    promptContract: promptResolution.contract,
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
