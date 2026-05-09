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

type ExecuteAiChildInput = {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  context: AiExecutionContext;
};

const resolveInputGate = async (input: ExecuteAiChildInput) => {
  const inputGate = runAiExecutorInputGate(input.request, input.childContract.childCapabilityId);
  if (inputGate.ok === false) {
    await input.context.emitDebugEvent?.(buildRejectedInputDebug(input.request, inputGate.reason));
    return {
      ok: false as const,
      result: buildAiInputGateFailureResult({
        request: input.request,
        childContract: input.childContract,
        context: input.context,
        reason: inputGate.reason,
      }),
    };
  }

  return { ok: true as const, request: inputGate.request };
};

const resolvePromptContract = (input: ExecuteAiChildInput) => {
  const promptResolution = input.context.promptRegistry.resolvePromptContract({
    promptContractId: input.request.promptContractId,
    taskType: input.request.taskType,
  });
  return promptResolution.ok === false
    ? {
      ok: false as const,
      result: buildAiPromptGateFailureResult({
        request: input.request,
        childContract: input.childContract,
        context: input.context,
        failureReason: promptResolution.failureReason,
        statusMessage: promptResolution.message,
      }),
    }
    : { ok: true as const, contract: promptResolution.contract };
};

const prepareExecutionPlan = async (input: ExecuteAiChildInput, request: ReturnType<typeof runAiExecutorInputGate> extends { ok: true; request: infer T } ? T : never, promptContract: ReturnType<AiExecutionContext["promptRegistry"]["resolvePromptContract"]> extends { ok: true; contract: infer T } ? T : never) => {
  const plan = buildAiExecutionPlan({
    request,
    childContract: input.childContract,
    context: input.context,
    promptContract,
  });
  await emitAiExecutionRequestDebug({
    request,
    childContract: input.childContract,
    context: input.context,
    promptContract,
  });
  return plan;
};

export async function executeAiChild(input: ExecuteAiChildInput): Promise<AiAbilityResult> {
  const inputGate = await resolveInputGate(input);
  if (inputGate.ok === false) {
    return inputGate.result;
  }

  const promptResolution = resolvePromptContract(input);
  if (promptResolution.ok === false) {
    return promptResolution.result;
  }

  const plan = await prepareExecutionPlan(input, inputGate.request, promptResolution.contract);
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
