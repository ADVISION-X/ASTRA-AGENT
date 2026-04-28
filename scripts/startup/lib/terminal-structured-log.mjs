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
    return null;
  }

  try {
    return JSON.parse(payloadText);
  } catch {
    return null;
  }
}

export function createTerminalStructuredLogger() {
  const emit = (event) => {
    const line = renderEvent(event);
    const stream = event.level === "FAIL" ? process.stderr : process.stdout;
    stream.write(`${line}\n`);
  };

  const writeWithLevel = (level, event) => emit({ ...event, level });

  const relayRuntimePayload = (phase, payload) => {
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

  const relayServiceStdoutLine = (line, scriptName = "service") => {
    const normalizedLine = normalizeText(line);
    if (!normalizedLine) {
      return;
    }

    if (normalizedLine.startsWith("[grasseye:event]")) {
      const payload = parseStructuredChildLine("[grasseye:event]", normalizedLine);
      if (payload) {
        relayRuntimePayload("RUNTIME", payload);
        return;
      }
    }

    if (normalizedLine.startsWith("[grasseye:action]")) {
      const payload = parseStructuredChildLine("[grasseye:action]", normalizedLine);
      if (payload) {
        relayRuntimePayload("ACTION", payload);
        return;
      }
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

  const relayServiceStderrLine = (line, scriptName = "service") => {
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

  return {
    emit,
    event: (event) => writeWithLevel("EVENT", event),
    pass: (event) => writeWithLevel("PASS", event),
    fail: (event) => writeWithLevel("FAIL", event),
    relayServiceStdoutLine,
    relayServiceStderrLine,
  };
}
