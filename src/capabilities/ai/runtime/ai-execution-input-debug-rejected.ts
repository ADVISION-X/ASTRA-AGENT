import type { AiTaskType } from "../contract.js";
import type { AiRuntimeStructuredDebugEvent } from "../runtime-adapters/local-ai-runtime-debug-contract.js";
import { AI_TASK_TYPES, buildStableAiRef } from "../shared/ai-types.js";

type InputDebugShapeIssue = {
  sessionId: string | null;
  missionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string | null;
  capabilityCallId: string | null;
  taskType: AiTaskType | null;
  promptContractId: string | null;
  expectedOutputSchema: string | null;
  promptCatalogVersion: string | null;
  refs: string[];
  missingRequiredFields: string[];
  rawInputShapeRef: string;
  diagnosticPayloadRef: string;
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

const describeInputShape = (value: unknown): string => {
  const record = readObject(value);
  if (!record) return typeof value;
  return Object.keys(record).sort().join("|") || "empty-object";
};

const buildInputDebugShapeIssue = (value: unknown): InputDebugShapeIssue => {
  const sessionId = readString(readNestedField(value, "sessionId"));
  const stepId = readString(readNestedField(value, "stepId"));
  const capabilityCallId = readString(readNestedField(value, "capabilityCallId"));
  const taskType = readTaskType(readNestedField(value, "taskType"));
  const missingRequiredFields = [
    sessionId ? null : "sessionId",
    stepId ? null : "stepId",
    capabilityCallId ? null : "capabilityCallId",
    taskType ? null : "taskType",
  ].filter((field): field is string => field !== null);
  const rawInputShapeRef = buildStableAiRef("ai-raw-input-shape", [
    describeInputShape(value),
    missingRequiredFields.join("_"),
  ]);

  return {
    sessionId,
    missionId: readString(readNestedField(value, "missionId")),
    roundId: readString(readNestedField(value, "roundId")),
    videoVisitId: readString(readNestedField(value, "videoVisitId")),
    stepId,
    capabilityCallId,
    taskType,
    promptContractId: readString(readNestedField(value, "promptContractId")),
    expectedOutputSchema: readString(readNestedField(value, "expectedOutputSchema")),
    promptCatalogVersion: readString(readNestedField(value, "promptCatalogVersion")),
    refs: readInputRefIds(readNestedField(value, "inputRefs")),
    missingRequiredFields,
    rawInputShapeRef,
    diagnosticPayloadRef: `${rawInputShapeRef}:input-debug-fields-missing`,
  };
};

const buildRejectedIdentity = (issue: InputDebugShapeIssue) => {
  const sessionId = issue.sessionId ?? buildStableAiRef("ai-input-debug-session", [issue.rawInputShapeRef]);
  const taskType = issue.taskType ?? "schema_validation_only";
  const runtimeCallId = buildStableAiRef("ai-runtime-call", [
    sessionId,
    taskType,
    issue.stepId ?? "step-missing",
    issue.capabilityCallId ?? "capability-call-missing",
    "input-debug-fields-missing",
  ]);
  return { sessionId, taskType, runtimeCallId };
};

const emptyCatalogFields = () => ({
  inputPackageId: null,
  inputPackageVersion: null,
  inputPackageHash: null,
  capabilityCatalogVersion: null,
  outputSchemaCatalogVersion: null,
  mapPackageSchemaVersion: null,
});

const buildRejectedBaseFields = (
  issue: InputDebugShapeIssue,
  identity: ReturnType<typeof buildRejectedIdentity>,
): Pick<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "sessionId" | "missionId" | "roundId" | "videoVisitId" | "stepId" | "traceId" | "spanId" | "attemptId" | "taskType" | "refs"> => {
  return {
    eventType: "AI_INPUT_DEBUG_REJECTED",
    level: "DEBUG",
    status: "review_required",
    sessionId: identity.sessionId,
    missionId: issue.missionId,
    roundId: issue.roundId,
    videoVisitId: issue.videoVisitId,
    stepId: issue.stepId,
    traceId: issue.capabilityCallId ?? identity.runtimeCallId,
    spanId: identity.runtimeCallId,
    attemptId: `${identity.runtimeCallId}:attempt:0`,
    taskType: identity.taskType,
    refs: [...issue.refs, `rawInputShapeRef=${issue.rawInputShapeRef}`, `diagnosticPayloadRef=${issue.diagnosticPayloadRef}`],
  };
};

const buildRejectedRuntimeFields = (
  issue: InputDebugShapeIssue,
  identity: ReturnType<typeof buildRejectedIdentity>,
  failureReason = "ai_input_debug_fields_missing",
) => ({
    provider: null,
    model: null,
    modelRole: null,
    runtime: "ai-executor",
    implementationStatus: "input_debug_fields_missing",
    errorKind: "InputDebugShapeMissing",
    runtimeCallId: identity.runtimeCallId,
    diagnosticPayloadRef: issue.diagnosticPayloadRef,
    schemaIssueCount: issue.missingRequiredFields.length,
    failureReason,
    actionableMessage: failureReason === "ai_input_debug_fields_missing"
      ? `AI request debug is missing required chain fields: ${issue.missingRequiredFields.join(", ")}.`
      : "AI input proof is missing a governed promptInputRef or prepared image artifact.",
    ownerResponsible: "AI Capability",
});

const buildRejectedPromptFields = (issue: InputDebugShapeIssue) => ({
    promptContractId: issue.promptContractId,
    promptVersion: null,
    outputSchemaRef: issue.expectedOutputSchema,
    promptDebugRef: issue.diagnosticPayloadRef,
    systemPromptHash: null,
    userPromptHash: null,
    promptPreview: null,
    promptFullText: null,
    promptCatalogVersion: issue.promptCatalogVersion,
    providerConfigRef: null,
    secretRef: null,
    promptDebugBundleRef: issue.diagnosticPayloadRef,
    providerRequestBodyRedacted: null,
    providerRequestDebugRef: issue.diagnosticPayloadRef,
});

const buildRejectedOutputFields = (issue: InputDebugShapeIssue) => ({
    rawResponsePreview: null,
    rawResponseText: null,
    rawResponseHash: null,
    rawResponseRef: null,
    parsedJson: null,
    parsedDecision: null,
    parserErrors: issue.missingRequiredFields,
    sourceScreenshotEvidenceId: issue.refs[0] ?? null,
    aiInputArtifactRef: issue.rawInputShapeRef,
    imageInputs: [],
    tokenEstimate: null,
    durationMs: null,
});

export const buildRejectedInputDebug = (inputValue: unknown, failureReason?: string): AiRuntimeStructuredDebugEvent => {
  const issue = buildInputDebugShapeIssue(inputValue);
  const identity = buildRejectedIdentity(issue);
  return {
    ...buildRejectedBaseFields(issue, identity),
    ...buildRejectedRuntimeFields(issue, identity, failureReason),
    ...buildRejectedPromptFields(issue),
    ...buildRejectedOutputFields(issue),
    ...emptyCatalogFields(),
  };
};
