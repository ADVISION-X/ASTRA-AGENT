const FAIL_STATUSES = new Set(["failed", "review_required", "error"]);
const PASS_STATUSES = new Set(["success", "passed", "ready"]);

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

function renderEvent(event) {
  const phase = normalizeText(event.phase) ?? "STARTUP";
  const level = normalizeText(event.level) ?? "EVENT";
  const body = [
    normalizeText(event.component),
    normalizeText(event.eventType),
    normalizeText(event.status),
    normalizeText(event.message),
  ].filter(Boolean);
  const meta = [];

  if (event.failureReason) {
    meta.push(`failureReason=${formatMetaValue(event.failureReason)}`);
  }

  if (Array.isArray(event.refs) && event.refs.length > 0) {
    meta.push(`refs=${formatMetaValue(event.refs.join(","))}`);
  }

  if (typeof event.durationMs === "number") {
    meta.push(`durationMs=${event.durationMs}`);
  }

  return [`[GRASSEYE][${phase.toUpperCase()}][${level.toUpperCase()}]`, ...body, ...meta].join(" ");
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

function createRuntimePayloadRelay(emit) {
  return (phase, payload) => {
    const refs = [payload.sessionId, payload.roundId, payload.videoVisitId, payload.step].filter(Boolean);
    emit({
      timestamp: payload.createdAt ?? new Date().toISOString(),
      level: resolveLevel(payload.status ?? payload.result),
      phase,
      component: payload.skillCategory ?? payload.skillId ?? phase.toLowerCase(),
      eventType: payload.eventType ?? payload.actionType ?? `${phase.toLowerCase()}_event`,
      status: payload.status ?? payload.result ?? "emitted",
      message: payload.reason ?? payload.actionPurpose ?? payload.eventType ?? payload.actionType ?? "structured log emitted",
      failureReason: payload.failureReason ?? payload.reviewRequiredReason ?? null,
      refs,
      durationMs: typeof payload.durationMs === "number" ? payload.durationMs : null,
    });
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
