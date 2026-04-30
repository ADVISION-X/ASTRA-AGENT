import path from "node:path";
import { readFile } from "node:fs/promises";

import type { CommanderAuditSummary } from "../../capabilities/commander-console/index.js";
import type { AiRuntimeStructuredDebugEvent } from "../../capabilities/ai/runtime-adapters/local-ai-runtime-adapter.js";
import type { ForensicsArtifactRef } from "../../capabilities/forensics-persistence/index.js";
import { StructuredRuntimeEventSchema } from "../../types/structured-log.js";
import { loadLocalAiModelConfig, type LocalAiModelConfig, type LocalModelRole } from "../local-ai/model-config.js";
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
  if (input.promptDebugRef) {
    refs.push({ artifactType: "json", artifactId: input.promptDebugRef, storageRef: null, sourceRecordRef: null });
  }
  if (input.rawResponseRef) {
    refs.push({ artifactType: "json", artifactId: input.rawResponseRef, storageRef: null, sourceRecordRef: null });
  }
  if (input.aiInputArtifactRef) {
    refs.push({ artifactType: "other", artifactId: input.aiInputArtifactRef, storageRef: null, sourceRecordRef: null });
  }
  return refs;
};

const buildLocalAiRoleControls = (config: LocalAiModelConfig) => ({
  phase: config.phase,
  executionPosture: config.executionPosture,
  allowCloudFallback: config.allowCloudFallback,
  allowPaidApi: config.allowPaidApi,
  allowMockForAcceptance: config.allowMockForAcceptance,
  roles: Object.values(config.roles).map((roleConfig) => ({
    role: roleConfig.role,
    enabled: true,
    startupState: "required" as const,
    provider: roleConfig.provider,
    runtime: roleConfig.runtime,
    model: roleConfig.model,
    executionMode: roleConfig.executionMode,
    promptVersion: roleConfig.promptVersion,
    schemaVersion: roleConfig.schemaVersion,
    failureBehavior: roleConfig.failureBehavior,
    requiredForPhase: roleConfig.requiredForPhase,
  })),
});

export const getLocalAiRoleControls = async (): Promise<unknown> =>
  buildLocalAiRoleControls(await loadLocalAiModelConfig());

export const setLocalAiRoleStartupState = async (input: {
  role: LocalModelRole;
  enabled: boolean;
}): Promise<unknown> => {
  if (!input.enabled) {
    throw new Error(`Role ${input.role} cannot be disabled because phase-04 full-enforcement posture requires all configured local AI roles at startup.`);
  }
  return {
    ...buildLocalAiRoleControls(await loadLocalAiModelConfig()),
    mutation: {
      role: input.role,
      requestedEnabled: input.enabled,
      applied: false,
      status: "accepted-noop" as const,
      message: `Role ${input.role} is already required at startup under the phase-04 full-enforcement posture.`,
    },
  };
};

export const readAuditSummary = async (): Promise<CommanderAuditSummary> => {
  try {
    const [runnerSummaryText, phaseGateText] = await Promise.all([
      readFile(path.join(process.cwd(), "scripts", "audit", "generated", "runner-summary.json"), "utf8"),
      readFile(path.join(process.cwd(), "scripts", "audit", "phase-gates", "phase-04-full-enforcement.json"), "utf8"),
    ]);
    const runnerSummary = JSON.parse(runnerSummaryText) as { generatedAt?: string; totals?: CommanderAuditSummary["totals"] };
    const phaseGate = JSON.parse(phaseGateText) as { phase: string; activeCapabilityDomains: string[] };
    return {
      phase: phaseGate.phase,
      activeCapabilityDomains: phaseGate.activeCapabilityDomains,
      lastGeneratedAt: phaseGate.phase ? runnerSummary.generatedAt ?? null : null,
      lastRunGeneratedAt: runnerSummary.generatedAt ?? null,
      totals: runnerSummary.totals ?? null,
    };
  } catch {
    return { phase: "phase-04-full-enforcement", activeCapabilityDomains: [], lastGeneratedAt: null, lastRunGeneratedAt: null, totals: null };
  }
};

export const recordCommanderDebugEvent = async (
  runtime: WorkbenchBaseRuntime,
  input: {
    eventType: string;
    status: "started" | "success" | "failed" | "review_required";
    traceId: string;
    spanId: string;
    attemptId: string;
    missionId?: string | null;
    mapId?: string | null;
    taskTemplateId?: string | null;
    reason?: string | null;
    failureReason?: string | null;
    actionableMessage?: string | null;
    ownerResponsible?: string | null;
    decision?: string | null;
    durationMs?: number | null;
  },
): Promise<void> => {
  await runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "commander-console",
    sourceAbilityGroupId: "commander-console",
    sourceChildCapabilityId: "issue-human-command-debug",
    sessionId: input.traceId,
    roundId: input.attemptId,
    videoVisitId: null,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: {
      structuredRuntimeEvent: StructuredRuntimeEventSchema.parse({
        eventId: createId("event"),
        eventType: input.eventType,
        level: "DEBUG",
        phase: "mission-command",
        component: "commander-console",
        owner: "Commander Console",
        abilityGroupId: "commander-console",
        childCapabilityId: "issue-human-command",
        skillId: null,
        skillCategory: null,
        sessionId: input.traceId,
        missionId: input.missionId ?? null,
        roundId: input.attemptId,
        videoVisitId: null,
        mapId: input.mapId ?? null,
        taskTemplateId: input.taskTemplateId ?? null,
        traceId: input.traceId,
        spanId: input.spanId,
        attemptId: input.attemptId,
        browserProfileRef: runtime.browserSessionConfig.profileRef,
        loginState: runtime.browserController.getSessionState().loginState,
        step: "task_start",
        previousStep: null,
        nextStep: null,
        status: input.status,
        reason: input.reason ?? null,
        failureReason: input.failureReason ?? null,
        reviewRequiredReason: input.status === "review_required" ? input.failureReason ?? input.reason ?? null : null,
        actionableMessage: input.actionableMessage ?? null,
        ownerResponsible: input.ownerResponsible ?? null,
        decision: input.decision ?? null,
        roundOutcome: null,
        finalizationType: null,
        samplingStrategy: null,
        expectedFrameCount: null,
        validFrameCount: null,
        fallbackReason: null,
        missingFrames: [],
        snapshotSummary: null,
        createdAt: new Date().toISOString(),
        durationMs: input.durationMs ?? null,
        refs: [],
        inputRefs: [],
        outputRefs: [],
        evidenceRefs: [],
        proofRefs: [],
        artifactRefs: [],
        actionLogRefs: [],
        dataQualityFlags: [],
      }),
    },
  });
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