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

function resolveRelayMessage(phase, payload) {
  return payload.reason ?? payload.actionPurpose ?? payload.eventType ?? payload.actionType ?? `${phase.toLowerCase()} structured log emitted`;
}

function buildRuntimeRelayClassification(phase, payload, status) {
  return {
    timestamp: payload.createdAt ?? new Date().toISOString(),
    level: resolveLevel(payload.status ?? payload.result),
    phase,
    component: payload.skillCategory ?? payload.skillId ?? phase.toLowerCase(),
    eventType: payload.eventType ?? payload.actionType ?? `${phase.toLowerCase()}_event`,
    status,
    message: resolveRelayMessage(phase, payload),
  };
}

function buildRuntimeRelayOwnership(payload) {
  return {
    failureReason: payload.failureReason ?? payload.reviewRequiredReason ?? null,
    ownerResponsible: payload.ownerResponsible ?? null,
    actionableMessage: payload.actionableMessage ?? null,
  };
}

function buildRuntimeRelayTraceIds(payload) {
  return {
    traceId: payload.traceId ?? null,
    runId: payload.runId ?? payload.sessionId ?? null,
    requestedPlatformId: payload.requestedPlatformId ?? null,
    capabilityCallId: payload.capabilityCallId ?? null,
  };
}

function buildRuntimeRelayExecutionMetadata(payload) {
  return {
    childCapabilityId: payload.childCapabilityId ? payload.childCapabilityId : null,
    implementationStatus: payload.implementationStatus ?? null,
    errorKind: payload.errorKind ?? null,
    runtimeCallId: payload.runtimeCallId ?? null,
    diagnosticPayloadRef: payload.diagnosticPayloadRef ?? null,
  };
}

function buildRuntimeRelayTraceMetadata(payload) {
  return {
    ...buildRuntimeRelayTraceIds(payload),
    ...buildRuntimeRelayExecutionMetadata(payload),
  };
}

function buildRuntimeRelayDecisionMetadata(payload) {
  return {
    promptContractId: payload.promptContractId ?? null,
    outputSchemaRef: payload.outputSchemaRef ?? null,
    decision: payload.decision ?? payload.parsedDecision ?? null,
    confidence: typeof payload.confidence === "number" ? payload.confidence : null,
    refs: resolvePayloadRefs(payload),
    durationMs: typeof payload.durationMs === "number" ? payload.durationMs : null,
  };
}

export function buildRuntimeRelayEvent(phase, payload) {
  const status = payload.status ?? payload.result ?? "emitted";
  return {
    ...buildRuntimeRelayClassification(phase, payload, status),
    ...buildRuntimeRelayOwnership(payload),
    ...buildRuntimeRelayTraceMetadata(payload),
    ...buildRuntimeRelayDecisionMetadata(payload),
    ...buildFailureDebugProjection(payload, status),
  };
}
