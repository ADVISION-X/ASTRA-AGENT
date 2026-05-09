import type { StructuredRuntimeEvent } from "../../types/structured-log.js";

const SENSITIVE_INLINE_VALUE_PATTERN = /((?:apiKey|api_key|authorization|cookie|session|token|password|credential|secret|localStorage)\s*[:=]\s*)[^\s,;]+/gi;

const redactSensitiveText = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return value.replaceAll(SENSITIVE_INLINE_VALUE_PATTERN, "$1[redacted]");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

const compactPayload = <TValue extends Record<string, unknown>>(payload: TValue): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== "";
    }),
  );

const isProductPresenceSummaryEvent = (entry: StructuredRuntimeEvent): entry is StructuredRuntimeEvent & { parsedJson: Record<string, unknown> } =>
  entry.promptContractId === "vision.productPresence.v1"
  && (entry.eventType === "AI_NORMALIZED_RESPONSE_DEBUG" || entry.eventType === "AI_RESPONSE_DEBUG")
  && isRecord(entry.parsedJson);

const buildProductPresenceDecisionFields = (entry: StructuredRuntimeEvent & { parsedJson: Record<string, unknown> }): Record<string, unknown> => ({
  decision: typeof entry.parsedJson.decision === "string" ? entry.parsedJson.decision : entry.decision,
  routeLabel: typeof entry.parsedJson.routeLabel === "string" ? entry.parsedJson.routeLabel : null,
  isProductVideo:
    typeof entry.parsedJson.isProductVideo === "boolean" || entry.parsedJson.isProductVideo === null
      ? entry.parsedJson.isProductVideo
      : null,
  confidence: typeof entry.parsedJson.confidence === "number" ? entry.parsedJson.confidence : null,
  reason: redactSensitiveText(typeof entry.parsedJson.reason === "string" ? entry.parsedJson.reason : entry.reason),
});

const buildProductPresenceObservationFields = (entry: StructuredRuntimeEvent & { parsedJson: Record<string, unknown> }): Record<string, unknown> => ({
  visibleProductTypes: toStringArray(entry.parsedJson.visibleProductTypes),
  inputMode: typeof entry.parsedJson.inputMode === "string" ? entry.parsedJson.inputMode : null,
  validFrameCount: typeof entry.parsedJson.validFrameCount === "number" ? entry.parsedJson.validFrameCount : entry.validFrameCount,
  samplingStrategy: typeof entry.parsedJson.samplingStrategy === "string" ? entry.parsedJson.samplingStrategy : entry.samplingStrategy,
  normalizationAdjusted: (entry.schemaIssueCount ?? 0) > 0 || entry.parserErrors.length > 0,
  diagnosticPayloadRef: entry.diagnosticPayloadRef,
});

const buildProductPresenceSummary = (entry: StructuredRuntimeEvent & { parsedJson: Record<string, unknown> }): Record<string, unknown> => compactPayload({
  ...buildProductPresenceDecisionFields(entry),
  ...buildProductPresenceObservationFields(entry),
});

export const buildProductPresenceAiSummaryPayload = (entry: StructuredRuntimeEvent): Record<string, unknown> => {
  if (!isProductPresenceSummaryEvent(entry)) {
    return {};
  }

  const aiSummary = buildProductPresenceSummary(entry);
  return Object.keys(aiSummary).length > 0 ? { aiSummary } : {};
};