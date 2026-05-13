const FAIL_STATUSES = new Set(["failed", "review_required", "error"]);
const PASS_STATUSES = new Set(["success", "passed", "ready"]);

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function resolveLevel(status) {
  const normalizedStatus = normalizeText(status)?.toLowerCase();
  if (!normalizedStatus) {
    return "EVENT";
  }

  if (FAIL_STATUSES.has(normalizedStatus)) {
    return "FAIL";
  }

  if (PASS_STATUSES.has(normalizedStatus)) {
    return "PASS";
  }

  return "EVENT";
}

function isFailureDebugStatus(status) {
  return status === "failed" || status === "review_required";
}

function resolveFailureSnapshot(payload) {
  return payload.failureSnapshot && typeof payload.failureSnapshot === "object" ? payload.failureSnapshot : {};
}

function resolvePayloadRefs(payload) {
  const payloadRefs = Array.isArray(payload.refs) ? payload.refs.filter(Boolean) : [];
  return payloadRefs.length > 0
    ? payloadRefs
    : [payload.sessionId, payload.roundId, payload.videoVisitId, payload.step].filter(Boolean);
}

function buildFailureDebugProjection(payload, status) {
  if (!isFailureDebugStatus(status)) {
    return {};
  }

  const failureSnapshot = resolveFailureSnapshot(payload);
  return {
    jointStage: payload.jointStage ?? null,
    missingInputRefKeys: Array.isArray(payload.missingInputRefKeys) ? payload.missingInputRefKeys : [],
    lastSuccessfulResultRef: failureSnapshot.lastSuccessfulResultRef ?? null,
    screenshotEvidenceRef: failureSnapshot.screenshotEvidenceRef ?? null,
    aiResultRef: failureSnapshot.aiResultRef ?? null,
    visualTargetResultRef: failureSnapshot.visualTargetResultRef ?? null,
    geometryGuardResultRef: failureSnapshot.geometryGuardResultRef ?? null,
    clickResultRef: failureSnapshot.clickResultRef ?? null,
    actionResultCheckResultRef: failureSnapshot.actionResultCheckResultRef ?? null,
    commentsEvidenceRef: failureSnapshot.commentsEvidenceRef ?? null,
  };
}

function resolveAiSummary(payload) {
  return payload.aiSummary && typeof payload.aiSummary === "object" ? payload.aiSummary : {};
}

export function isProductPresenceAiSummaryEvent(event) {
  return event.promptContractId === "vision.productPresence.v1"
    && (event.eventType === "AI_NORMALIZED_RESPONSE_DEBUG" || event.eventType === "AI_RESPONSE_DEBUG");
}

function buildAiSummaryProjection(payload) {
  if (!isProductPresenceAiSummaryEvent(payload)) {
    return {};
  }

  const aiSummary = resolveAiSummary(payload);
  const visibleProductTypes = Array.isArray(aiSummary.visibleProductTypes)
    ? aiSummary.visibleProductTypes.filter(Boolean)
    : [];

  return {
    decision: aiSummary.decision ?? payload.decision ?? payload.parsedDecision ?? null,
    isProductVideo: typeof aiSummary.isProductVideo === "boolean" ? aiSummary.isProductVideo : null,
    confidence: typeof aiSummary.confidence === "number" ? aiSummary.confidence : null,
    visibleProductTypes: visibleProductTypes.length > 0 ? visibleProductTypes : ["none"],
    reason: aiSummary.reason ?? payload.reason ?? null,
    inputMode: aiSummary.inputMode ?? null,
    validFrameCount: typeof aiSummary.validFrameCount === "number" ? aiSummary.validFrameCount : payload.validFrameCount ?? null,
    samplingStrategy: aiSummary.samplingStrategy ?? payload.samplingStrategy ?? null,
    normalizationAdjusted: typeof aiSummary.normalizationAdjusted === "boolean" ? aiSummary.normalizationAdjusted : null,
    diagnosticPayloadRef: aiSummary.diagnosticPayloadRef ?? payload.diagnosticPayloadRef ?? null,
  };
}

export function buildRuntimeRelayEvent(phase, payload) {
  const status = payload.status ?? payload.result ?? "emitted";
  const aiSummary = buildAiSummaryProjection(payload);
  return {
    timestamp: payload.createdAt ?? new Date().toISOString(),
    level: resolveLevel(payload.status ?? payload.result),
    phase,
    component: payload.skillCategory ?? payload.skillId ?? phase.toLowerCase(),
    eventType: payload.eventType ?? payload.actionType ?? `${phase.toLowerCase()}_event`,
    status,
    message: aiSummary.reason ?? payload.reason ?? payload.actionPurpose ?? payload.eventType ?? payload.actionType ?? "structured log emitted",
    failureReason: payload.failureReason ?? payload.reviewRequiredReason ?? null,
    ownerResponsible: payload.ownerResponsible ?? null,
    actionableMessage: payload.actionableMessage ?? null,
    traceId: payload.traceId ?? null,
    runId: payload.runId ?? payload.sessionId ?? null,
    requestedPlatformId: payload.requestedPlatformId ?? null,
    capabilityCallId: payload.capabilityCallId ?? null,
    childCapabilityId: payload.childCapabilityId ? payload.childCapabilityId : null,
    implementationStatus: payload.implementationStatus ?? null,
    errorKind: payload.errorKind ?? null,
    runtimeCallId: payload.runtimeCallId ?? null,
    diagnosticPayloadRef: aiSummary.diagnosticPayloadRef ?? payload.diagnosticPayloadRef ?? null,
    promptContractId: payload.promptContractId ?? null,
    outputSchemaRef: payload.outputSchemaRef ?? null,
    decision: aiSummary.decision ?? null,
    isProductVideo: aiSummary.isProductVideo ?? null,
    confidence: aiSummary.confidence ?? null,
    visibleProductTypes: aiSummary.visibleProductTypes ?? null,
    inputMode: aiSummary.inputMode ?? null,
    validFrameCount: aiSummary.validFrameCount ?? null,
    samplingStrategy: aiSummary.samplingStrategy ?? null,
    normalizationAdjusted: aiSummary.normalizationAdjusted ?? null,
    ...buildFailureDebugProjection(payload, status),
    refs: resolvePayloadRefs(payload),
    durationMs: typeof payload.durationMs === "number" ? payload.durationMs : null,
  };
}
