import { createId } from "../../lib/local-runtime/ids.js";
import { ActionLogSchema, PlatformActionRequestSchema, type ActionLog, type PlatformActionRequest, type PlatformActionResult } from "../../types/platform-action.js";
import type { EvidenceRef } from "../../types/evidence.js";
import { StructuredActionLogSchema, type StructuredActionLog } from "../../types/structured-log.js";
import { resolveActionSkillId, resolveAgentSkillCategory } from "./runtime-skill-support.js";
import { deriveActionPurpose, derivePlatformActionStep } from "./runtime-action-purpose.js";

export function createActionRequest(input: {
  taskRunId: string;
  roundId: string;
  platformId: string;
  type: PlatformActionRequest["type"];
  target: string;
  reason: string;
}): PlatformActionRequest {
  return PlatformActionRequestSchema.parse({ actionId: createId("action"), taskRunId: input.taskRunId, roundId: input.roundId, platformId: input.platformId, type: input.type, target: input.target, requestedAt: new Date().toISOString(), reason: input.reason, evidenceRefs: [] });
}

export function buildActionLogRecord(input: {
  taskRunId: string;
  roundId: string;
  platformId: string;
  actionType: ActionLog["actionType"];
  status: ActionLog["status"];
  message: string;
  evidenceRefs: EvidenceRef[];
  aiTaskRefs: string[];
  platformActionResult: PlatformActionResult | undefined;
}): ActionLog {
  return ActionLogSchema.parse({
    id: createId("action_log"),
    taskRunId: input.taskRunId,
    roundId: input.roundId,
    platformId: input.platformId,
    actionType: input.actionType,
    actionPurpose: deriveActionPurpose(input.actionType),
    triggerSource: input.aiTaskRefs.length > 0 ? "local_ai_output" : "runtime_policy",
    beforeEvidenceId: input.evidenceRefs[0]?.id ?? null,
    afterEvidenceId: null,
    status: input.status,
    message: input.message,
    failureReason: input.status === "failed" ? input.message : null,
    visualTargetId: input.platformActionResult?.visualTarget?.targetId ?? null,
    targetType: input.platformActionResult?.visualTarget?.targetType ?? null,
    boundingBox: input.platformActionResult?.visualTarget?.boundingBox ?? null,
    confidence: input.platformActionResult?.visualTarget?.confidence ?? null,
    geometryStatus: input.platformActionResult?.geometryStatus ?? null,
    verificationResult: input.platformActionResult?.visualActionResult?.verificationResult ?? null,
    createdAt: new Date().toISOString(),
    evidenceRefs: input.evidenceRefs,
    aiTaskRefs: input.aiTaskRefs,
  });
}

export function buildStructuredActionLogRecord(input: {
  taskRunId: string;
  roundId: string;
  actionType: ActionLog["actionType"];
  actionLog: ActionLog;
  evidenceRefs: EvidenceRef[];
}): StructuredActionLog {
  const structuredActionStep = derivePlatformActionStep(input.actionType);
  const structuredSkillId = resolveActionSkillId({ step: structuredActionStep, actionType: input.actionType, actionPurpose: input.actionLog.actionPurpose });

  return StructuredActionLogSchema.parse({
    actionLogId: input.actionLog.id,
    skillId: structuredSkillId,
    skillCategory: resolveAgentSkillCategory(structuredSkillId),
    sessionId: input.taskRunId,
    roundId: input.roundId,
    videoVisitId: null,
    step: structuredActionStep,
    actionType: structuredActionStep,
    actionPurpose: input.actionLog.actionPurpose,
    triggerSource: input.actionLog.triggerSource,
    inputRefs: input.evidenceRefs,
    outputRefs: input.evidenceRefs,
    beforeEvidenceId: input.actionLog.beforeEvidenceId,
    afterEvidenceId: input.actionLog.afterEvidenceId,
    visualTargetId: input.actionLog.visualTargetId,
    targetType: input.actionLog.targetType,
    boundingBox: input.actionLog.boundingBox,
    confidence: input.actionLog.confidence,
    geometryStatus: input.actionLog.geometryStatus,
    verificationResult: input.actionLog.verificationResult,
    result: input.actionLog.status === "failed" ? "failed" : input.actionLog.status === "skipped" ? "skipped" : "success",
    failureReason: input.actionLog.failureReason,
    reviewRequiredReason: input.actionLog.status === "failed" ? input.actionLog.message : null,
    evidenceRefs: input.evidenceRefs,
    createdAt: input.actionLog.createdAt,
  });
}