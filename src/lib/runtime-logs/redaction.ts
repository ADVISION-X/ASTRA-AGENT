// Runtime Log Spine — Redaction
// All secrets, credentials, and base64 image content must be
// redacted before reaching any sink (terminal or file bundle).

import type { RuntimeLogEvent } from "./schema.js";

const REDACTED = "[REDACTED]";
const SECRET_KEYS = /^(cookie|cookies|token|authorization|password|api[_-]?key|secret|session|auth|bearer|localStorage|sessionStorage)$/i;
const BASE64_PATTERN = /^data:[^;]+;base64,/;
const SIGNED_URL_QUERY_KEY = /(token|sig|signature|expires|auth|key|policy|session|credential|x-amz-|googleaccessid)/i;
const INLINE_SECRET_VALUE = /(bearer\s+[a-z0-9._-]+|authorization\s*[:=]|password\s*[:=]|api[_-]?key\s*[:=]|token\s*[:=])/iu;

export const redactUrlForLog = (value: string): string => {
  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value.split("?")[0] ?? value;
  }
};

const isSensitiveUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return [...parsed.searchParams.keys()].some((key) => SIGNED_URL_QUERY_KEY.test(key));
  } catch {
    return false;
  }
};

/** Redact a single value if it looks like a secret or base64 image. */
function redactValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    if (SECRET_KEYS.test(key)) return REDACTED;
    if (BASE64_PATTERN.test(value)) return REDACTED;
    if (INLINE_SECRET_VALUE.test(value)) return REDACTED;
    if (isSensitiveUrl(value)) return redactUrlForLog(value);
    // Heuristic: long base64-looking strings (>= 500 chars, only base64 chars)
    if (value.length >= 500 && /^[A-Za-z0-9+/=]+$/.test(value)) return REDACTED;
    if (/^https?:\/\//iu.test(value)) return redactUrlForLog(value);
  }
  return value;
}

/** Recursively redact a payload record. */
export function redactRuntimeLogRecord(
  payload: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 5) return payload; // safety limit
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactRuntimeLogRecord(value as Record<string, unknown>, depth + 1);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? redactRuntimeLogRecord(item as Record<string, unknown>, depth + 1)
          : item,
      );
    } else {
      result[key] = redactValue(key, value);
    }
  }
  return result;
}

export const redactRuntimeLogPayload = redactRuntimeLogRecord;

export const redactRuntimeLogEvent = (event: RuntimeLogEvent): RuntimeLogEvent => ({
  ...event,
  ...(event.reason ? { reason: String(redactValue("reason", event.reason)) } : {}),
  ...(event.preview ? { preview: redactRuntimeLogRecord(event.preview) } : {}),
  ...(event.refs ? { refs: redactRuntimeLogRecord(event.refs) as Record<string, string> } : {}),
  ...(event.hashes ? { hashes: redactRuntimeLogRecord(event.hashes) as Record<string, string> } : {}),
  ...(event.payload ? { payload: redactRuntimeLogRecord(event.payload) } : {}),
});
