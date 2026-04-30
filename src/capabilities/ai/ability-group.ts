import type { AiAbilityGroup } from "./contract.js";
import type { AiExecutionContext } from "./contract.js";
import { AiHealthReportSchema, AiResultSchema, parseAiInput } from "./schema.js";
import { createAiCapabilityRegistry, listAiChildren } from "./registry.js";
import { dispatchAiFailure } from "./runtime/ai-dispatch-failure.js";
import { createAiExecutionContext } from "./runtime/ai-execution-context.js";
import { routeAiTaskToChild } from "./task-router.js";

export function createAiAbilityGroup(context: AiExecutionContext = createAiExecutionContext()): AiAbilityGroup {
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
      if (childCapabilityId === null) {
        return dispatchAiFailure({
          rawInput: parsed.data,
          context,
          childCapabilityId: null,
          taskType: parsed.data.taskType,
          providerKind: null,
          failureReason: "task_route_unavailable",
          statusMessage: `AI task route is unavailable for ${parsed.data.taskType}.`,
        });
      }

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

      if (!entry.executable || !entry.implementation.execute) {
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
  };
}
