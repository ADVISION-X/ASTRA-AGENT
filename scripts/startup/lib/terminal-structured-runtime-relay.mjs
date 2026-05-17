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
    : [payload.sessionId, payload.roundId, payload.step].filter(Boolean);
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
    geometryGuardResultRef: failureSnapshot.geometryGuardResultRef ?? null,
    capabilityResultRef: failureSnapshot.capabilityResultRef ?? null,
  };
}

export function buildRuntimeRelayEvent(phase, payload) {
  const status = payload.status ?? payload.result ?? "emitted";
  return {
    timestamp: payload.createdAt ?? new Date().toISOString(),
    level: resolveLevel(payload.status ?? payload.result),
    phase,
    component: payload.skillCategory ?? payload.skillId ?? phase.toLowerCase(),
    eventType: payload.eventType ?? payload.actionType ?? `${phase.toLowerCase()}_event`,
    status,
    message: payload.reason ?? payload.actionPurpose ?? payload.eventType ?? payload.actionType ?? "structured log emitted",
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
    diagnosticPayloadRef: payload.diagnosticPayloadRef ?? null,
    promptContractId: payload.promptContractId ?? null,
    outputSchemaRef: payload.outputSchemaRef ?? null,
    decision: payload.decision ?? payload.parsedDecision ?? null,
    confidence: typeof payload.confidence === "number" ? payload.confidence : null,
    ...buildFailureDebugProjection(payload, status),
    refs: resolvePayloadRefs(payload),
    durationMs: typeof payload.durationMs === "number" ? payload.durationMs : null,
  };
}
