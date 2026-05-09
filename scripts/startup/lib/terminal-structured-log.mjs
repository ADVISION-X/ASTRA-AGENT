const FAIL_STATUSES = new Set(["failed", "review_required", "error"]);
const PASS_STATUSES = new Set(["success", "passed", "ready"]);
const STANDARD_META_KEYS = [
  "ownerResponsible",
  "actionableMessage",
  "traceId",
  "runId",
  "packageFile",
  "selectedMapId",
  "requestedPlatformId",
  "activationSnapshotRef",
  "capabilityCallId",
  "childCapabilityId",
  "implementationStatus",
  "errorKind",
  "runtimeCallId",
  "diagnosticPayloadRef",
  "promptContractId",
  "outputSchemaRef",
  "jointStage",
];
const AI_SUMMARY_META_KEYS = [
  "decision",
  "routeLabel",
  "isProductVideo",
  "confidence",
  "visibleProductTypes",
  "inputMode",
  "validFrameCount",
  "samplingStrategy",
  "normalizationAdjusted",
];
const FAILURE_DEBUG_META_KEYS = [
  "missingInputRefKeys",
  "lastSuccessfulResultRef",
  "screenshotEvidenceRef",
  "aiResultRef",
  "visualTargetResultRef",
  "geometryGuardResultRef",
  "clickResultRef",
  "postActionVerificationResultRef",
  "commentsEvidenceRef",
];

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function formatMetaValue(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  return /\s/.test(text) ? JSON.stringify(text) : text;
}

function pushMeta(meta, key, value) {
  if (Array.isArray(value)) {
    if (value.length > 0) {
      meta.push(`${key}=${formatMetaValue(value.join(","))}`);
    }
    return;
  }

  if (value !== null && value !== undefined && value !== "") {
    meta.push(`${key}=${formatMetaValue(value)}`);
  }
}

function appendNamedMeta(meta, event, keys) {
  for (const key of keys) {
    pushMeta(meta, key, event[key]);
  }
}

function buildEventBody(event) {
  return [
    normalizeText(event.component),
    normalizeText(event.eventType),
    normalizeText(event.status),
    normalizeText(event.message),
  ].filter(Boolean);
}

function buildEventMeta(event) {
  const meta = [];
  pushMeta(meta, "failureReason", event.failureReason);
  appendNamedMeta(meta, event, STANDARD_META_KEYS);
  if (isProductPresenceAiSummaryEvent(event)) {
    appendNamedMeta(meta, event, AI_SUMMARY_META_KEYS);
  }
  pushMeta(meta, "refs", Array.isArray(event.refs) ? event.refs : []);
  appendNamedMeta(meta, event, FAILURE_DEBUG_META_KEYS);
  if (typeof event.durationMs === "number") {
    meta.push(`durationMs=${event.durationMs}`);
  }
  return meta;
}

function renderEvent(event) {
  const phase = normalizeText(event.phase) ?? "STARTUP";
  const level = normalizeText(event.level) ?? "EVENT";
  return [`[GRASSEYE][${phase.toUpperCase()}][${level.toUpperCase()}]`, ...buildEventBody(event), ...buildEventMeta(event)].join(" ");
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

function parseStructuredChildLine(prefix, line) {
  const payloadText = normalizeText(line.slice(prefix.length));
  if (!payloadText) {
    return { payload: null, parseFailure: null };
  }

  try {
    return { payload: JSON.parse(payloadText), parseFailure: null };
  } catch (error) {
    return {
      payload: null,
      parseFailure: error instanceof Error ? error.message : String(error),
    };
  }
}

function createEmitter() {
  return (event) => {
    const line = renderEvent(event);
    const stream = event.level === "FAIL" ? process.stderr : process.stdout;
    stream.write(`${line}\n`);
  };
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
    postActionVerificationResultRef: failureSnapshot.postActionVerificationResultRef ?? null,
    commentsEvidenceRef: failureSnapshot.commentsEvidenceRef ?? null,
  };
}

function resolveAiSummary(payload) {
  return payload.aiSummary && typeof payload.aiSummary === "object" ? payload.aiSummary : {};
}

