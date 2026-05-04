import type { AiRuntimePort } from "../ports/ai-runtime-port.js";
import { createLocalAiRuntimePort, type LocalAiRuntimePortOptions } from "./local-ai-runtime-adapter.js";
import { createExternalProviderRuntimePort } from "./external-provider-runtime-adapter.js";
import { routeAiTaskToChild } from "../task-router.js";

function mergeRuntimeHealth(primary: Awaited<ReturnType<AiRuntimePort["getRuntimeHealth"]>>, secondary: Awaited<ReturnType<AiRuntimePort["getRuntimeHealth"]>>) {
  return {
    ...primary,
    availableModels: [...new Set([...primary.availableModels, ...secondary.availableModels])],
    lastTaskType: secondary.lastTaskType ?? primary.lastTaskType,
    lastFailureReason: secondary.lastFailureReason ?? primary.lastFailureReason,
    lastInvocationStatus: secondary.lastInvocationStatus ?? primary.lastInvocationStatus,
  };
}

export type ProviderAwareAiRuntimeInput = {
  emitDebugEvent?: LocalAiRuntimePortOptions["emitDebugEvent"];
  dataDir?: string | null;
};

export function createProviderAwareAiRuntimePort(input: ProviderAwareAiRuntimeInput = {}): AiRuntimePort {
  const localRuntime = input.emitDebugEvent
    ? createLocalAiRuntimePort({ emitDebugEvent: input.emitDebugEvent })
    : createLocalAiRuntimePort();
  const externalRuntime = createExternalProviderRuntimePort({
    dataDir: input.dataDir ?? null,
    emitDebugEvent: input.emitDebugEvent,
  });

  return {
    async execute(request, options) {
      return routeAiTaskToChild(request.taskType) === "paid-analysis-ai"
        ? externalRuntime.execute(request, options)
        : localRuntime.execute(request, options);
    },

    async getHealth() {
      const [localHealth, externalHealth] = await Promise.all([
        localRuntime.getHealth(),
        externalRuntime.getHealth(),
      ]);
      return {
        ok: localHealth.ok,
        detail: `${localHealth.detail}; external=${externalHealth.detail}`,
        health: mergeRuntimeHealth(localHealth.health, externalHealth.health),
      };
    },

    async getRuntimeHealth() {
      const [localHealth, externalHealth] = await Promise.all([
        localRuntime.getRuntimeHealth(),
        externalRuntime.getRuntimeHealth(),
      ]);
      return mergeRuntimeHealth(localHealth, externalHealth);
    },
  };
}
