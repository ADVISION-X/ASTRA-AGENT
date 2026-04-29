import type { AiAbilityGroup } from "./contract.js";
import { createAiModelRosterPort } from "./model-roster.js";
import { createAiPromptRegistry } from "./runtime/ai-prompt-registry.js";
import { createLocalAiRuntimePort } from "./runtime-adapters/local-ai-runtime-adapter.js";
import { AiHealthReportSchema, AiResultSchema, parseAiInput } from "./schema.js";
import { createAiCapabilityRegistry, listAiChildren } from "./registry.js";
import { createSystemAiClock } from "./runtime/ai-clock.js";
import { dispatchAiFailure } from "./runtime/ai-dispatch-failure.js";
import { routeAiTaskToChild } from "./task-router.js";

type CreateAiAbilityGroupInput = Partial<{
  runtime: Parameters<typeof dispatchAiFailure>[0]["context"]["runtime"];
  clock: Parameters<typeof dispatchAiFailure>[0]["context"]["clock"];
  modelRoster: Parameters<typeof dispatchAiFailure>[0]["context"]["modelRoster"];
  promptRegistry: Parameters<typeof dispatchAiFailure>[0]["context"]["promptRegistry"];
}>;

export function createAiAbilityGroup(input: CreateAiAbilityGroupInput = {}): AiAbilityGroup {
  const context = {
    runtime: input.runtime ?? createLocalAiRuntimePort(),
    clock: input.clock ?? createSystemAiClock(),
    modelRoster: input.modelRoster ?? createAiModelRosterPort(),
    promptRegistry: input.promptRegistry ?? createAiPromptRegistry(),
  };
  const registry = createAiCapabilityRegistry();

  return {
    listChildCapabilityIds() {
      return listAiChildren();
    },
    async execute(inputValue) {
      const parsed = parseAiInput(inputValue);
      if (!parsed.success) {
        return dispatchAiFailure({
          rawInput: inputValue,
          context,
          childCapabilityId: null,
          taskType: null,
          providerKind: null,
          failureReason: "input_schema_invalid",
          statusMessage: "AI rejected invalid input schema.",
        });
      }

      const childCapabilityId = routeAiTaskToChild(parsed.data.taskType);
      const entry = registry.get(childCapabilityId);
      if (!entry) {
        return dispatchAiFailure({
          rawInput: parsed.data,
          context,
          childCapabilityId,
          taskType: parsed.data.taskType,
          providerKind: null,
          failureReason: "unknown_child_capability",
          statusMessage: `AI child capability is not registered for ${childCapabilityId}.`,
        });
      }

      if (!entry.implementation.execute) {
        return dispatchAiFailure({
          rawInput: parsed.data,
          context,
          childCapabilityId,
          taskType: parsed.data.taskType,
          providerKind: entry.contract.providerKind,
          failureReason: "child_not_executable",
          statusMessage: `AI child capability is not executable for ${childCapabilityId}.`,
        });
      }

      try {
        return AiResultSchema.parse(await entry.implementation.execute(parsed.data, context));
      } catch (error) {
        return dispatchAiFailure({
          rawInput: parsed.data,
          context,
          childCapabilityId,
          taskType: parsed.data.taskType,
          providerKind: entry.contract.providerKind,
          failureReason: "runtime_execution_failed",
          statusMessage: error instanceof Error ? error.message : "AI child execution failed.",
        });
      }
    },
    async getHealth() {
      const [runtimeHealth, childStatuses] = await Promise.all([
        context.runtime.getHealth(),
        Promise.all([...registry.values()].map((entry) => entry.implementation.checkReadiness(context))),
      ]);
      return AiHealthReportSchema.parse({
        ...runtimeHealth,
        childStatuses,
      });
    },
    async getRuntimeHealth() {
      return context.runtime.getRuntimeHealth();
    },
    getPromptContract(taskType) {
      return context.promptRegistry.resolvePromptContract(taskType);
    },
    async getModelRoster() {
      return context.modelRoster.load(context.clock);
    },
  };
}