function buildAiSummaryProjection(payload) {
  if (
    payload.promptContractId !== "vision.productPresence.v1"
    || (payload.eventType !== "AI_NORMALIZED_RESPONSE_DEBUG" && payload.eventType !== "AI_RESPONSE_DEBUG")
  ) {
    return {};
  }

  const aiSummary = resolveAiSummary(payload);
  const visibleProductTypes = Array.isArray(aiSummary.visibleProductTypes)
    ? aiSummary.visibleProductTypes.filter(Boolean)
    : [];

  return {
    decision: aiSummary.decision ?? payload.decision ?? payload.parsedDecision ?? null,
    routeLabel: aiSummary.routeLabel ?? null,
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

function isProductPresenceAiSummaryEvent(event) {
  return event.promptContractId === "vision.productPresence.v1"
    && (event.eventType === "AI_NORMALIZED_RESPONSE_DEBUG" || event.eventType === "AI_RESPONSE_DEBUG");
}

function buildRuntimeRelayEvent(phase, payload) {
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
    selectedMapId: payload.mapId ?? payload.selectedMapId ?? null,
    requestedPlatformId: payload.requestedPlatformId ?? null,
    activationSnapshotRef: payload.activationSnapshotRef ?? null,
    capabilityCallId: payload.capabilityCallId ?? null,
    childCapabilityId: payload.childCapabilityId ?? null,
    implementationStatus: payload.implementationStatus ?? null,
    errorKind: payload.errorKind ?? null,
    runtimeCallId: payload.runtimeCallId ?? null,
    diagnosticPayloadRef: aiSummary.diagnosticPayloadRef ?? payload.diagnosticPayloadRef ?? null,
    promptContractId: payload.promptContractId ?? null,
    outputSchemaRef: payload.outputSchemaRef ?? null,
    decision: aiSummary.decision ?? null,
    routeLabel: aiSummary.routeLabel ?? null,
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

function createRuntimePayloadRelay(emit) {
  return (phase, payload) => {
    emit(buildRuntimeRelayEvent(phase, payload));
  };
}

function relayStructuredStdoutLine({ normalizedLine, phase, prefix, scriptName, relayRuntimePayload, emit }) {
  const { payload, parseFailure } = parseStructuredChildLine(prefix, normalizedLine);
  if (payload) {
    relayRuntimePayload(phase, payload);
    return true;
  }

  if (parseFailure) {
    emit({
      level: "FAIL",
      phase: "SERVICE",
      component: scriptName,
      eventType: "structured_stdout_parse_failed",
      status: "failed",
      message: normalizedLine,
      failureReason: parseFailure,
    });
    return true;
  }

  return false;
}

function createStdoutRelay(emit, relayRuntimePayload) {
  return (line, scriptName = "service") => {
    const normalizedLine = normalizeText(line);
    if (!normalizedLine) {
      return;
    }

    if (normalizedLine.startsWith("[grasseye:event]") && relayStructuredStdoutLine({ normalizedLine, phase: "RUNTIME", prefix: "[grasseye:event]", scriptName, relayRuntimePayload, emit })) {
      return;
    }

    if (normalizedLine.startsWith("[grasseye:action]") && relayStructuredStdoutLine({ normalizedLine, phase: "ACTION", prefix: "[grasseye:action]", scriptName, relayRuntimePayload, emit })) {
      return;
    }

    emit({
      level: "EVENT",
      phase: "SERVICE",
      component: scriptName,
      eventType: "stdout",
      status: "stream",
      message: normalizedLine,
    });
  };
}

function createStderrRelay(emit) {
  return (line, scriptName = "service") => {
    const normalizedLine = normalizeText(line);
    if (!normalizedLine) {
      return;
    }

    emit({
      level: "FAIL",
      phase: "SERVICE",
      component: scriptName,
      eventType: "stderr",
      status: "failed",
      message: normalizedLine,
      failureReason: normalizedLine,
    });
  };
}

export function createTerminalStructuredLogger() {
  const emit = createEmitter();
  const relayRuntimePayload = createRuntimePayloadRelay(emit);
  const relayServiceStdoutLine = createStdoutRelay(emit, relayRuntimePayload);
  const relayServiceStderrLine = createStderrRelay(emit);

  const writeWithLevel = (level, event) => emit({ ...event, level });

  return {
    emit,
    event: (event) => writeWithLevel("EVENT", event),
    pass: (event) => writeWithLevel("PASS", event),
    fail: (event) => writeWithLevel("FAIL", event),
    relayServiceStdoutLine,
    relayServiceStderrLine,
  };
}
