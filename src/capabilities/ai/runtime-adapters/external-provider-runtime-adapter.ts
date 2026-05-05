import type { AiRuntimeExecutionOutput, AiRuntimeHealth, ParsedAiAbilityInput } from "../contract.js";
import type { AiClockPort } from "../ports/ai-clock-port.js";
import type { AiRuntimeExecuteOptions, AiRuntimePort } from "../ports/ai-runtime-port.js";
import { createSystemAiClock } from "../runtime/ai-clock.js";
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
import type { LocalAiRuntimePortOptions } from "./local-ai-runtime-debug-contract.js";
import { buildExternalDebugBase, emitExternalDebugEvent } from "./external-provider-runtime-debug.js";
import {
  buildExternalProviderFailureOutput,
  buildExternalProviderSuccessOutput,
  parseExternalProviderResponseText,
} from "./external-provider-runtime-response.js";
import { requestExternalPayload } from "./external-provider-runtime-request.js";

type ExternalProviderRuntimeInput = {
  dataDir?: string | null;
  clock?: AiClockPort;
  emitDebugEvent?: LocalAiRuntimePortOptions["emitDebugEvent"];
};

type RuntimeState = {
  lastTaskType: ParsedAiAbilityInput["taskType"] | null;
  lastInvocationStatus: string | null;
  lastFailureReason: string | null;
};

const isMapAuthoringProviderDryRun = () =>
  process.env.GRASSEYE_MAP_AUTHORING_PROMPT_SELF_CHECK === "1"
  && process.env.GRASSEYE_AI_PROVIDER_DRY_RUN === "1";

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

function buildProviderNotConfiguredOutput(): AiRuntimeExecutionOutput {
  return buildExternalProviderFailureOutput({
    implementationStatus: "provider_not_configured",
    modelName: "not-configured",
    failureReason: "provider_not_configured",
  });
}

function buildDryRunCapturedOutput(modelName: string): AiRuntimeExecutionOutput {
  return buildExternalProviderFailureOutput({
    implementationStatus: "DRY_RUN_CAPTURED",
    modelName,
    failureReason: "WOULD_SEND_TO_PROVIDER",
  });
}

function buildRuntimeInvalidResponse(modelName: string): AiRuntimeExecutionOutput {
  return buildExternalProviderFailureOutput({
    implementationStatus: "runtime_invalid_response",
    modelName,
    failureReason: "runtime_invalid_response",
  });
}

function buildExternalProviderOutput(
  request: ParsedAiAbilityInput,
  configModel: string,
  payload: unknown,
  timing: { createdAt: string; gatewayDurationMs: number },
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
    createdAt: timing.createdAt,
    gatewayDurationMs: timing.gatewayDurationMs,
  });
}

async function emitExternalRequestDebug(input: {
  runtimeInput: ExternalProviderRuntimeInput;
  request: ParsedAiAbilityInput;
  config: Exclude<Awaited<ReturnType<typeof resolveAiExternalProviderRuntimeConfig>>, null>;
  messages: { system: string; user: string };
}) {
  await emitExternalDebugEvent(input.runtimeInput.emitDebugEvent, {
    eventType: "AI_REQUEST_DEBUG",
    level: "DEBUG",
    status: "started",
    ...buildExternalDebugBase(input),
    failureReason: null,
    errorKind: null,
    actionableMessage: null,
    ownerResponsible: "ai-capability",
    durationMs: null,
  });
}

async function emitExternalErrorDebug(input: {
  runtimeInput: ExternalProviderRuntimeInput;
  request: ParsedAiAbilityInput;
  config: Exclude<Awaited<ReturnType<typeof resolveAiExternalProviderRuntimeConfig>>, null>;
  messages: { system: string; user: string };
  output: AiRuntimeExecutionOutput;
  durationMs: number;
}) {
  await emitExternalDebugEvent(input.runtimeInput.emitDebugEvent, {
    eventType: "AI_ERROR_DEBUG",
    level: "ERROR",
    status: "failed",
    ...buildExternalDebugBase(input),
    failureReason: input.output.implementationStatus,
    errorKind: input.output.implementationStatus,
    actionableMessage: "Check paid-analysis-ai provider config, secretRef, operator approval, external transmission policy, and upstream provider response.",
    ownerResponsible: "ai-capability",
    durationMs: input.durationMs,
  });
}

