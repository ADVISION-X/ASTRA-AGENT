import { createHash } from "node:crypto";

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
import {
  buildExternalProviderFailureOutput,
  buildExternalProviderSuccessOutput,
  parseExternalProviderResponseText,
} from "./external-provider-runtime-response.js";

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

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function resolveDebugMode(): "summary" | "full" {
  return process.env.GRASSEYE_DEBUG_AI_IO === "full" ? "full" : "summary";
}

function previewText(value: string, maxLength = 500): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function buildPromptDebugRef(request: ParsedAiAbilityInput): string {
  return `debug://ai/${request.sessionId}/${request.capabilityCallId}/${request.promptContractId}`;
}

function buildRawResponseRef(request: ParsedAiAbilityInput): string {
  return `debug://ai/${request.sessionId}/${request.capabilityCallId}/raw-response`;
}

function buildRedactedProviderRequestBody(config: { model: string }, messages: { system: string; user: string }) {
  return {
    model: config.model,
    response_format: { type: "json_object" },
    headers: { authorization: "[redacted]" },
    messages: [
      { role: "system", content: messages.system },
      { role: "user", content: messages.user },
    ],
  };
}

async function emitExternalDebugEvent(
  emitDebugEvent: ExternalProviderRuntimeInput["emitDebugEvent"],
  input: Parameters<NonNullable<ExternalProviderRuntimeInput["emitDebugEvent"]>>[0],
) {
  await emitDebugEvent?.(input);
}

function buildExternalDebugBase(input: {
  request: ParsedAiAbilityInput;
  config: { providerId: string; model: string; configRef: string; secretRef: string };
  messages: { system: string; user: string };
  rawResponseText?: string | null;
  parsedJson?: unknown | null;
  parserErrors?: string[];
  durationMs?: number | null;
}) {
  const mode = resolveDebugMode();
  const requestHash = `sha256:${hashValue(input.request.input)}`;
  const promptDebugRef = buildPromptDebugRef(input.request);
  const rawResponseRef = buildRawResponseRef(input.request);
  return {
    sessionId: input.request.sessionId,
    missionId: input.request.missionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    traceId: input.request.missionId ?? input.request.sessionId,
    spanId: input.request.capabilityCallId,
    attemptId: `${input.request.capabilityCallId}:attempt:0`,
    taskType: input.request.taskType,
    refs: input.request.inputRefs.map((ref) => ref.id),
    provider: input.config.providerId,
    model: input.config.model,
    modelRole: "map-authoring",
    runtime: "openai-compatible",
    promptContractId: input.request.promptContractId,
    promptVersion: input.request.promptContractId,
    promptCatalogVersion: input.request.promptCatalogVersion,
    outputSchemaRef: input.request.expectedOutputSchema,
    providerConfigRef: input.config.configRef,
    secretRef: input.config.secretRef,
    promptDebugRef,
    systemPromptHash: `sha256:${hashValue(input.messages.system)}`,
    userPromptHash: `sha256:${hashValue(input.messages.user)}`,
    promptPreview: previewText(input.messages.user),
    promptFullText: mode === "full" ? `${input.messages.system}\n\n${input.messages.user}` : null,
    rawResponsePreview: input.rawResponseText ? previewText(input.rawResponseText) : null,
    rawResponseText: mode === "full" ? input.rawResponseText ?? null : null,
    rawResponseHash: input.rawResponseText ? `sha256:${hashValue(input.rawResponseText)}` : null,
    rawResponseRef,
    inputPackageId: input.request.taskType === "map_authoring" ? input.request.input.inputPackageId : null,
    inputPackageVersion: input.request.taskType === "map_authoring" ? input.request.input.inputPackageVersion : null,
    inputPackageHash: requestHash,
    capabilityCatalogVersion: input.request.taskType === "map_authoring" ? input.request.input.capabilityCatalog.version : null,
    outputSchemaCatalogVersion: input.request.taskType === "map_authoring" ? input.request.input.outputSchemaCatalog.version : null,
    mapPackageSchemaVersion: input.request.taskType === "map_authoring" ? input.request.input.mapPackageSchema.schemaVersion : null,
    promptDebugBundleRef: promptDebugRef,
    providerRequestBodyRedacted: mode === "full" ? buildRedactedProviderRequestBody(input.config, input.messages) : { model: input.config.model, headers: { authorization: "[redacted]" }, promptLength: input.messages.system.length + input.messages.user.length },
    providerRequestDebugRef: `${promptDebugRef}/provider-request`,
    parsedJson: input.parsedJson ?? null,
    parsedDecision: null,
    parserErrors: input.parserErrors ?? [],
    sourceScreenshotEvidenceId: null,
    aiInputArtifactRef: input.request.inputRefs[0]?.id ?? null,
    imageInputs: [],
    tokenEstimate: Math.ceil((input.messages.system.length + input.messages.user.length) / 4),
  };
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

async function callExternalProvider(
  request: ParsedAiAbilityInput,
  input: ExternalProviderRuntimeInput,
  clock: AiClockPort,
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

  await emitExternalDebugEvent(input.emitDebugEvent, {
    eventType: "AI_REQUEST_DEBUG",
    level: "DEBUG",
    status: "started",
    ...buildExternalDebugBase({ request, config, messages }),
    failureReason: null,
    errorKind: null,
    actionableMessage: null,
    ownerResponsible: "ai-capability",
    durationMs: null,
  });

  const started = clock.startRun();
  const payloadResult = await requestExternalPayload(config, messages, options);
  const ended = clock.finishRun(started);
  if (!payloadResult.ok) {
    await emitExternalDebugEvent(input.emitDebugEvent, {
      eventType: "AI_ERROR_DEBUG",
      level: "ERROR",
      status: "failed",
      ...buildExternalDebugBase({ request, config, messages, durationMs: ended.durationMs }),
      failureReason: payloadResult.output.implementationStatus,
      errorKind: payloadResult.output.implementationStatus,
      actionableMessage: "Check paid-analysis-ai provider config, secretRef, operator approval, external transmission policy, and upstream provider response.",
      ownerResponsible: "ai-capability",
      durationMs: ended.durationMs,
    });
    return payloadResult.output;
  }

  const parsedResponse = parseExternalProviderResponseText(payloadResult.payload);
  const parsedJson = parsedResponse.text ? parseExtractedJson(parsedResponse.text) : null;
  await emitExternalDebugEvent(input.emitDebugEvent, {
    eventType: "AI_RESPONSE_DEBUG",
    level: "DEBUG",
    status: "success",
    ...buildExternalDebugBase({
      request,
      config,
      messages,
      rawResponseText: parsedResponse.text,
      parsedJson: parsedJson?.ok ? parsedJson.value : null,
      parserErrors: parsedJson && !parsedJson.ok ? ["json_extraction_failed"] : [],
      durationMs: ended.durationMs,
    }),
    failureReason: null,
    errorKind: null,
    actionableMessage: null,
    ownerResponsible: "ai-capability",
    durationMs: ended.durationMs,
  });

  return buildExternalProviderOutput(request, config.model, payloadResult.payload, {
    createdAt: ended.endedAt,
    gatewayDurationMs: ended.durationMs,
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
