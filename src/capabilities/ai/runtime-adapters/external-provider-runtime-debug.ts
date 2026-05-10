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
  createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(canonicalize(value))).digest("hex");

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
};

const previewText = (value: string, maxLength = 500): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;

const buildPromptDebugRef = (request: ParsedAiAbilityInput): string =>
  `debug://ai/${request.sessionId}/${request.capabilityCallId}/${request.promptContractId}`;

export const buildExternalRawResponseRef = (request: ParsedAiAbilityInput): string =>
  `debug://ai/${request.sessionId}/${request.capabilityCallId}/raw-response`;

const buildRedactedProviderRequestBody = (config: ExternalDebugConfig, messages: ExternalDebugMessages) => ({
  model: config.model,
  response_format: { type: "json_object" },
  headers: { authorization: "[REDACTED]" },
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
  return {
    promptDebugRef: input.promptDebugRef,
    systemPromptHash: `sha256:${hashExternalDebugValue(input.messages.system)}`,
    userPromptHash: `sha256:${hashExternalDebugValue(input.messages.user)}`,
    promptPreview: previewText(input.messages.user),
    promptFullText: `${input.messages.system}\n\n${input.messages.user}`,
    promptDebugBundleRef: input.promptDebugRef,
    tokenEstimate: Math.ceil((input.messages.system.length + input.messages.user.length) / 4),
  };
};

const buildProviderRequestFields = (input: {
  config: ExternalDebugConfig;
  messages: ExternalDebugMessages;
  promptDebugRef: string;
}) => {
  const fullProviderRequestBody = buildRedactedProviderRequestBody(input.config, input.messages);
  return {
    providerRequestBodyRedacted: fullProviderRequestBody,
    providerRequestBodyHash: `sha256:${hashExternalDebugValue(fullProviderRequestBody)}`,
    providerRequestDebugRef: `${input.promptDebugRef}/provider-request`,
  };
};

const EMPTY_EXTERNAL_CATALOG_REFS = {
  inputPackageId: null,
  inputPackageVersion: null,
  inputPackageHash: null,
  capabilityCatalogVersion: null,
  outputSchemaCatalogVersion: null,
};

const buildResponseFields = (input: {
  request: ParsedAiAbilityInput;
  rawResponseText?: string | null;
  parsedJson?: unknown | null;
  parserErrors?: string[];
}) => ({
  rawResponsePreview: input.rawResponseText ? previewText(input.rawResponseText) : null,
  rawResponseText: input.rawResponseText ?? null,
  rawResponseHash: input.rawResponseText ? `sha256:${hashExternalDebugValue(input.rawResponseText)}` : null,
  rawResponseRef: buildExternalRawResponseRef(input.request),
  parsedJson: input.parsedJson ?? null,
  parsedDecision: null,
  parserErrors: input.parserErrors ?? [],
});

const buildExternalRuntimeDiagnosticFields = (input: {
  request: ParsedAiAbilityInput;
  parserErrors?: string[];
}) => ({
  implementationStatus: null,
  runtimeCallId: input.request.capabilityCallId,
  diagnosticPayloadRef: buildExternalRawResponseRef(input.request),
  schemaIssueCount: input.parserErrors?.length ?? null,
});

const buildExternalTraceFields = (request: ParsedAiAbilityInput) => ({
  sessionId: request.sessionId,
  missionId: request.missionId,
  roundId: request.roundId,
  videoVisitId: request.videoVisitId,
  traceId: request.missionId ?? request.sessionId,
  spanId: request.capabilityCallId,
  attemptId: `${request.capabilityCallId}:attempt:0`,
  owner: "ai-capability",
  ownerResponsible: "ai-capability",
  abilityGroupId: request.abilityGroupId,
  taskType: request.taskType,
  requestedBy: request.requestedBy,
  transportedBy: request.transportedBy,
  refs: request.inputRefs.map((ref) => ref.id),
});

const buildExternalModelFields = (config: ExternalDebugConfig) => ({
  provider: config.providerId,
  model: config.model,
  modelRole: "future",
  runtime: "openai-compatible",
});

const buildExternalContractFields = (request: ParsedAiAbilityInput) => ({
  promptContractId: request.promptContractId,
  promptVersion: null,
  promptCatalogVersion: request.promptCatalogVersion,
  promptContractHash: null,
  systemPromptTemplateHash: null,
  userPromptTemplateHash: null,
  outputSchemaRef: request.expectedOutputSchema,
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
    ...buildExternalTraceFields(input.request),
    ...buildExternalModelFields(input.config),
    ...buildExternalRuntimeDiagnosticFields(input),
    ...buildExternalContractFields(input.request),
    providerConfigRef: input.config.configRef,
    secretRef: input.config.secretRef,
    ...buildPromptFields({ request: input.request, messages: input.messages, promptDebugRef }),
    ...buildResponseFields(input),
    ...EMPTY_EXTERNAL_CATALOG_REFS,
    ...buildProviderRequestFields({ config: input.config, messages: input.messages, promptDebugRef }),
    sourceScreenshotEvidenceId: null,
    aiInputArtifactRef: input.request.inputRefs[0]?.id ?? null,
    imageInputs: [],
    timeoutMs: null,
  };
};

export const emitExternalDebugEvent = async (
  emitDebugEvent: LocalAiRuntimePortOptions["emitDebugEvent"],
  input: Parameters<NonNullable<LocalAiRuntimePortOptions["emitDebugEvent"]>>[0],
) => {
  await emitDebugEvent?.(input);
};
