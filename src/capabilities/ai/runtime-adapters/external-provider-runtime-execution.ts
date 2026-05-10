import type { AiRuntimeExecutionOutput, ParsedAiAbilityInput } from "../contract.js";
import type { AiClockPort } from "../ports/ai-clock-port.js";
import type { AiRuntimeExecuteOptions } from "../ports/ai-runtime-port.js";
import { resolveAiExternalProviderRuntimeConfig } from "../runtime/provider-config-store.js";
import { parseExtractedJson } from "../shared/ai-json-extract.js";
import {
  buildExternalProviderMessages,
  normalizeExternalProviderOutput,
} from "./external-provider-runtime-messages.js";
import { buildExternalDebugBase, emitExternalDebugEvent } from "./external-provider-runtime-debug.js";
import {
  buildExternalProviderFailureOutput,
  buildExternalProviderSuccessOutput,
  parseExternalProviderResponseText,
} from "./external-provider-runtime-response.js";
import { requestExternalPayload } from "./external-provider-runtime-request.js";
import type { ExternalProviderRuntimeInput } from "./external-provider-runtime-adapter.js";

type ProviderConfig = Exclude<Awaited<ReturnType<typeof resolveAiExternalProviderRuntimeConfig>>, null>;
type ProviderMessages = { system: string; user: string };

const buildProviderNotConfiguredOutput = (): AiRuntimeExecutionOutput =>
  buildExternalProviderFailureOutput({
    implementationStatus: "provider_not_configured",
    modelName: "not-configured",
    failureReason: "provider_not_configured",
  });

const buildDryRunCapturedOutput = (modelName: string): AiRuntimeExecutionOutput =>
  buildExternalProviderFailureOutput({
    implementationStatus: "DRY_RUN_CAPTURED",
    modelName,
    failureReason: "WOULD_SEND_TO_PROVIDER",
  });

const buildRuntimeInvalidResponse = (modelName: string): AiRuntimeExecutionOutput =>
  buildExternalProviderFailureOutput({
    implementationStatus: "runtime_invalid_response",
    modelName,
    failureReason: "runtime_invalid_response",
  });

const buildTaskTypeMismatchOutput = (modelName: string): AiRuntimeExecutionOutput =>
  buildExternalProviderFailureOutput({
    implementationStatus: "task_type_mismatch",
    modelName,
    failureReason: "task_type_mismatch",
  });

const buildExternalProviderOutput = (
  request: ParsedAiAbilityInput,
  configModel: string,
  payload: unknown,
  timing: { createdAt: string; gatewayDurationMs: number },
): AiRuntimeExecutionOutput => {
  const parsedResponse = parseExternalProviderResponseText(payload);
  if (!parsedResponse.text) return buildRuntimeInvalidResponse(parsedResponse.model ?? configModel);
  const extracted = parseExtractedJson(parsedResponse.text);
  if (!extracted.ok) return buildRuntimeInvalidResponse(parsedResponse.model ?? configModel);
  const normalizedOutput = normalizeExternalProviderOutput(request, extracted.value);
  if (!normalizedOutput.ok) return buildRuntimeInvalidResponse(parsedResponse.model ?? configModel);
  return buildExternalProviderSuccessOutput({
    taskType: request.taskType,
    rawText: parsedResponse.text,
    modelName: parsedResponse.model ?? configModel,
    responseId: parsedResponse.responseId,
    normalizedOutput: normalizedOutput.value,
    createdAt: timing.createdAt,
    gatewayDurationMs: timing.gatewayDurationMs,
  });
};

async function emitExternalRequestDebug(input: {
  runtimeInput: ExternalProviderRuntimeInput;
  request: ParsedAiAbilityInput;
  config: ProviderConfig;
  messages: ProviderMessages;
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
  config: ProviderConfig;
  messages: ProviderMessages;
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
  config: ProviderConfig;
  messages: ProviderMessages;
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

const executeConfiguredProvider = async (input: {
  request: ParsedAiAbilityInput;
  runtimeInput: ExternalProviderRuntimeInput;
  clock: AiClockPort;
  options?: AiRuntimeExecuteOptions;
  config: ProviderConfig;
  messages: ProviderMessages;
}): Promise<AiRuntimeExecutionOutput> => {
  await emitExternalRequestDebug(input);
  const started = input.clock.startRun();
  const payloadResult = await requestExternalPayload(input.config, input.messages, input.options?.signal ?? null);
  const ended = input.clock.finishRun(started);
  if (!payloadResult.ok) {
    await emitExternalErrorDebug({ ...input, output: payloadResult.output, durationMs: ended.durationMs });
    return payloadResult.output;
  }
  await emitExternalResponseDebug({ ...input, payload: payloadResult.payload, durationMs: ended.durationMs });
  return buildExternalProviderOutput(input.request, input.config.model, payloadResult.payload, {
    createdAt: ended.endedAt,
    gatewayDurationMs: ended.durationMs,
  });
};

export async function callExternalProvider(input: {
  request: ParsedAiAbilityInput;
  runtimeInput: ExternalProviderRuntimeInput;
  clock: AiClockPort;
  options?: AiRuntimeExecuteOptions;
}): Promise<AiRuntimeExecutionOutput> {
  if (!input.runtimeInput.dataDir) return buildProviderNotConfiguredOutput();
  const config = await resolveAiExternalProviderRuntimeConfig(input.runtimeInput.dataDir, {
    providerConfigRef: input.request.providerPolicy.providerConfigRef,
    secretRef: input.request.providerPolicy.secretRef,
  });
  if (config === null) return buildProviderNotConfiguredOutput();
  const messages = buildExternalProviderMessages(input.request);
  if (messages === null) return buildTaskTypeMismatchOutput(config.model);
  return executeConfiguredProvider({ ...input, config, messages });
}
