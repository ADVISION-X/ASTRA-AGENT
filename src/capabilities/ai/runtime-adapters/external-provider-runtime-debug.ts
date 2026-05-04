import { createHash } from "node:crypto";

import type { ParsedAiAbilityInput } from "../contract.js";
import type { LocalAiRuntimePortOptions } from "./local-ai-runtime-debug-contract.js";

type ExternalDebugConfig = {
  providerId: string;
  model: string;
  configRef: string;
  secretRef: string;
};

type ExternalDebugMessages = {
  system: string;
  user: string;
};

export const hashExternalDebugValue = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const resolveDebugMode = (): "summary" | "full" =>
  process.env.GRASSEYE_DEBUG_AI_IO === "full" ? "full" : "summary";

const previewText = (value: string, maxLength = 500): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;

const buildPromptDebugRef = (request: ParsedAiAbilityInput): string =>
  `debug://ai/${request.sessionId}/${request.capabilityCallId}/${request.promptContractId}`;

export const buildExternalRawResponseRef = (request: ParsedAiAbilityInput): string =>
  `debug://ai/${request.sessionId}/${request.capabilityCallId}/raw-response`;

const buildRedactedProviderRequestBody = (config: ExternalDebugConfig, messages: ExternalDebugMessages) => ({
  model: config.model,
  response_format: { type: "json_object" },
  headers: { authorization: "[redacted]" },
  messages: [
    { role: "system", content: messages.system },
    { role: "user", content: messages.user },
  ],
});

const buildPromptFields = (input: {
  request: ParsedAiAbilityInput;
  messages: ExternalDebugMessages;
  promptDebugRef: string;
}) => {
  const mode = resolveDebugMode();
  return {
    promptDebugRef: input.promptDebugRef,
    systemPromptHash: `sha256:${hashExternalDebugValue(input.messages.system)}`,
    userPromptHash: `sha256:${hashExternalDebugValue(input.messages.user)}`,
    promptPreview: previewText(input.messages.user),
    promptFullText: mode === "full" ? `${input.messages.system}\n\n${input.messages.user}` : null,
    promptDebugBundleRef: input.promptDebugRef,
    tokenEstimate: Math.ceil((input.messages.system.length + input.messages.user.length) / 4),
  };
};

const buildProviderRequestFields = (input: {
  config: ExternalDebugConfig;
  messages: ExternalDebugMessages;
  promptDebugRef: string;
}) => {
  const mode = resolveDebugMode();
  return {
    providerRequestBodyRedacted: mode === "full"
      ? buildRedactedProviderRequestBody(input.config, input.messages)
      : {
          model: input.config.model,
          headers: { authorization: "[redacted]" },
          promptLength: input.messages.system.length + input.messages.user.length,
        },
    providerRequestDebugRef: `${input.promptDebugRef}/provider-request`,
  };
};

const buildMapAuthoringRefs = (request: ParsedAiAbilityInput) => ({
  inputPackageId: request.taskType === "map_authoring" ? request.input.inputPackageId : null,
  inputPackageVersion: request.taskType === "map_authoring" ? request.input.inputPackageVersion : null,
  inputPackageHash: request.taskType === "map_authoring" ? `sha256:${hashExternalDebugValue(request.input)}` : null,
  capabilityCatalogVersion: request.taskType === "map_authoring" ? request.input.capabilityCatalog.version : null,
  outputSchemaCatalogVersion: request.taskType === "map_authoring" ? request.input.outputSchemaCatalog.version : null,
  mapPackageSchemaVersion: request.taskType === "map_authoring" ? request.input.mapPackageSchema.schemaVersion : null,
});

const buildResponseFields = (input: {
  request: ParsedAiAbilityInput;
  rawResponseText?: string | null;
  parsedJson?: unknown | null;
  parserErrors?: string[];
}) => ({
  rawResponsePreview: input.rawResponseText ? previewText(input.rawResponseText) : null,
  rawResponseText: resolveDebugMode() === "full" ? input.rawResponseText ?? null : null,
  rawResponseHash: input.rawResponseText ? `sha256:${hashExternalDebugValue(input.rawResponseText)}` : null,
  rawResponseRef: buildExternalRawResponseRef(input.request),
  parsedJson: input.parsedJson ?? null,
  parsedDecision: null,
  parserErrors: input.parserErrors ?? [],
});

export const buildExternalDebugBase = (input: {
  request: ParsedAiAbilityInput;
  config: ExternalDebugConfig;
  messages: ExternalDebugMessages;
  rawResponseText?: string | null;
  parsedJson?: unknown | null;
  parserErrors?: string[];
}) => {
  const promptDebugRef = buildPromptDebugRef(input.request);
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
    ...buildPromptFields({ request: input.request, messages: input.messages, promptDebugRef }),
    ...buildResponseFields(input),
    ...buildMapAuthoringRefs(input.request),
    ...buildProviderRequestFields({ config: input.config, messages: input.messages, promptDebugRef }),
    sourceScreenshotEvidenceId: null,
    aiInputArtifactRef: input.request.inputRefs[0]?.id ?? null,
    imageInputs: [],
  };
};

export const emitExternalDebugEvent = async (
  emitDebugEvent: LocalAiRuntimePortOptions["emitDebugEvent"],
  input: Parameters<NonNullable<LocalAiRuntimePortOptions["emitDebugEvent"]>>[0],
) => {
  await emitDebugEvent?.(input);
};
