import type { EvidenceRef } from "../../types/evidence.js";
import type { StructuredActionLog, StructuredRuntimeEvent } from "../../types/structured-log.js";

import type { StructuredLogLevel } from "./structured-log-terminal.js";

const SENSITIVE_INLINE_VALUE_PATTERN = /((?:apiKey|api_key|authorization|cookie|session|token|password|credential|secret|localStorage)\s*[:=]\s*)[^\s,;]+/gi;

const redactSensitiveText = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return value.replaceAll(SENSITIVE_INLINE_VALUE_PATTERN, "$1[redacted]");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

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

const buildResourcePayload = (entry: StructuredRuntimeEvent): Record<string, unknown> => entry.resourceSummary
  ? {
      resourceSummary: {
        chromeRssMb: entry.resourceSummary.chromeRssMb,
        chromeProcessCount: entry.resourceSummary.chromeProcessCount,
        nodeRssMb: entry.resourceSummary.nodeRssMb,
        hostFreeMemoryMb: entry.resourceSummary.hostFreeMemoryMb,
        warningThresholdMb: entry.resourceSummary.warningThresholdMb,
        topChromePid: entry.resourceSummary.topChromePid,
        topChromeRssMb: entry.resourceSummary.topChromeRssMb,
        interestingProcesses: entry.resourceSummary.interestingProcesses,
      },
    }
  : {};

const buildEventIdentityPayload = (entry: StructuredRuntimeEvent): Record<string, unknown> => ({
  timestamp: entry.createdAt,
  level: entry.level,
  phase: entry.phase,
  component: entry.component,
  owner: entry.owner,
  eventId: entry.eventId,
  skillId: entry.skillId,
  skillCategory: entry.skillCategory,
	  sessionId: entry.sessionId,
	  runId: entry.runId,
	  missionId: entry.missionId,
  roundId: entry.roundId,
  videoVisitId: entry.videoVisitId,
  mapId: entry.mapId,
  stepId: entry.stepId,
  taskTemplateId: entry.taskTemplateId,
  activationSnapshotRef: entry.activationSnapshotRef,
  capabilityCallId: entry.capabilityCallId,
  childCapabilityId: entry.childCapabilityId,
  abilityGroupId: entry.abilityGroupId,
  capabilityGroupId: entry.capabilityGroupId,
  traceId: entry.traceId,
  spanId: entry.spanId,
  attemptId: entry.attemptId,
  step: entry.step,
  eventType: entry.eventType,
  status: entry.status,
});

const buildEventReasonPayload = (entry: StructuredRuntimeEvent): Record<string, unknown> => ({
  reason: redactSensitiveText(entry.reason),
  failureReason: redactSensitiveText(entry.failureReason),
  reviewRequiredReason: redactSensitiveText(entry.reviewRequiredReason),
  actionableMessage: redactSensitiveText(entry.actionableMessage),
  ownerResponsible: entry.ownerResponsible,
});

const buildEventAiPayload = (entry: StructuredRuntimeEvent): Record<string, unknown> => ({
  provider: entry.provider,
  model: entry.model,
  modelRole: entry.modelRole,
  runtime: entry.runtime,
  implementationStatus: entry.implementationStatus,
  errorKind: entry.errorKind,
  runtimeCallId: entry.runtimeCallId,
  diagnosticPayloadRef: entry.diagnosticPayloadRef,
  schemaIssueCount: entry.schemaIssueCount,
  promptContractId: entry.promptContractId,
  promptVersion: entry.promptVersion,
  promptCatalogVersion: entry.promptCatalogVersion,
  outputSchemaRef: entry.outputSchemaRef,
  providerConfigRef: entry.providerConfigRef,
  secretRef: entry.secretRef,
  promptDebugRef: entry.promptDebugRef,
  systemPromptHash: entry.systemPromptHash,
  userPromptHash: entry.userPromptHash,
  promptPreview: redactSensitiveText(entry.promptPreview),
  rawResponsePreview: redactSensitiveText(entry.rawResponsePreview),
  rawResponseHash: entry.rawResponseHash,
  rawResponseRef: entry.rawResponseRef,
  inputPackageId: entry.inputPackageId,
  inputPackageVersion: entry.inputPackageVersion,
  inputPackageHash: entry.inputPackageHash,
  capabilityCatalogVersion: entry.capabilityCatalogVersion,
  outputSchemaCatalogVersion: entry.outputSchemaCatalogVersion,
  mapPackageSchemaVersion: entry.mapPackageSchemaVersion,
  promptDebugBundleRef: entry.promptDebugBundleRef,
  providerRequestDebugRef: entry.providerRequestDebugRef,
  parsedDecision: entry.parsedDecision,
  parserErrors: entry.parserErrors,
  sourceScreenshotEvidenceId: entry.sourceScreenshotEvidenceId,
  aiInputArtifactRef: entry.aiInputArtifactRef,
  tokenEstimate: entry.tokenEstimate,
});

