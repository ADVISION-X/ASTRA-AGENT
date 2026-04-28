import type { EvidenceRef } from "../../types/evidence.js";
import type { StructuredActionLog, StructuredRuntimeEvent } from "../../types/structured-log.js";

import type { StructuredLogLevel } from "./structured-log-bus.js";

const SENSITIVE_INLINE_VALUE_PATTERN = /((?:cookie|session|token|password|localStorage)\s*[:=]\s*)[^\s,;]+/gi;

const redactSensitiveText = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return value.replaceAll(SENSITIVE_INLINE_VALUE_PATTERN, "$1[redacted]");
};

const compactEvidenceRefs = (refs: EvidenceRef[] | undefined): string[] => (refs ?? []).map((ref) => ref.id);

const compactPayload = <TValue extends Record<string, unknown>>(payload: TValue): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== "";
    }),
  );

const buildSnapshotPayload = (entry: StructuredRuntimeEvent): Record<string, unknown> => entry.snapshotSummary
  ? {
      runtimeStatus: entry.snapshotSummary.runtimeStatus,
      currentStep: entry.snapshotSummary.currentStep,
      latestRoundOutcome: entry.snapshotSummary.latestRoundOutcome,
      latestProductPresenceDecision: entry.snapshotSummary.latestProductPresenceDecision,
      latestVideoEvidenceId: entry.snapshotSummary.latestVideoEvidenceId,
      latestBrowseLedgerEntryId: entry.snapshotSummary.latestBrowseLedgerEntryId,
      latestEvidencePacketId: entry.snapshotSummary.latestEvidencePacketId,
      counters: entry.snapshotSummary.counters,
    }
  : {};

export const buildEventPayload = (entry: StructuredRuntimeEvent, level: StructuredLogLevel): Record<string, unknown> => {
  const payload = compactPayload({
    timestamp: entry.createdAt,
    eventId: entry.eventId,
    skillId: entry.skillId,
    skillCategory: entry.skillCategory,
    sessionId: entry.sessionId,
    roundId: entry.roundId,
    videoVisitId: entry.videoVisitId,
    step: entry.step,
    eventType: entry.eventType,
    status: entry.status,
    reason: redactSensitiveText(entry.reason),
    failureReason: redactSensitiveText(entry.failureReason),
    reviewRequiredReason: redactSensitiveText(entry.reviewRequiredReason),
    decision: entry.decision,
    roundOutcome: entry.roundOutcome,
    finalizationType: entry.finalizationType,
    samplingStrategy: entry.samplingStrategy,
    expectedFrameCount: entry.expectedFrameCount,
    validFrameCount: entry.validFrameCount,
    fallbackReason: redactSensitiveText(entry.fallbackReason),
    missingFrames: entry.missingFrames,
    durationMs: entry.durationMs,
    evidenceRefs: compactEvidenceRefs(entry.evidenceRefs),
    actionLogRefs: entry.actionLogRefs,
    ...buildSnapshotPayload(entry),
  });

  if (level === "info") {
    return payload;
  }

  return compactPayload({
    ...payload,
    browserProfileRef: entry.browserProfileRef,
    loginState: entry.loginState,
    inputRefs: compactEvidenceRefs(entry.inputRefs),
    outputRefs: compactEvidenceRefs(entry.outputRefs),
    dataQualityFlags: entry.dataQualityFlags,
  });
};

export const buildActionPayload = (entry: StructuredActionLog, level: StructuredLogLevel): Record<string, unknown> => {
  const payload = compactPayload({
    timestamp: entry.createdAt,
    actionLogId: entry.actionLogId,
    skillId: entry.skillId,
    skillCategory: entry.skillCategory,
    sessionId: entry.sessionId,
    roundId: entry.roundId,
    videoVisitId: entry.videoVisitId,
    step: entry.step,
    actionType: entry.actionType,
    actionPurpose: entry.actionPurpose,
    result: entry.result,
    failureReason: redactSensitiveText(entry.failureReason),
    reviewRequiredReason: redactSensitiveText(entry.reviewRequiredReason),
    reason: redactSensitiveText(entry.targetDescriptor),
    durationMs: entry.durationMs,
    evidenceRefs: compactEvidenceRefs(entry.evidenceRefs),
  });

  if (level === "info") {
    return payload;
  }

  return compactPayload({
    ...payload,
    browserProfileRef: entry.browserProfileRef,
    loginState: entry.loginState,
    inputRefs: compactEvidenceRefs(entry.inputRefs),
    outputRefs: compactEvidenceRefs(entry.outputRefs),
    visualTargetId: entry.visualTargetId,
    targetType: entry.targetType,
    confidence: entry.confidence,
    geometryStatus: entry.geometryStatus,
    verificationResult: entry.verificationResult,
  });
};