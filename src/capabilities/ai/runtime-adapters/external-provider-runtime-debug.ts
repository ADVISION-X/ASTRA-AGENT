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

const EMPTY_MAP_AUTHORING_REFS = {
  inputPackageId: null,
  inputPackageVersion: null,
  inputPackageHash: null,
  userRequirementRef: null,
  sourceRequirementHash: null,
  capabilityCatalogVersion: null,
  promptContractCatalogVersion: null,
  outputSchemaCatalogVersion: null,
  mapPackageSchemaVersion: null,
  mapAuthoringOutputSchemaVersion: null,
  safetyPolicyRef: null,
  humanApprovalPolicyRef: null,
  evidencePolicyRef: null,
  pavPolicyRef: null,
  forensicsPolicyRef: null,
  privacyPolicyRef: null,
  secretPolicyRef: null,
  rateLimitPolicyRef: null,
  platformProfileRef: null,
};

const buildMapAuthoringRefs = (request: ParsedAiAbilityInput) => {
  if (request.taskType !== "map_authoring") return EMPTY_MAP_AUTHORING_REFS;
  const input = request.input;
  return {
    inputPackageId: input.inputPackageId,
    inputPackageVersion: input.inputPackageVersion,
    inputPackageHash: `sha256:${hashExternalDebugValue(input)}`,
    userRequirementRef: input.userRequirementRef,
    sourceRequirementHash: input.sourceRequirementHash,
    capabilityCatalogVersion: input.capabilityCatalog.version,
    promptContractCatalogVersion: input.promptContractCatalog.version,
    outputSchemaCatalogVersion: input.outputSchemaCatalog.version,
    mapPackageSchemaVersion: input.mapPackageSchema.schemaVersion,
    mapAuthoringOutputSchemaVersion: input.mapAuthoringOutputSchema.schemaVersion,
    safetyPolicyRef: input.safetyPolicy.policyRef,
    humanApprovalPolicyRef: input.humanApprovalPolicy.policyRef,
    evidencePolicyRef: input.evidencePolicy.policyRef,
    pavPolicyRef: input.pavPolicy.policyRef,
    forensicsPolicyRef: input.forensicsPolicy.policyRef,
    privacyPolicyRef: input.privacyPolicy.policyRef,
    secretPolicyRef: input.secretPolicy.policyRef,
    rateLimitPolicyRef: input.rateLimitPolicy.policyRef,
    platformProfileRef: input.targetPlatformProfileRef,
  };
};

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
  modelRole: "map-authoring",
  runtime: "openai-compatible",
});

const buildExternalContractFields = (input: {
  request: ParsedAiAbilityInput;
  promptContract: ReturnType<typeof findMapAuthoringPromptContract>;
}) => ({
  promptContractId: input.request.promptContractId,
  promptContractVersion: input.promptContract?.promptContractVersion ?? input.request.promptContractId,
  promptVersion: input.promptContract?.promptContractVersion ?? input.request.promptContractId,
  promptCatalogVersion: input.request.promptCatalogVersion,
  promptContractHash: input.promptContract?.promptContractHash ?? input.promptContract?.promptHash ?? null,
  systemPromptTemplateHash: input.promptContract?.systemPromptTemplateHash ?? null,
  userPromptTemplateHash: input.promptContract?.userPromptTemplateHash ?? null,
  outputSchemaRef: input.request.expectedOutputSchema,
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
    ...buildExternalTraceFields(input.request),
    ...buildExternalModelFields(input.config),
    ...buildExternalRuntimeDiagnosticFields(input),
    ...buildExternalContractFields({ request: input.request, promptContract }),
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
