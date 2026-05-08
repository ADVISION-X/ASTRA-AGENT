import type { AiExecutionContext, AiTaskType } from "../contract.js";
import type { AiRuntimeStructuredDebugEvent } from "../runtime-adapters/local-ai-runtime-debug-contract.js";
import { AI_TASK_TYPES, buildStableAiRef } from "../shared/ai-types.js";
import { buildRejectedInputDebug } from "./ai-execution-input-debug-rejected.js";
import { resolveAiInputProofSummary } from "../shared/ai-input-proof-registry.js";

type InputDebugFields = {
  sessionId: string;
  missionId: string | null;
  runId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string;
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationSnapshotRef: string | null;
  capabilityCallId: string;
  nerveBusEnvelopeId: string | null;
  inputRef: string | null;
  idempotencyKey: string | null;
  taskType: AiTaskType;
  promptContractId: string | null;
  expectedOutputSchema: string | null;
  promptCatalogVersion: string | null;
  refs: string[];
};

const readObject = (value: unknown): object | null =>
  value && typeof value === "object" ? value : null;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const readField = (value: object, field: string): unknown => Reflect.get(value, field);

const readNestedField = (value: unknown, field: string, maxDepth = 3): unknown => {
  const record = readObject(value);
  if (!record || maxDepth < 0) return undefined;
  const direct = readField(record, field);
  if (direct !== undefined) return direct;
  for (const nested of Object.values(record)) {
    const candidate = readNestedField(nested, field, maxDepth - 1);
    if (candidate !== undefined) return candidate;
  }
  return undefined;
};

const readTaskType = (value: unknown): AiTaskType | null => {
  const taskType = readString(value);
  return taskType && (AI_TASK_TYPES as readonly string[]).includes(taskType) ? taskType as AiTaskType : null;
};

const readInputRefIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = readObject(item);
    return record ? readString(readField(record, "id")) : null;
  }).filter((id): id is string => id !== null);
};

const readInputDebugFields = (value: unknown): InputDebugFields | null => {
  const record = readObject(value);
  if (!record) return null;
  const sessionId = readString(readNestedField(record, "sessionId"));
  const stepId = readString(readNestedField(record, "stepId"));
  const capabilityCallId = readString(readNestedField(record, "capabilityCallId"));
  const taskType = readTaskType(readNestedField(record, "taskType"));
  if (!sessionId || !stepId || !capabilityCallId || !taskType) return null;
  return {
    sessionId,
    missionId: readString(readNestedField(record, "missionId")),
    runId: readString(readNestedField(record, "runId")),
    roundId: readString(readNestedField(record, "roundId")),
    videoVisitId: readString(readNestedField(record, "videoVisitId")),
    stepId,
    mapPackageId: readString(readNestedField(record, "mapPackageId")),
    mapPackageVersion: readString(readNestedField(record, "mapPackageVersion")),
    selectedMapId: readString(readNestedField(record, "selectedMapId")),
    selectedMapVersion: readString(readNestedField(record, "selectedMapVersion")),
    activationSnapshotRef: readString(readNestedField(record, "activationSnapshotRef")),
    capabilityCallId,
    nerveBusEnvelopeId: readString(readNestedField(record, "nerveBusEnvelopeId")),
    inputRef: readString(readNestedField(record, "inputRef")),
    idempotencyKey: readString(readNestedField(record, "idempotencyKey")),
    taskType,
    promptContractId: readString(readNestedField(record, "promptContractId")),
    expectedOutputSchema: readString(readNestedField(record, "expectedOutputSchema")),
    promptCatalogVersion: readString(readNestedField(record, "promptCatalogVersion")),
    refs: readInputRefIds(readNestedField(record, "inputRefs")),
  };
};

const buildInputDebugIdentity = (fields: InputDebugFields) => {
  const runtimeCallId = buildStableAiRef("ai-runtime-call", [
    fields.sessionId,
    fields.taskType,
    fields.stepId,
    fields.capabilityCallId,
    "input-parse-pending",
  ]);
  return {
    runtimeCallId,
    diagnosticPayloadRef: `${runtimeCallId}:input-debug`,
  };
};

const buildInputDebugBase = (
  fields: InputDebugFields,
  identity: ReturnType<typeof buildInputDebugIdentity>,
): Pick<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "sessionId" | "missionId" | "runId" | "roundId" | "videoVisitId" | "stepId" | "mapPackageId" | "mapPackageVersion" | "selectedMapId" | "selectedMapVersion" | "activationSnapshotRef" | "capabilityCallId" | "nerveBusEnvelopeId" | "inputRef" | "idempotencyKey" | "traceId" | "spanId" | "attemptId" | "taskType" | "refs"> => ({
  eventType: "AI_INPUT_REQUEST_DEBUG",
  level: "DEBUG",
  status: "started",
  sessionId: fields.sessionId,
  missionId: fields.missionId,
  runId: fields.runId ?? fields.missionId ?? fields.sessionId,
  roundId: fields.roundId,
  videoVisitId: fields.videoVisitId,
  stepId: fields.stepId,
  mapPackageId: fields.mapPackageId,
  mapPackageVersion: fields.mapPackageVersion,
  selectedMapId: fields.selectedMapId,
  selectedMapVersion: fields.selectedMapVersion,
  activationSnapshotRef: fields.activationSnapshotRef,
  capabilityCallId: fields.capabilityCallId,
  nerveBusEnvelopeId: fields.nerveBusEnvelopeId,
  inputRef: fields.inputRef ?? fields.refs[0] ?? null,
  idempotencyKey: fields.idempotencyKey ?? identity.runtimeCallId,
  traceId: fields.capabilityCallId,
  spanId: identity.runtimeCallId,
  attemptId: `${identity.runtimeCallId}:attempt:0`,
  taskType: fields.taskType,
  refs: fields.refs,
});

