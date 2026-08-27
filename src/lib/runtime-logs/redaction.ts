import type { RuntimeLogEventV2 } from "./schema.js";

export const REDACTED = "[REDACTED]";
export const REDACTED_UNSAFE = "[REDACTED_UNSAFE]";

const SECRET_KEYS = /(?:authorization|bearer|cookie|password|token|secret|signature|api[_-]?key|storage|rawbody|rawpath|prompt|payload|filepath|selector|html)/iu;
const INLINE_SECRET = /(?:bearer\s+[a-z0-9._-]+|authorization\s*[:=]|password\s*[:=]|api[_-]?key\s*[:=]|token\s*[:=]|cookie\s*[:=])/iu;
const BASE64 = /^data:[^;]+;base64,/iu;
const ABSOLUTE_PATH = /(?:^|\s)\/(?!\/)[^\s]*|[A-Za-z]:\\|file:\/\//u;
const URL_PATTERN = /https?:\/\/[^\s]+/giu;

const ALLOWED_STRING_KEYS = new Set([
  "eventId", "occurredAt", "producer", "producerRunId", "previousEventHash", "eventHash", "type",
  "traceId", "owner", "component", "visibility", "phase", "spanId", "operation", "parentSpanId",
  "boundaryId", "outcome", "authorityRef", "authorityHash", "stateKey", "previous", "current", "kind",
  "producerId", "requestId", "jobId", "attemptId", "fenceHash", "pluginId", "stepId", "capabilityCallId",
  "commandId", "checkpointId", "outboxId", "code", "responsibleOwner", "impact", "recovery", "nativeCause",
  "causedByEventId",
]);

export const redactUrlForLog = (value: string): string => {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}/[REDACTED_PATH]`;
  } catch {
    return REDACTED_UNSAFE;
  }
};

const redactString = (key: string, value: string): string => {
  if (SECRET_KEYS.test(key) || INLINE_SECRET.test(value) || BASE64.test(value)) return REDACTED;
  if (!ALLOWED_STRING_KEYS.has(key)) return REDACTED_UNSAFE;
  if (ABSOLUTE_PATH.test(value)) return REDACTED_UNSAFE;
  if (/^https?:\/\//iu.test(value)) return redactUrlForLog(value);
  const withoutUrls = value.replace(URL_PATTERN, "[REDACTED_URL]");
  return withoutUrls.length > 1_000 ? `${withoutUrls.slice(0, 1_000)}…` : withoutUrls;
};

const redactUnknown = (key: string, value: unknown, depth: number): unknown => {
  if (depth > 5) return REDACTED_UNSAFE;
  if (typeof value === "string") return redactString(key, value);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => redactUnknown(key, item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([childKey, child]) => [childKey, redactUnknown(childKey, child, depth + 1)]));
  }
  return REDACTED_UNSAFE;
};

export const redactRuntimeLogRecord = (record: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  redactUnknown("record", record, 0) as Record<string, unknown>;

export const redactRuntimeLogEvent = (event: RuntimeLogEventV2): RuntimeLogEventV2 =>
  redactRuntimeLogRecord(event as unknown as Readonly<Record<string, unknown>>) as unknown as RuntimeLogEventV2;
