import type { AiRuntimeExecutionOutput, AiRuntimeHealth, ParsedAiAbilityInput } from "../contract.js";
import type { AiRuntimeExecuteOptions, AiRuntimePort } from "../ports/ai-runtime-port.js";
import { AiRuntimeHealthSchema } from "../schema.js";
import { parseExtractedJson } from "../shared/ai-json-extract.js";
import {
  getAiExternalProviderPublicState,
  resolveAiExternalProviderRuntimeConfig,
} from "../runtime/provider-config-store.js";
import {
  buildExternalProviderMessages,
  normalizeExternalProviderOutput,
} from "./external-provider-runtime-messages.js";
import {
  buildExternalProviderFailureOutput,
  buildExternalProviderSuccessOutput,
  parseExternalProviderResponseText,
} from "./external-provider-runtime-response.js";

type ExternalProviderRuntimeInput = {
  dataDir?: string | null;
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
    lastCheckedAt: new Date().toISOString(),
    failureReason: input.overallStatus === "ready" ? null : input.detail,
    lastTaskType: input.state.lastTaskType,
    lastFailureReason: input.state.lastFailureReason,
    lastInvocationStatus: input.state.lastInvocationStatus,
  });
}

function buildProviderNotConfiguredOutput(): AiRuntimeExecutionOutput {
  return buildExternalProviderFailureOutput({
    implementationStatus: "provider_not_configured",
    modelName: "not-configured",
    failureReason: "provider_not_configured",
  });
}

function buildRuntimeInvalidResponse(modelName: string): AiRuntimeExecutionOutput {
  return buildExternalProviderFailureOutput({
    implementationStatus: "runtime_invalid_response",
    modelName,
    failureReason: "runtime_invalid_response",
  });
}

function buildRuntimeErrorOutput(modelName: string, error: unknown): AiRuntimeExecutionOutput {
  if (error instanceof Error && error.name === "AbortError") {
    return buildExternalProviderFailureOutput({
      implementationStatus: "runtime_timeout",
      modelName,
      failureReason: "runtime_timeout",
    });
  }

  return buildExternalProviderFailureOutput({
    implementationStatus: "runtime_threw",
    modelName,
    failureReason: error instanceof Error ? error.message : "runtime_threw",
  });
}

async function requestExternalPayload(
  config: Awaited<ReturnType<typeof resolveAiExternalProviderRuntimeConfig>> extends infer T ? Exclude<T, null> : never,
  messages: { system: string; user: string },
  options?: AiRuntimeExecuteOptions,
): Promise<{ ok: true; payload: unknown } | { ok: false; output: AiRuntimeExecutionOutput }> {
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: messages.system },
          { role: "user", content: messages.user },
        ],
      }),
      signal: options?.signal ?? null,
    });
    const payload = await response.json();
    if (response.ok) {
      return { ok: true, payload };
    }

    return {
      ok: false,
      output: buildExternalProviderFailureOutput({
        implementationStatus: "runtime_http_failed",
        modelName: config.model,
        failureReason: typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
          ? (payload as { error?: { message?: string } }).error?.message ?? "runtime_http_failed"
          : "runtime_http_failed",
      }),
    };
  } catch (error) {
    return { ok: false, output: buildRuntimeErrorOutput(config.model, error) };
  }
}

function buildExternalProviderOutput(
  request: ParsedAiAbilityInput,
  configModel: string,
  payload: unknown,
  startedAt: number,
): AiRuntimeExecutionOutput {
  const parsedResponse = parseExternalProviderResponseText(payload);
  if (!parsedResponse.text) {
    return buildRuntimeInvalidResponse(parsedResponse.model ?? configModel);
  }

  const extracted = parseExtractedJson(parsedResponse.text);
  if (!extracted.ok) {
    return buildRuntimeInvalidResponse(parsedResponse.model ?? configModel);
  }

  const normalizedOutput = normalizeExternalProviderOutput(request, extracted.value);
  if (!normalizedOutput.ok) {
    return buildRuntimeInvalidResponse(parsedResponse.model ?? configModel);
  }

  return buildExternalProviderSuccessOutput({
    taskType: request.taskType,
    rawText: parsedResponse.text,
    modelName: parsedResponse.model ?? configModel,
    responseId: parsedResponse.responseId,
    normalizedOutput: normalizedOutput.value,
    startedAt,
  });
}

async function callExternalProvider(
  request: ParsedAiAbilityInput,
  input: ExternalProviderRuntimeInput,
  options?: AiRuntimeExecuteOptions,
): Promise<AiRuntimeExecutionOutput> {
  if (!input.dataDir) {
    return buildProviderNotConfiguredOutput();
  }

  const config = await resolveAiExternalProviderRuntimeConfig(input.dataDir, {
    providerConfigRef: request.providerPolicy.providerConfigRef,
    secretRef: request.providerPolicy.secretRef,
  });
  if (config === null) {
    return buildProviderNotConfiguredOutput();
  }

  const messages = buildExternalProviderMessages(request);
  if (messages === null) {
    return buildExternalProviderFailureOutput({
      implementationStatus: "task_type_mismatch",
      modelName: config.model,
      failureReason: "task_type_mismatch",
    });
  }

  const startedAt = Date.now();
  const payloadResult = await requestExternalPayload(config, messages, options);
  return payloadResult.ok
    ? buildExternalProviderOutput(request, config.model, payloadResult.payload, startedAt)
    : payloadResult.output;
}

async function loadExternalProviderHealth(input: ExternalProviderRuntimeInput, state: RuntimeState) {
  if (!input.dataDir) {
    const health = buildHealth({
      implementationStatus: "provider_not_configured",
      overallStatus: "degraded",
      model: null,
      detail: "external provider dataDir unavailable",
      state,
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

  return {
    async execute(request, options) {
      const result = await callExternalProvider(request, input, options);
      updateRuntimeState(state, request, result);
      return result;
    },

    async getHealth() {
      return loadExternalProviderHealth(input, state);
    },

    async getRuntimeHealth() {
      return (await loadExternalProviderHealth(input, state)).health;
    },
  };
}