import type {
  AiChildContract,
  AiExecutionContext,
  ParsedAiAbilityInput,
} from "../contract.js";
import type { ResolvedAiPromptContract } from "../ports/ai-prompt-registry-port.js";
import type { AiRuntimeStructuredDebugEvent } from "../runtime-adapters/local-ai-runtime-debug-contract.js";
import { buildAiRuntimeCallIdentity } from "./ai-idempotency.js";
import { resolveAiInputProofSummary } from "../shared/ai-input-proof-registry.js";

type ExecutionRequestDebugInput = {
  context: AiExecutionContext;
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  promptContract: ResolvedAiPromptContract;
};

const buildRequestDebugRefs = (input: ExecutionRequestDebugInput) => {
  const identity = buildAiRuntimeCallIdentity(input.request);
  const diagnosticPayloadRef = `${identity.runtimeCallId}:request-debug`;

  return {
    runtimeCallId: identity.runtimeCallId,
    diagnosticPayloadRef,
    requestHash: identity.requestHash,
  };
};

const buildRequestDebugBase = (
  input: ExecutionRequestDebugInput,
  runtimeCallId: string,
): Pick<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "sessionId" | "missionId" | "runId" | "roundId" | "videoVisitId" | "stepId" | "mapPackageId" | "mapPackageVersion" | "selectedMapId" | "selectedMapVersion" | "activationSnapshotRef" | "capabilityCallId" | "nerveBusEnvelopeId" | "inputRef" | "idempotencyKey" | "traceId" | "spanId" | "attemptId" | "taskType" | "refs"> => ({
  eventType: "AI_REQUEST_DEBUG",
  level: "DEBUG",
  status: "started",
  sessionId: input.request.sessionId,
  missionId: input.request.missionId,
  runId: input.request.missionId ?? input.request.sessionId,
  roundId: input.request.roundId,
  videoVisitId: input.request.videoVisitId,
  stepId: input.request.stepId,
  mapPackageId: input.request.mapPackageId,
  mapPackageVersion: input.request.mapPackageVersion,
  selectedMapId: input.request.selectedMapId,
  selectedMapVersion: input.request.selectedMapVersion,
  activationSnapshotRef: input.request.activationSnapshotRef,
  capabilityCallId: input.request.capabilityCallId,
  nerveBusEnvelopeId: input.request.nerveBusEnvelopeId,
  inputRef: input.request.inputRefs[0]?.id ?? null,
  idempotencyKey: runtimeCallId,
  traceId: input.request.capabilityCallId,
  spanId: runtimeCallId,
  attemptId: `${runtimeCallId}:attempt:0`,
  taskType: input.request.taskType,
  refs: input.request.inputRefs.map((ref) => ref.id),
});

const buildRequestDebugRuntime = (
  input: ExecutionRequestDebugInput,
  refs: ReturnType<typeof buildRequestDebugRefs>,
): Pick<AiRuntimeStructuredDebugEvent, "provider" | "model" | "modelRole" | "runtime" | "implementationStatus" | "errorKind" | "runtimeCallId" | "diagnosticPayloadRef" | "schemaIssueCount" | "failureReason" | "actionableMessage" | "ownerResponsible"> => ({
  provider: input.childContract.providerKind,
  model: null,
  modelRole: input.childContract.modelRole,
  runtime: "ai-executor",
  implementationStatus: "pre_runtime_request_prepared",
  errorKind: null,
  runtimeCallId: refs.runtimeCallId,
  diagnosticPayloadRef: refs.diagnosticPayloadRef,
  schemaIssueCount: null,
  failureReason: null,
  actionableMessage: null,
  ownerResponsible: "ai-capability",
});

const buildRequestDebugPrompt = (
  input: ExecutionRequestDebugInput,
  refs: ReturnType<typeof buildRequestDebugRefs>,
): Pick<AiRuntimeStructuredDebugEvent, "promptContractId" | "promptVersion" | "outputSchemaRef" | "promptDebugRef" | "systemPromptHash" | "userPromptHash" | "promptPreview" | "promptFullText" | "promptCatalogVersion" | "providerConfigRef" | "secretRef" | "promptDebugBundleRef" | "providerRequestBodyRedacted" | "providerRequestDebugRef"> => ({
  promptContractId: input.request.promptContractId,
  promptVersion: input.promptContract.promptVersion,
  outputSchemaRef: input.request.expectedOutputSchema,
  promptDebugRef: refs.diagnosticPayloadRef,
  systemPromptHash: input.promptContract.promptHash,
  userPromptHash: refs.requestHash,
  promptPreview: null,
  promptFullText: null,
  promptCatalogVersion: input.request.promptCatalogVersion,
  providerConfigRef: input.request.providerPolicy.providerConfigRef,
  secretRef: input.request.providerPolicy.secretRef,
  promptDebugBundleRef: refs.diagnosticPayloadRef,
  providerRequestBodyRedacted: null,
  providerRequestDebugRef: refs.diagnosticPayloadRef,
});

const buildRequestDebugOutput = (
  input: ExecutionRequestDebugInput,
): Pick<AiRuntimeStructuredDebugEvent, "rawResponsePreview" | "rawResponseText" | "rawResponseHash" | "rawResponseRef" | "parsedJson" | "parsedDecision" | "parserErrors" | "sourceScreenshotEvidenceId" | "aiInputArtifactRef" | "imageInputs" | "tokenEstimate"> => {
  const proof = resolveAiInputProofSummary(input.request.inputRefs[0]?.id);
  return {
    rawResponsePreview: null,
    rawResponseText: null,
    rawResponseHash: null,
    rawResponseRef: null,
    parsedJson: null,
    parsedDecision: null,
    parserErrors: [],
    sourceScreenshotEvidenceId: proof?.sourceScreenshotEvidenceId ?? null,
    aiInputArtifactRef: proof?.aiInputArtifactRef ?? null,
    imageInputs: proof ? [{
      refId: proof.promptInputRef,
      artifactRef: proof.aiInputArtifactRef,
      filePath: proof.aiInputStorageRef,
      hash: proof.preparedImageHash,
      bytes: null,
      width: proof.preparedImageWidth,
      height: proof.preparedImageHeight,
    }] : [],
    tokenEstimate: null,
  };
};

const buildRequestDebugCatalog = (): Pick<AiRuntimeStructuredDebugEvent, "inputPackageId" | "inputPackageVersion" | "inputPackageHash" | "capabilityCatalogVersion" | "outputSchemaCatalogVersion" | "mapPackageSchemaVersion"> => ({
  inputPackageId: null,
  inputPackageVersion: null,
  inputPackageHash: null,
  capabilityCatalogVersion: null,
  outputSchemaCatalogVersion: null,
  mapPackageSchemaVersion: null,
});

export const emitAiExecutionRequestDebug = async (input: ExecutionRequestDebugInput) => {
  if (!input.context.emitDebugEvent) {
    return;
  }

  const refs = buildRequestDebugRefs(input);
  await input.context.emitDebugEvent({
    ...buildRequestDebugBase(input, refs.runtimeCallId),
    ...buildRequestDebugRuntime(input, refs),
    ...buildRequestDebugPrompt(input, refs),
    ...buildRequestDebugOutput(input),
    ...buildRequestDebugCatalog(),
    durationMs: null,
  });
};
