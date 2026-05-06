import type {
  AiChildCapabilityId,
  AiExecutionContext,
  ParsedAiAbilityInput,
} from "../contract.js";
import { buildStableAiRef } from "../shared/ai-types.js";

export const emitAiExecutionFailureDebug = async (
  input: {
    context: AiExecutionContext;
    rawInput: ParsedAiAbilityInput;
    childCapabilityId: AiChildCapabilityId;
    error: unknown;
  },
) => {
  if (!input.context.emitDebugEvent) {
    return;
  }

  const started = input.context.clock.startRun();
  const ended = input.context.clock.finishRun(started);
  const statusMessage = input.error instanceof Error ? input.error.message : "AI child execution failed.";
  const originalErrorName = input.error instanceof Error ? input.error.name : "UnknownError";
  const runtimeCallId = buildStableAiRef("ai-runtime-call", [
    input.rawInput.sessionId,
    input.rawInput.taskType,
    input.rawInput.stepId,
    input.rawInput.capabilityCallId,
    originalErrorName,
  ]);
  const diagnosticPayloadRef = buildStableAiRef("ai-runtime-execution-diagnostic", [
    input.rawInput.missionId,
    input.rawInput.sessionId,
    input.rawInput.taskType,
    originalErrorName,
  ]);

  await input.context.emitDebugEvent({
    eventType: "AI_ERROR_DEBUG",
    level: "ERROR",
    status: "failed",
    sessionId: input.rawInput.sessionId,
    missionId: input.rawInput.missionId,
    roundId: input.rawInput.roundId,
    videoVisitId: input.rawInput.videoVisitId,
    traceId: input.rawInput.capabilityCallId,
    spanId: runtimeCallId,
    attemptId: `${runtimeCallId}:attempt:0`,
    taskType: input.rawInput.taskType,
    refs: input.rawInput.inputRefs.map((ref) => ref.id),
    provider: null,
    model: null,
    modelRole: null,
    runtime: null,
    implementationStatus: "runtime_execution_failed",
    errorKind: originalErrorName,
    runtimeCallId,
    diagnosticPayloadRef,
    schemaIssueCount: 0,
    promptContractId: input.rawInput.promptContractId,
    promptVersion: null,
    outputSchemaRef: input.rawInput.expectedOutputSchema,
    promptDebugRef: diagnosticPayloadRef,
    systemPromptHash: null,
    userPromptHash: null,
    promptPreview: null,
    promptFullText: null,
    rawResponsePreview: null,
    rawResponseText: null,
    rawResponseHash: null,
    rawResponseRef: diagnosticPayloadRef,
    promptCatalogVersion: input.rawInput.promptCatalogVersion,
    providerConfigRef: input.rawInput.providerPolicy.providerConfigRef,
    secretRef: input.rawInput.providerPolicy.secretRef,
    inputPackageId: null,
    inputPackageVersion: null,
    inputPackageHash: null,
    capabilityCatalogVersion: null,
    outputSchemaCatalogVersion: null,
    mapPackageSchemaVersion: null,
    promptDebugBundleRef: diagnosticPayloadRef,
    providerRequestBodyRedacted: null,
    providerRequestDebugRef: diagnosticPayloadRef,
    parsedJson: null,
    parsedDecision: null,
    parserErrors: [statusMessage],
    sourceScreenshotEvidenceId: input.rawInput.inputRefs[0]?.id ?? null,
    aiInputArtifactRef: input.rawInput.inputRefs[0]?.id ?? null,
    imageInputs: [],
    tokenEstimate: null,
    failureReason: "runtime_execution_failed",
    actionableMessage: statusMessage,
    ownerResponsible: "AI Capability / Local AI Runtime",
    durationMs: ended.durationMs,
  });
};
