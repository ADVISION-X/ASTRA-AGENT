import type { AiRuntimeExecutionOutput, AiRuntimeHealth, ParsedAiAbilityInput } from "../contract.js";
import type { AiClockPort } from "../ports/ai-clock-port.js";
import type { AiRuntimePort } from "../ports/ai-runtime-port.js";
import { createSystemAiClock } from "../runtime/ai-clock.js";
import { AiRuntimeHealthSchema } from "../schema.js";
import { getAiExternalProviderPublicState } from "../runtime/provider-config-store.js";
import type { LocalAiRuntimePortOptions } from "./local-ai-runtime-debug-contract.js";
import { callExternalProvider } from "./external-provider-runtime-execution.js";

export type ExternalProviderRuntimeInput = {
  dataDir?: string | null;
  clock?: AiClockPort;
  emitDebugEvent?: LocalAiRuntimePortOptions["emitDebugEvent"];
};

type RuntimeState = {
  lastTaskType: ParsedAiAbilityInput["taskType"] | null;
  lastInvocationStatus: string | null;
  lastFailureReason: string | null;
};

function createRuntimeState(): RuntimeState {
  return {
    lastTaskType: null,
    lastInvocationStatus: null,
    lastFailureReason: null,
  };
}

function buildHealth(input: {
  implementationStatus: string;
  overallStatus: AiRuntimeHealth["overallStatus"];
  model: string | null;
  detail: string;
  state: RuntimeState;
  checkedAt: string;
}): AiRuntimeHealth {
  const model = input.model ?? "not-configured";
  return AiRuntimeHealthSchema.parse({
    overallStatus: input.overallStatus,
    implementationStatus: input.implementationStatus,
    dependencies: {
      gateway: input.detail,
      vision: "not_applicable",
      text: input.detail,
      ocr: "not_applicable",
    },
    configuredModels: {
      vision: "not_applicable",
      commentUnderstanding: model,
      ocr: "not_applicable",
      productSignal: model,
    },
    availableModels: input.model ? [input.model] : [],
    lastCheckedAt: input.checkedAt,
    failureReason: input.overallStatus === "ready" ? null : input.detail,
    lastTaskType: input.state.lastTaskType,
    lastFailureReason: input.state.lastFailureReason,
    lastInvocationStatus: input.state.lastInvocationStatus,
  });
}

async function loadExternalProviderHealth(input: ExternalProviderRuntimeInput, clock: AiClockPort, state: RuntimeState) {
  const checkedAt = clock.finishRun(clock.startRun()).endedAt;

  if (!input.dataDir) {
    const health = buildHealth({
      implementationStatus: "provider_not_configured",
      overallStatus: "degraded",
      model: null,
      detail: "external provider dataDir unavailable",
      state,
      checkedAt,
    });
    return { ok: true, detail: health.dependencies.gateway, health };
  }

  const providerState = await getAiExternalProviderPublicState(input.dataDir);
  const health = buildHealth({
    implementationStatus: providerState.configured ? "provider_ready" : "provider_not_configured",
    overallStatus: providerState.configured && providerState.enabled ? "ready" : "degraded",
    model: providerState.model,
    detail: providerState.configured
      ? `openai-compatible:${providerState.model}`
      : "openai-compatible:not-configured",
    state,
    checkedAt,
  });
  return { ok: true, detail: health.dependencies.gateway, health };
}

function updateRuntimeState(
  state: RuntimeState,
  request: ParsedAiAbilityInput,
  result: AiRuntimeExecutionOutput,
) {
  state.lastTaskType = request.taskType;
  state.lastInvocationStatus = result.createdAt === null ? "failed" : "success";
  state.lastFailureReason = result.createdAt === null ? result.implementationStatus : null;
}

export function createExternalProviderRuntimePort(input: ExternalProviderRuntimeInput = {}): AiRuntimePort {
  const state = createRuntimeState();
  const clock = input.clock ?? createSystemAiClock();

  return {
    async execute(request, options) {
      const result = await callExternalProvider({
        request,
        runtimeInput: input,
        clock,
        ...(options ? { options } : {}),
      });
      updateRuntimeState(state, request, result);
      return result;
    },

    async getHealth() {
      return loadExternalProviderHealth(input, clock, state);
    },

    async getRuntimeHealth() {
      return (await loadExternalProviderHealth(input, clock, state)).health;
    },
  };
}
