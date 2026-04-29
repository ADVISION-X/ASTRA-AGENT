import type { AiAbilityGroup, AiExecutionOptions, AiRuntimeBridge } from "./contract.js";
import { createAiCapabilityRegistry } from "./registry.js";
import { buildAiDispatchFailureResult } from "./runtime/ai-runtime-failure-result.js";
import { createDefaultAiRuntimeBridge } from "./runtime-adapters/local-ai-runtime-adapter.js";
import { validateAiAbilityInput } from "./schema-validation.js";
import { routeAiTaskToChild } from "./task-router.js";

type CreateAiAbilityGroupInput = {
  runtime?: AiRuntimeBridge;
};

export function createAiAbilityGroup(input: CreateAiAbilityGroupInput = {}): AiAbilityGroup {
  const runtime = input.runtime ?? createDefaultAiRuntimeBridge();
  const registry = createAiCapabilityRegistry();
  const context = { runtime };

  const executeByChild = async (options: {
    childCapabilityId: ReturnType<typeof routeAiTaskToChild>;
    input: Parameters<AiAbilityGroup["execute"]>[0];
    executionOptions?: AiExecutionOptions;
  }) => {
    const startedAt = new Date().toISOString();
    const promptContract = runtime.resolvePromptContract(options.input.taskType);
    const capability = registry.get(options.childCapabilityId);
    if (!capability) {
      return buildAiDispatchFailureResult({
        request: options.input,
        promptContract,
        childCapabilityId: options.childCapabilityId,
        startedAt,
        failureReason: `AI child capability is not registered for ${options.childCapabilityId}.`,
        implementationStatus: "child_not_registered",
      });
    }

    try {
      return await capability.execute(options.input, context, options.executionOptions);
    } catch (error) {
      return buildAiDispatchFailureResult({
        request: options.input,
        promptContract,
        childCapabilityId: options.childCapabilityId,
        startedAt,
        failureReason: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },
    routeTask(taskType) {
      return routeAiTaskToChild(taskType);
    },
    async execute(inputValue, options) {
      const request = validateAiAbilityInput(inputValue);
      return executeByChild({
        childCapabilityId: routeAiTaskToChild(request.taskType),
        input: request,
        ...(options ? { executionOptions: options } : {}),
      });
    },
    async getHealth() {
      const baseHealth = await runtime.getHealth();
      const childStatuses = await Promise.all([...registry.values()].map((capability) => capability.checkReadiness(context)));
      return {
        ...baseHealth,
        childStatuses,
      };
    },
    getRuntimeHealth() {
      return runtime.getRuntimeHealth();
    },
    getPromptContract(taskType) {
      return runtime.resolvePromptContract(taskType);
    },
    getModelRoster() {
      return runtime.getModelRoster();
    },
  };
}