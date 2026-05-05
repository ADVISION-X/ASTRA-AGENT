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
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
};

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
  const fullProviderRequestBody = buildRedactedProviderRequestBody(input.config, input.messages);
  return {
    providerRequestBodyRedacted: mode === "full"
      ? fullProviderRequestBody
      : {
          model: input.config.model,
          headers: { authorization: "[REDACTED]" },
          promptLength: input.messages.system.length + input.messages.user.length,
        },
    providerRequestBodyHash: `sha256:${hashExternalDebugValue(fullProviderRequestBody)}`,
    providerRequestDebugRef: `${input.promptDebugRef}/provider-request`,
  };
};

const findMapAuthoringPromptContract = (request: ParsedAiAbilityInput) =>
  request.taskType === "map_authoring"
    ? request.input.promptContractCatalog.entries.find((entry) => entry.promptContractId === request.promptContractId) ?? null
    : null;

const buildMapAuthoringRefs = (request: ParsedAiAbilityInput) => ({
  inputPackageId: request.taskType === "map_authoring" ? request.input.inputPackageId : null,
  inputPackageVersion: request.taskType === "map_authoring" ? request.input.inputPackageVersion : null,
  inputPackageHash: request.taskType === "map_authoring" ? `sha256:${hashExternalDebugValue(request.input)}` : null,
  userRequirementRef: request.taskType === "map_authoring" ? request.input.userRequirementRef : null,
  sourceRequirementHash: request.taskType === "map_authoring" ? request.input.sourceRequirementHash : null,
  capabilityCatalogVersion: request.taskType === "map_authoring" ? request.input.capabilityCatalog.version : null,
  promptContractCatalogVersion: request.taskType === "map_authoring" ? request.input.promptContractCatalog.version : null,
  outputSchemaCatalogVersion: request.taskType === "map_authoring" ? request.input.outputSchemaCatalog.version : null,
  mapPackageSchemaVersion: request.taskType === "map_authoring" ? request.input.mapPackageSchema.schemaVersion : null,
  mapAuthoringOutputSchemaVersion: request.taskType === "map_authoring" ? request.input.mapAuthoringOutputSchema.schemaVersion : null,
  safetyPolicyRef: request.taskType === "map_authoring" ? request.input.safetyPolicy.policyRef : null,
  humanApprovalPolicyRef: request.taskType === "map_authoring" ? request.input.humanApprovalPolicy.policyRef : null,
  evidencePolicyRef: request.taskType === "map_authoring" ? request.input.evidencePolicy.policyRef : null,
  pavPolicyRef: request.taskType === "map_authoring" ? request.input.pavPolicy.policyRef : null,
  forensicsPolicyRef: request.taskType === "map_authoring" ? request.input.forensicsPolicy.policyRef : null,
  privacyPolicyRef: request.taskType === "map_authoring" ? request.input.privacyPolicy.policyRef : null,
  secretPolicyRef: request.taskType === "map_authoring" ? request.input.secretPolicy.policyRef : null,
  rateLimitPolicyRef: request.taskType === "map_authoring" ? request.input.rateLimitPolicy.policyRef : null,
  platformProfileRef: request.taskType === "map_authoring" ? request.input.targetPlatformProfileRef : null,
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
  const promptContract = findMapAuthoringPromptContract(input.request);
  return {
    sessionId: input.request.sessionId,
    missionId: input.request.missionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    traceId: input.request.missionId ?? input.request.sessionId,
    spanId: input.request.capabilityCallId,
    attemptId: `${input.request.capabilityCallId}:attempt:0`,
    owner: "ai-capability",
    ownerResponsible: "ai-capability",
    abilityGroupId: input.request.abilityGroupId,
    taskType: input.request.taskType,
    requestedBy: input.request.requestedBy,
    transportedBy: input.request.transportedBy,
    refs: input.request.inputRefs.map((ref) => ref.id),
    provider: input.config.providerId,
    model: input.config.model,
    modelRole: "map-authoring",
    runtime: "openai-compatible",
    promptContractId: input.request.promptContractId,
    promptContractVersion: promptContract?.promptContractVersion ?? input.request.promptContractId,
    promptVersion: promptContract?.promptContractVersion ?? input.request.promptContractId,
    promptCatalogVersion: input.request.promptCatalogVersion,
    promptContractHash: promptContract?.promptContractHash ?? promptContract?.promptHash ?? null,
    systemPromptTemplateHash: promptContract?.systemPromptTemplateHash ?? null,
    userPromptTemplateHash: promptContract?.userPromptTemplateHash ?? null,
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
    timeoutMs: null,
  };
};

export const emitExternalDebugEvent = async (
  emitDebugEvent: LocalAiRuntimePortOptions["emitDebugEvent"],
  input: Parameters<NonNullable<LocalAiRuntimePortOptions["emitDebugEvent"]>>[0],
) => {
  await emitDebugEvent?.(input);
};
