const STANDARD_META_KEYS = [
  "ownerResponsible",
  "actionableMessage",
  "traceId",
  "runId",
  "packageFile",
  "requestedPlatformId",
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
  "confidence",
];
const FAILURE_DEBUG_META_KEYS = [
  "missingInputRefKeys",
  "lastSuccessfulResultRef",
  "screenshotEvidenceRef",
  "aiResultRef",
  "geometryGuardResultRef",
  "capabilityResultRef",
];

import { buildRuntimeRelayEvent } from "./terminal-structured-runtime-relay.mjs";

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
  appendNamedMeta(meta, event, AI_SUMMARY_META_KEYS);
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
