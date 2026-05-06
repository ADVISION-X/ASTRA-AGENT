import type {
  AiChildCapabilityId,
  AiExecutionContext,
  ParsedAiAbilityInput,
} from "../contract.js";
import type { AiRuntimeStructuredDebugEvent } from "../runtime-adapters/local-ai-runtime-debug-contract.js";
import { buildStableAiRef } from "../shared/ai-types.js";

type ExecutionFailureDebugInput = {
  context: AiExecutionContext;
  rawInput: ParsedAiAbilityInput;
  childCapabilityId: AiChildCapabilityId;
  error: unknown;
};

type ExecutionFailureDebugRefs = {
  statusMessage: string;
  originalErrorName: string;
  runtimeCallId: string;
  diagnosticPayloadRef: string;
};

const buildExecutionFailureDebugRefs = (input: ExecutionFailureDebugInput): ExecutionFailureDebugRefs => {
  const statusMessage = input.error instanceof Error ? input.error.message : "AI child execution failed.";
  const originalErrorName = input.error instanceof Error ? input.error.name : "UnknownError";

  return {
    statusMessage,
    originalErrorName,
    runtimeCallId: buildStableAiRef("ai-runtime-call", [
      input.rawInput.sessionId,
      input.rawInput.taskType,
      input.rawInput.stepId,
      input.rawInput.capabilityCallId,
      originalErrorName,
    ]),
    diagnosticPayloadRef: buildStableAiRef("ai-runtime-execution-diagnostic", [
      input.rawInput.missionId,
      input.rawInput.sessionId,
      input.rawInput.taskType,
      originalErrorName,
    ]),
  };
};

const buildExecutionFailureDebugBase = (
  input: ExecutionFailureDebugInput,
  refs: ExecutionFailureDebugRefs,
): Pick<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "sessionId" | "missionId" | "roundId" | "videoVisitId" | "traceId" | "spanId" | "attemptId" | "taskType" | "refs"> => ({
  eventType: "AI_ERROR_DEBUG",
  level: "ERROR",
  status: "failed",
  sessionId: input.rawInput.sessionId,
  missionId: input.rawInput.missionId,
  roundId: input.rawInput.roundId,
  videoVisitId: input.rawInput.videoVisitId,
  traceId: input.rawInput.capabilityCallId,
  spanId: refs.runtimeCallId,
  attemptId: `${refs.runtimeCallId}:attempt:0`,
  taskType: input.rawInput.taskType,
  refs: input.rawInput.inputRefs.map((ref) => ref.id),
});

const buildExecutionFailureDebugRuntime = (
  input: ExecutionFailureDebugInput,
  refs: ExecutionFailureDebugRefs,
): Pick<AiRuntimeStructuredDebugEvent, "provider" | "model" | "modelRole" | "runtime" | "implementationStatus" | "errorKind" | "runtimeCallId" | "diagnosticPayloadRef" | "schemaIssueCount" | "failureReason" | "actionableMessage" | "ownerResponsible"> => ({
  provider: null,
  model: null,
  modelRole: null,
  runtime: null,
  implementationStatus: "runtime_execution_failed",
  errorKind: refs.originalErrorName,
  runtimeCallId: refs.runtimeCallId,
  diagnosticPayloadRef: refs.diagnosticPayloadRef,
  schemaIssueCount: 0,
  failureReason: "runtime_execution_failed",
  actionableMessage: refs.statusMessage,
  ownerResponsible: "AI Capability / Local AI Runtime",
});

const buildExecutionFailureDebugPrompt = (
  input: ExecutionFailureDebugInput,
  refs: ExecutionFailureDebugRefs,
): Pick<AiRuntimeStructuredDebugEvent, "promptContractId" | "promptVersion" | "outputSchemaRef" | "promptDebugRef" | "systemPromptHash" | "userPromptHash" | "promptPreview" | "promptFullText" | "promptCatalogVersion" | "providerConfigRef" | "secretRef" | "promptDebugBundleRef" | "providerRequestBodyRedacted" | "providerRequestDebugRef"> => ({
  promptContractId: input.rawInput.promptContractId,
  promptVersion: null,
  outputSchemaRef: input.rawInput.expectedOutputSchema,
  promptDebugRef: refs.diagnosticPayloadRef,
  systemPromptHash: null,
  userPromptHash: null,
  promptPreview: null,
  promptFullText: null,
  promptCatalogVersion: input.rawInput.promptCatalogVersion,
  providerConfigRef: input.rawInput.providerPolicy.providerConfigRef,
  secretRef: input.rawInput.providerPolicy.secretRef,
  promptDebugBundleRef: refs.diagnosticPayloadRef,
  providerRequestBodyRedacted: null,
  providerRequestDebugRef: refs.diagnosticPayloadRef,
});

const buildExecutionFailureDebugOutput = (
  input: ExecutionFailureDebugInput,
  refs: ExecutionFailureDebugRefs,
): Pick<AiRuntimeStructuredDebugEvent, "rawResponsePreview" | "rawResponseText" | "rawResponseHash" | "rawResponseRef" | "parsedJson" | "parsedDecision" | "parserErrors" | "sourceScreenshotEvidenceId" | "aiInputArtifactRef" | "imageInputs" | "tokenEstimate"> => ({
  rawResponsePreview: null,
  rawResponseText: null,
  rawResponseHash: null,
  rawResponseRef: refs.diagnosticPayloadRef,
  parsedJson: null,
  parsedDecision: null,
  parserErrors: [refs.statusMessage],
  sourceScreenshotEvidenceId: input.rawInput.inputRefs[0]?.id ?? null,
  aiInputArtifactRef: input.rawInput.inputRefs[0]?.id ?? null,
  imageInputs: [],
  tokenEstimate: null,
});

const buildExecutionFailureDebugCatalog = (): Pick<AiRuntimeStructuredDebugEvent, "inputPackageId" | "inputPackageVersion" | "inputPackageHash" | "capabilityCatalogVersion" | "outputSchemaCatalogVersion" | "mapPackageSchemaVersion"> => ({
  inputPackageId: null,
  inputPackageVersion: null,
  inputPackageHash: null,
  capabilityCatalogVersion: null,
  outputSchemaCatalogVersion: null,
  mapPackageSchemaVersion: null,
});

export const emitAiExecutionFailureDebug = async (input: ExecutionFailureDebugInput) => {
  if (!input.context.emitDebugEvent) {
    return;
  }

  const started = input.context.clock.startRun();
  const ended = input.context.clock.finishRun(started);
  const refs = buildExecutionFailureDebugRefs(input);
  await input.context.emitDebugEvent({
    ...buildExecutionFailureDebugBase(input, refs),
    ...buildExecutionFailureDebugRuntime(input, refs),
    ...buildExecutionFailureDebugPrompt(input, refs),
    ...buildExecutionFailureDebugOutput(input, refs),
    ...buildExecutionFailureDebugCatalog(),
    durationMs: ended.durationMs,
  });
};
