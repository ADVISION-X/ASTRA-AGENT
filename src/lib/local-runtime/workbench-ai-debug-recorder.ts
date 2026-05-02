import type { ForensicsArtifactRef } from "../../capabilities/forensics-persistence/index.js";
import type { AiRuntimeStructuredDebugEvent } from "../../capabilities/ai/runtime-adapters/local-ai-runtime-debug-contract.js";
import { getDefaultMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";
import { StructuredRuntimeEventSchema } from "../../types/structured-log.js";

import { createId } from "./ids.js";

type WorkbenchAiDebugRuntime = {
  browserSessionConfig: {
    profileRef: string | null;
  };
  browserController: {
    getSessionState(): {
      loginState: string | null;
    };
  };
  forensicsPersistenceAbilityGroup: {
    writeStructuredRuntimeEvent(input: unknown): Promise<unknown>;
  };
};

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
): string => {
  switch (taskType) {
    case "ocr_cleanup": return "extract_visible_comments";
    case "comment_signal_summary": return "summarize_comment_signals";
    case "product_signal_summary":
    case "evidence_packet_analysis": return "create_pending_candidate";
    case "schema_validation_only": return "validate_ai_output";
    default: return "ask_ai_product_presence";
  }
};

const buildAiDebugArtifactRefs = (input: AiRuntimeStructuredDebugEvent): ForensicsArtifactRef[] => {
  const refs: ForensicsArtifactRef[] = [];
  if (input.promptDebugRef) refs.push({ artifactType: "json", artifactId: input.promptDebugRef, storageRef: null, sourceRecordRef: null });
  if (input.rawResponseRef) refs.push({ artifactType: "json", artifactId: input.rawResponseRef, storageRef: null, sourceRecordRef: null });
  if (input.aiInputArtifactRef) refs.push({ artifactType: "other", artifactId: input.aiInputArtifactRef, storageRef: null, sourceRecordRef: null });
  return refs;
};

const splitTraceId = (traceId: string | null): { missionId: string | null; mapId: string | null } => {
  if (!traceId) {
    return { missionId: null, mapId: null };
  }
  const [missionId, ...rest] = traceId.split(":");
  return {
    missionId: missionId || null,
    mapId: rest.length > 0 ? rest.join(":") : null,
  };
};

const buildAiMapChain = (mapId: string | null) => {
  if (!mapId) {
    return {
      mapPackageId: null,
      mapPackageVersion: null,
      selectedMapVersion: null,
      activationSnapshotRef: null,
    };
  }

  const record = getDefaultMapPluginRegistry().active.getActiveOperationalMapRecord(mapId);
  return {
    mapPackageId: record?.packageId ?? null,
    mapPackageVersion: record?.packageVersion ?? null,
    selectedMapVersion: record?.mapVersion ?? null,
    activationSnapshotRef: record?.activationSnapshotRef ?? null,
  };
};

const buildAiStructuredRuntimeEvent = (runtime: WorkbenchAiDebugRuntime, input: AiRuntimeStructuredDebugEvent, artifactRefs: ForensicsArtifactRef[]) => {
  const trace = splitTraceId(input.traceId);
  const step = resolveAiDebugStep(input.taskType);
  return StructuredRuntimeEventSchema.parse({
    eventId: createId("event"),
    eventType: input.eventType === "AI_ERROR_DEBUG" ? "AI_FAILURE_DEBUG" : input.eventType,
    level: input.level,
    phase: "ai-runtime",
    component: "local-ai-runtime",
    owner: "AI Capability",
    abilityGroupId: "ai",
    childCapabilityId: resolveAiDebugChildCapabilityId(input.taskType),
    skillId: null,
    skillCategory: null,
    sessionId: input.sessionId,
    missionId: input.missionId ?? trace.missionId,
    roundId: input.roundId ?? input.attemptId,
    videoVisitId: input.videoVisitId,
    mapId: trace.mapId,
    taskTemplateId: null,
    traceId: input.traceId,
    spanId: input.spanId,
    attemptId: input.attemptId,
    step,
    previousStep: null,
    nextStep: null,
    status: input.status,
    reason: input.eventType === "AI_REQUEST_DEBUG"
      ? `AI request prepared for ${input.taskType}.`
      : input.eventType === "AI_RESPONSE_DEBUG"
        ? `AI response captured for ${input.taskType}.`
        : input.failureReason,
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
    browserProfileRef: runtime.browserSessionConfig.profileRef,
    loginState: runtime.browserController.getSessionState().loginState,
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
    createdAt: new Date().toISOString(),
    durationMs: input.durationMs,
    refs: input.refs,
    inputRefs: input.refs,
    outputRefs: input.rawResponseRef ? [input.rawResponseRef] : [],
    evidenceRefs: [],
    proofRefs: [],
    artifactRefs,
    actionLogRefs: [],
    dataQualityFlags: input.parserErrors,
  });
};

export const recordWorkbenchAiDebugEvent = async (
  runtime: WorkbenchAiDebugRuntime,
  input: AiRuntimeStructuredDebugEvent,
): Promise<void> => {
  const trace = splitTraceId(input.traceId);
  const mapChain = buildAiMapChain(trace.mapId);
  const artifactRefs = buildAiDebugArtifactRefs(input);
  const structuredRuntimeEvent = buildAiStructuredRuntimeEvent(runtime, input, artifactRefs);
  await runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "ai",
    sourceAbilityGroupId: "ai",
    sourceChildCapabilityId: structuredRuntimeEvent.childCapabilityId ?? "local-vision-ai",
    missionId: input.missionId ?? trace.missionId ?? input.sessionId,
    runId: input.traceId ?? input.attemptId,
    sessionId: input.sessionId,
    roundId: input.roundId ?? input.attemptId,
    videoVisitId: input.videoVisitId,
    stepId: input.roundId ?? resolveAiDebugStep(input.taskType),
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapId: trace.mapId,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationSnapshotRef: mapChain.activationSnapshotRef,
    capabilityCallId: input.spanId ?? input.attemptId,
    inputRefs: input.refs,
    outputRefs: input.rawResponseRef ? [input.rawResponseRef] : [],
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs,
    promptContractId: input.promptContractId,
    promptContractVersion: input.promptVersion,
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: input.parserErrors,
    payload: { structuredRuntimeEvent },
  });
};