// Runtime Log Spine — Redaction
// All secrets, credentials, and base64 image content must be
// redacted before reaching any sink (terminal or file bundle).

const REDACTED = "[REDACTED]";
const SECRET_KEYS = /^(cookie|token|authorization|password|api[_-]?key|secret|session|auth|bearer)/i;
const BASE64_PATTERN = /^data:[^;]+;base64,/;

/** Redact a single value if it looks like a secret or base64 image. */
export function redactValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    if (SECRET_KEYS.test(key)) return REDACTED;
    if (BASE64_PATTERN.test(value)) return REDACTED;
    // Heuristic: long base64-looking strings (>= 500 chars, only base64 chars)
    if (value.length >= 500 && /^[A-Za-z0-9+/=]+$/.test(value)) return REDACTED;
  }
  return value;
}

/** Recursively redact a payload record. */
export function redactRuntimeLogPayload(
  payload: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 5) return payload; // safety limit
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactRuntimeLogPayload(value as Record<string, unknown>, depth + 1);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? redactRuntimeLogPayload(item as Record<string, unknown>, depth + 1)
          : item,
      );
    } else {
      result[key] = redactValue(key, value);
    }
  }
  return result;
}