const buildInputDebugRuntime = (
  identity: ReturnType<typeof buildInputDebugIdentity>,
): Pick<AiRuntimeStructuredDebugEvent, "provider" | "model" | "modelRole" | "runtime" | "implementationStatus" | "errorKind" | "runtimeCallId" | "diagnosticPayloadRef" | "schemaIssueCount" | "failureReason" | "actionableMessage" | "ownerResponsible"> => ({
  provider: null,
  model: null,
  modelRole: null,
  runtime: "ai-executor",
  implementationStatus: "input_parse_pending",
  errorKind: null,
  runtimeCallId: identity.runtimeCallId,
  diagnosticPayloadRef: identity.diagnosticPayloadRef,
  schemaIssueCount: null,
  failureReason: null,
  actionableMessage: null,
  ownerResponsible: "ai-capability",
});

const buildInputDebugPrompt = (
  fields: InputDebugFields,
  identity: ReturnType<typeof buildInputDebugIdentity>,
): Pick<AiRuntimeStructuredDebugEvent, "promptContractId" | "promptVersion" | "outputSchemaRef" | "promptDebugRef" | "systemPromptHash" | "userPromptHash" | "promptPreview" | "promptFullText" | "promptCatalogVersion" | "providerConfigRef" | "secretRef" | "promptDebugBundleRef" | "providerRequestBodyRedacted" | "providerRequestDebugRef"> => ({
  promptContractId: fields.promptContractId,
  promptVersion: null,
  outputSchemaRef: fields.expectedOutputSchema,
  promptDebugRef: identity.diagnosticPayloadRef,
  systemPromptHash: null,
  userPromptHash: null,
  promptPreview: null,
  promptFullText: null,
  promptCatalogVersion: fields.promptCatalogVersion,
  providerConfigRef: null,
  secretRef: null,
  promptDebugBundleRef: identity.diagnosticPayloadRef,
  providerRequestBodyRedacted: null,
  providerRequestDebugRef: identity.diagnosticPayloadRef,
});

const buildInputDebugOutput = (
  fields: InputDebugFields,
): Pick<AiRuntimeStructuredDebugEvent, "rawResponsePreview" | "rawResponseText" | "rawResponseHash" | "rawResponseRef" | "parsedJson" | "parsedDecision" | "parserErrors" | "sourceScreenshotEvidenceId" | "aiInputArtifactRef" | "imageInputs" | "tokenEstimate" | "durationMs"> => {
  const proofs = fields.refs.map((ref) => resolveAiInputProofSummary(ref)).filter((proof): proof is NonNullable<ReturnType<typeof resolveAiInputProofSummary>> => proof !== null);
  const firstProof = proofs[0];
  return {
    rawResponsePreview: null,
    rawResponseText: null,
    rawResponseHash: null,
    rawResponseRef: null,
    parsedJson: null,
    parsedDecision: null,
    parserErrors: [],
    sourceScreenshotEvidenceId: firstProof?.sourceScreenshotEvidenceId ?? fields.refs[0] ?? null,
    aiInputArtifactRef: firstProof?.aiInputArtifactRef ?? fields.refs[0] ?? null,
    imageInputs: proofs.map((proof) => ({
      refId: proof.promptInputRef,
      artifactRef: proof.aiInputArtifactRef,
      filePath: proof.aiInputStorageRef,
      hash: proof.preparedImageHash,
      bytes: null,
      width: proof.preparedImageWidth,
      height: proof.preparedImageHeight,
    })),
    tokenEstimate: null,
    durationMs: null,
  };
};

const buildInputDebugCatalog = (): Pick<AiRuntimeStructuredDebugEvent, "inputPackageId" | "inputPackageVersion" | "inputPackageHash" | "capabilityCatalogVersion" | "outputSchemaCatalogVersion" | "mapPackageSchemaVersion"> => ({
  inputPackageId: null,
  inputPackageVersion: null,
  inputPackageHash: null,
  capabilityCatalogVersion: null,
  outputSchemaCatalogVersion: null,
  mapPackageSchemaVersion: null,
});

export const emitAiExecutionInputDebug = async (context: AiExecutionContext, inputValue: unknown) => {
  if (!context.emitDebugEvent) return;
  const fields = readInputDebugFields(inputValue);
  if (!fields) {
    await context.emitDebugEvent(buildRejectedInputDebug(inputValue));
    return;
  }
  if ((fields.taskType === "page_preparation_judgment" || fields.taskType === "product_presence_judgment") && (!fields.refs[0] || !resolveAiInputProofSummary(fields.refs[0]))) {
    await context.emitDebugEvent(buildRejectedInputDebug(inputValue, fields.refs[0] ? "ai_input_artifact_missing" : "ai_input_ref_missing"));
    return;
  }
  const identity = buildInputDebugIdentity(fields);
  await context.emitDebugEvent({
    ...buildInputDebugBase(fields, identity),
    ...buildInputDebugRuntime(identity),
    ...buildInputDebugPrompt(fields, identity),
    ...buildInputDebugOutput(fields),
    ...buildInputDebugCatalog(),
  });
};
