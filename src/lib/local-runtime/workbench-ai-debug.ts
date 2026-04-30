import type { AiRuntimeStructuredDebugEvent } from "../../capabilities/ai/runtime-adapters/local-ai-runtime-adapter.js";
import type { ForensicsArtifactRef } from "../../capabilities/forensics-persistence/index.js";
import { StructuredRuntimeEventSchema } from "../../types/structured-log.js";
import { createId } from "./ids.js";
import type { WorkbenchBaseRuntime } from "./workbench-contract.js";

const resolveAiDebugChildCapabilityId = (
  taskType: AiRuntimeStructuredDebugEvent["taskType"],
): "local-vision-ai" | "local-text-ai" | "local-ocr-ai" | "internal-schema-validator" => {
  switch (taskType) {
    case "ocr_cleanup": return "local-ocr-ai";
    case "comment_signal_summary":
    case "product_signal_summary":
    case "evidence_packet_analysis": return "local-text-ai";
    case "schema_validation_only": return "internal-schema-validator";
    default: return "local-vision-ai";
  }
};

const resolveAiDebugStep = (
  taskType: AiRuntimeStructuredDebugEvent["taskType"],
): "ask_ai_product_presence" | "extract_visible_comments" | "summarize_comment_signals" | "create_pending_candidate" | "validate_ai_output" => {
  switch (taskType) {
    case "ocr_cleanup": return "extract_visible_comments";
    case "comment_signal_summary": return "summarize_comment_signals";
    case "product_signal_summary":
    case "evidence_packet_analysis": return "create_pending_candidate";
    case "schema_validation_only": return "validate_ai_output";
    default: return "ask_ai_product_presence";
  }
};

const buildAiArtifactRefs = (input: AiRuntimeStructuredDebugEvent): ForensicsArtifactRef[] => {
  const refs: ForensicsArtifactRef[] = [];
  if (input.promptDebugRef) refs.push({ artifactType: "json", artifactId: input.promptDebugRef, storageRef: null, sourceRecordRef: null });
  if (input.rawResponseRef) refs.push({ artifactType: "json", artifactId: input.rawResponseRef, storageRef: null, sourceRecordRef: null });
  if (input.aiInputArtifactRef) refs.push({ artifactType: "other", artifactId: input.aiInputArtifactRef, storageRef: null, sourceRecordRef: null });
  return refs;
};

export const recordAiDebugEvent = async (
  runtime: WorkbenchBaseRuntime,
  input: AiRuntimeStructuredDebugEvent,
): Promise<void> => {
  const artifactRefs = buildAiArtifactRefs(input);
  await runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "ai",
    sourceAbilityGroupId: "ai",
    sourceChildCapabilityId: resolveAiDebugChildCapabilityId(input.taskType),
    sessionId: input.sessionId,
    roundId: input.roundId ?? input.attemptId,
    videoVisitId: input.videoVisitId,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs,
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [...input.parserErrors, ...(input.errorKind ? [input.errorKind] : [])],
    payload: {
      structuredRuntimeEvent: StructuredRuntimeEventSchema.parse({
        eventId: createId("event"),
        eventType: input.eventType,
        level: input.level,
        phase: "ai-runtime",
        component: "local-ai-runtime",
        owner: "AI Capability",
        abilityGroupId: "ai",
        childCapabilityId: resolveAiDebugChildCapabilityId(input.taskType),
        skillId: null,
        skillCategory: null,
        sessionId: input.sessionId,
        missionId: input.missionId,
        roundId: input.roundId,
        videoVisitId: input.videoVisitId,
        mapId: null,
        stepId: input.roundId,
        taskTemplateId: null,
        traceId: input.traceId,
        spanId: input.spanId,
        attemptId: input.attemptId,
        browserProfileRef: runtime.browserSessionConfig.profileRef,
        loginState: runtime.browserController.getSessionState().loginState,
        step: resolveAiDebugStep(input.taskType),
        previousStep: null,
        nextStep: null,
        status: input.status,
        reason: input.eventType === "AI_REQUEST_DEBUG" ? `AI request prepared for ${input.taskType}.` : input.eventType === "AI_RESPONSE_DEBUG" ? `AI response captured for ${input.taskType}.` : input.failureReason,
        failureReason: input.failureReason,
        reviewRequiredReason: input.status === "review_required" ? input.failureReason : null,
        actionableMessage: input.actionableMessage,
        ownerResponsible: input.ownerResponsible,
        decision: input.parsedDecision,
        roundOutcome: null,
        finalizationType: null,
        samplingStrategy: null,
        expectedFrameCount: null,
        validFrameCount: null,
        fallbackReason: null,
        missingFrames: [],
        snapshotSummary: null,
        provider: input.provider,
        model: input.model,
        modelRole: input.modelRole,
        runtime: input.runtime,
        promptContractId: input.promptContractId,
        promptVersion: input.promptVersion,
        outputSchemaRef: input.outputSchemaRef,
        promptDebugRef: input.promptDebugRef,
        systemPromptHash: input.systemPromptHash,
        userPromptHash: input.userPromptHash,
        promptPreview: input.promptPreview,
        promptFullText: input.promptFullText,
        rawResponsePreview: input.rawResponsePreview,
        rawResponseText: input.rawResponseText,
        rawResponseHash: input.rawResponseHash,
        rawResponseRef: input.rawResponseRef,
        parsedJson: input.parsedJson,
        parsedDecision: input.parsedDecision,
        parserErrors: input.parserErrors,
        sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
        aiInputArtifactRef: input.aiInputArtifactRef,
        imageInputs: input.imageInputs,
        tokenEstimate: input.tokenEstimate,
        exitCode: null,
        signal: null,
        pid: null,
        startedAt: null,
        endedAt: null,
        lastRuntimeEventId: null,
        lastCommandEventId: null,
        lastAiEventId: null,
        likelyCauseRef: null,
        crashBundleRef: null,
        createdAt: new Date().toISOString(),
        durationMs: input.durationMs,
        refs: input.refs,
        inputRefs: [],
        outputRefs: [],
        evidenceRefs: [],
        proofRefs: [],
        artifactRefs,
        actionLogRefs: [],
        dataQualityFlags: [...input.parserErrors, ...(input.errorKind ? [input.errorKind] : [])],
      }),
    },
  });
};