async function emitExternalResponseDebug(input: {
  runtimeInput: ExternalProviderRuntimeInput;
  request: ParsedAiAbilityInput;
  config: Exclude<Awaited<ReturnType<typeof resolveAiExternalProviderRuntimeConfig>>, null>;
  messages: { system: string; user: string };
  payload: unknown;
  durationMs: number;
}) {
  const parsedResponse = parseExternalProviderResponseText(input.payload);
  const parsedJson = parsedResponse.text ? parseExtractedJson(parsedResponse.text) : null;
  await emitExternalDebugEvent(input.runtimeInput.emitDebugEvent, {
    eventType: "AI_RESPONSE_DEBUG",
    level: "DEBUG",
    status: "success",
    ...buildExternalDebugBase({
      ...input,
      rawResponseText: parsedResponse.text,
      parsedJson: parsedJson?.ok ? parsedJson.value : null,
      parserErrors: parsedJson && !parsedJson.ok ? ["json_extraction_failed"] : [],
    }),
    failureReason: null,
    errorKind: null,
    actionableMessage: null,
    ownerResponsible: "ai-capability",
    durationMs: input.durationMs,
  });
}

async function callExternalProvider(
  request: ParsedAiAbilityInput,
  input: ExternalProviderRuntimeInput,
  clock: AiClockPort,
  options?: AiRuntimeExecuteOptions,
): Promise<AiRuntimeExecutionOutput> {
  if (isMapAuthoringProviderDryRun() && request.taskType === "map_authoring") {
    const config = {
      providerId: "openai-compatible",
      displayName: "Dry-run map authoring provider",
      providerKind: "openai-compatible",
      providerCompany: "openai",
      model: "dry-run-map-authoring-model",
      configRef: request.providerPolicy.providerConfigRef ?? "provider-config:map-authoring-self-check",
      secretRef: request.providerPolicy.secretRef ?? "provider-secret:map-authoring-self-check",
      baseUrl: "dry-run://blocked-before-external-provider-call",
      apiKey: "[REDACTED]",
      allowPaidProvider: true,
      providerAllowlist: ["paid-analysis-ai"] as ["paid-analysis-ai"],
      dataPolicy: { allowExternalTransmission: false },
      costPolicy: { maxEstimatedCost: 1 },
      operatorApprovalRef: request.providerPolicy.operatorApprovalRef,
      approvalReason: "dry-run map authoring self-check",
      enabled: true,
      updatedAt: new Date(0).toISOString(),
    } as const;
    const messages = buildExternalProviderMessages(request);
    if (messages === null) {
      return buildExternalProviderFailureOutput({
        implementationStatus: "task_type_mismatch",
        modelName: config.model,
        failureReason: "task_type_mismatch",
      });
    }
    await emitExternalRequestDebug({ runtimeInput: input, request, config, messages });
    return buildDryRunCapturedOutput(config.model);
  }

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

  await emitExternalRequestDebug({ runtimeInput: input, request, config, messages });

  const started = clock.startRun();
  const payloadResult = await requestExternalPayload(config, messages, options?.signal ?? null);
  const ended = clock.finishRun(started);
  if (!payloadResult.ok) {
    await emitExternalErrorDebug({ runtimeInput: input, request, config, messages, output: payloadResult.output, durationMs: ended.durationMs });
    return payloadResult.output;
  }

  await emitExternalResponseDebug({ runtimeInput: input, request, config, messages, payload: payloadResult.payload, durationMs: ended.durationMs });

  return buildExternalProviderOutput(request, config.model, payloadResult.payload, {
    createdAt: ended.endedAt,
    gatewayDurationMs: ended.durationMs,
  });
}

async function loadExternalProviderHealth(input: ExternalProviderRuntimeInput, clock: AiClockPort, state: RuntimeState) {
  const checkedAt = clock.finishRun(clock.startRun()).endedAt;

  if (isMapAuthoringProviderDryRun()) {
    const health = buildHealth({
      implementationStatus: "DRY_RUN_CAPTURED",
      overallStatus: "ready",
      model: "dry-run-map-authoring-model",
      detail: "openai-compatible:dry-run-block-before-external-provider-call",
      state,
      checkedAt,
    });
    return { ok: true, detail: health.dependencies.gateway, health };
  }

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
      const result = await callExternalProvider(request, input, clock, options);
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