const buildProductPresenceAiSummaryPayload = (entry: StructuredRuntimeEvent): Record<string, unknown> => {
  if (
    entry.promptContractId !== "vision.productPresence.v1"
    || (entry.eventType !== "AI_NORMALIZED_RESPONSE_DEBUG" && entry.eventType !== "AI_RESPONSE_DEBUG")
    || !isRecord(entry.parsedJson)
  ) {
    return {};
  }

  const aiSummary = compactPayload({
    decision: typeof entry.parsedJson.decision === "string" ? entry.parsedJson.decision : entry.decision,
    routeLabel: typeof entry.parsedJson.routeLabel === "string" ? entry.parsedJson.routeLabel : null,
    isProductVideo:
      typeof entry.parsedJson.isProductVideo === "boolean" || entry.parsedJson.isProductVideo === null
        ? entry.parsedJson.isProductVideo
        : null,
    confidence: typeof entry.parsedJson.confidence === "number" ? entry.parsedJson.confidence : null,
    visibleProductTypes: toStringArray(entry.parsedJson.visibleProductTypes),
    reason: redactSensitiveText(typeof entry.parsedJson.reason === "string" ? entry.parsedJson.reason : entry.reason),
    inputMode: typeof entry.parsedJson.inputMode === "string" ? entry.parsedJson.inputMode : null,
    validFrameCount: typeof entry.parsedJson.validFrameCount === "number" ? entry.parsedJson.validFrameCount : entry.validFrameCount,
    samplingStrategy: typeof entry.parsedJson.samplingStrategy === "string" ? entry.parsedJson.samplingStrategy : entry.samplingStrategy,
    normalizationAdjusted: (entry.schemaIssueCount ?? 0) > 0 || entry.parserErrors.length > 0,
    diagnosticPayloadRef: entry.diagnosticPayloadRef,
  });

  return Object.keys(aiSummary).length > 0 ? { aiSummary } : {};
};

const buildEventProofPayload = (entry: StructuredRuntimeEvent): Record<string, unknown> => ({
  screenshotEvidenceId: entry.screenshotEvidenceId,
  artifactRef: entry.artifactRef,
  artifactStorageRef: entry.artifactStorageRef,
  outputHash: entry.outputHash,
  artifactHash: entry.artifactHash,
  byteSize: entry.byteSize,
  width: entry.width,
  height: entry.height,
  coordinateSpace: entry.coordinateSpace,
  runtimeProofRef: entry.runtimeProofRef,
  promptInputRef: entry.promptInputRef,
  aiInputStorageRef: entry.aiInputStorageRef,
  sourceStorageRef: entry.sourceStorageRef,
  preparedImageHash: entry.preparedImageHash,
  preparedImageWidth: entry.preparedImageWidth,
  preparedImageHeight: entry.preparedImageHeight,
});

const buildEventOutcomePayload = (entry: StructuredRuntimeEvent): Record<string, unknown> => ({
  decision: entry.decision,
  roundOutcome: entry.roundOutcome,
  finalizationType: entry.finalizationType,
  samplingStrategy: entry.samplingStrategy,
  expectedFrameCount: entry.expectedFrameCount,
  validFrameCount: entry.validFrameCount,
  fallbackReason: redactSensitiveText(entry.fallbackReason),
  missingFrames: entry.missingFrames,
  refs: entry.refs,
  durationMs: entry.durationMs,
  evidenceRefs: compactEvidenceRefs(entry.evidenceRefs),
  actionLogRefs: entry.actionLogRefs,
  dataQualityFlags: entry.dataQualityFlags,
  expectedInputRefKeys: entry.expectedInputRefKeys,
  resolvedInputRefKeys: entry.resolvedInputRefKeys,
  missingInputRefKeys: entry.missingInputRefKeys,
  outputRefAliases: entry.outputRefAliases,
  producedOutputRefs: entry.producedOutputRefs,
  jointStage: entry.jointStage,
  jointCheckpoint: entry.jointCheckpoint,
  failureSnapshot: entry.failureSnapshot,
  exitCode: entry.exitCode,
  signal: entry.signal,
  pid: entry.pid,
  startedAt: entry.startedAt,
  endedAt: entry.endedAt,
  lastRuntimeEventId: entry.lastRuntimeEventId,
  lastCommandEventId: entry.lastCommandEventId,
  lastAiEventId: entry.lastAiEventId,
  likelyCauseRef: entry.likelyCauseRef,
  crashBundleRef: entry.crashBundleRef,
});

const buildEventDebugPayload = (entry: StructuredRuntimeEvent): Record<string, unknown> => ({
  browserProfileRef: entry.browserProfileRef,
  loginState: entry.loginState,
  inputRefs: compactEvidenceRefs(entry.inputRefs),
  outputRefs: compactEvidenceRefs(entry.outputRefs),
  proofRefs: entry.proofRefs,
  artifactRefs: entry.artifactRefs,
  promptFullText: redactSensitiveText(entry.promptFullText),
  providerRequestBodyRedacted: entry.providerRequestBodyRedacted,
  rawResponseText: redactSensitiveText(entry.rawResponseText),
  parsedJson: entry.parsedJson,
  imageInputs: entry.imageInputs,
  dataQualityFlags: entry.dataQualityFlags,
});

export const buildEventPayload = (entry: StructuredRuntimeEvent, level: StructuredLogLevel): Record<string, unknown> => {
  const payload = compactPayload({
    ...buildEventIdentityPayload(entry),
    ...buildEventReasonPayload(entry),
    ...buildEventAiPayload(entry),
    ...buildProductPresenceAiSummaryPayload(entry),
    ...buildEventProofPayload(entry),
    ...buildEventOutcomePayload(entry),
    ...buildResourcePayload(entry),
    ...buildSnapshotPayload(entry),
  });

  if (level === "info") {
    return payload;
  }

  return compactPayload({
    ...payload,
    ...buildEventDebugPayload(entry),
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
