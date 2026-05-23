import { createHash } from "node:crypto";

import { z } from "zod";

import { DeepResearchFinalReportSchema } from "./deep-research-analysis.result.js";

type DeepResearchParserFailure = {
  parseStatus: "partial_review_required" | "failed";
  parsed: null;
  normalizedText: string;
  rawResponseHash: string;
  reason: string;
};

type DeepResearchParserSuccess<T> = {
  parseStatus: "parsed";
  parsed: T;
  normalizedText: string;
  rawResponseHash: string;
};

export type DeepResearchParserResult<T> =
  | DeepResearchParserFailure
  | DeepResearchParserSuccess<T>;

type DeepResearchFinalReport = z.infer<typeof DeepResearchFinalReportSchema>;
type ConflictMatrixRow = DeepResearchFinalReport["conflictMatrix"][number];

export type FinalReportNormalizationFallback = {
  conflictMatrix?: readonly ConflictMatrixRow[];
  positiveReasons?: readonly string[];
  strongestOpposingArguments?: readonly string[];
  evidenceGaps?: readonly string[];
  reverseConditions?: readonly string[];
  followUpSignals?: readonly string[];
  limitations?: readonly string[];
};

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

export const buildFailure = (
  normalizedText: string,
  rawResponseHash: string,
  reason: string,
  parseStatus: DeepResearchParserFailure["parseStatus"] = "failed",
): DeepResearchParserFailure => ({
  parseStatus,
  parsed: null,
  normalizedText,
  rawResponseHash,
  reason,
});

const normalizeRawText = (rawText: string): string => rawText.trim();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const coerceTrimmedString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const coerceBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "n", "0"].includes(normalized)) {
    return false;
  }
  return null;
};

const coerceStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => coerceTrimmedString(item))
      .filter((item): item is string => item !== null);
  }
  const single = coerceTrimmedString(value);
  return single ? [single] : [];
};

export const takeFirstString = (
  source: Record<string, unknown>,
  keys: readonly string[],
): string | null => {
  for (const key of keys) {
    const value = coerceTrimmedString(source[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

export const takeFirstStringArray = (
  source: Record<string, unknown>,
  keys: readonly string[],
): string[] => {
  for (const key of keys) {
    const values = coerceStringArray(source[key]);
    if (values.length > 0) {
      return values;
    }
  }
  return [];
};

export const buildSentenceFallback = (value: string): string[] => {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return [];
  }
  const segments = normalized
    .split(/(?<=[.!?。！？])\s+/u)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  return (segments.length > 0 ? segments : [normalized]).slice(0, 3);
};

const normalizeNumericConfidence = (value: number): "low" | "medium" | "high" | null => {
  if (!Number.isFinite(value)) {
    return null;
  }
  const percent = value <= 1 ? value * 100 : value;
  if (percent >= 75) {
    return "high";
  }
  if (percent >= 40) {
    return "medium";
  }
  if (percent >= 0) {
    return "low";
  }
  return null;
};

const normalizeConfidenceFromString = (value: string): "low" | "medium" | "high" | null => {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (/^\d+(?:\.\d+)?%?$/u.test(normalized)) {
    return normalizeNumericConfidence(Number.parseFloat(normalized.replace(/%/gu, "")));
  }
  const lower = normalized.toLowerCase();
  if (
    lower.includes("very high")
    || lower.includes("high confidence")
    || lower.includes("strong")
    || lower.includes("medium-high")
    || /高|较高|偏高|强/u.test(normalized)
  ) {
    return "high";
  }
  if (
    lower.includes("medium")
    || lower.includes("moderate")
    || lower.includes("mixed")
    || /中|中等|一般|适中/u.test(normalized)
  ) {
    return "medium";
  }
  if (
    lower.includes("low")
    || lower.includes("weak")
    || lower.includes("uncertain")
    || /低|较低|偏低|弱/u.test(normalized)
  ) {
    return "low";
  }
  return null;
};

export const normalizeConfidenceValue = (
  value: unknown,
): "low" | "medium" | "high" | null => {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  if (typeof value === "number") {
    return normalizeNumericConfidence(value);
  }
  if (typeof value === "string") {
    return normalizeConfidenceFromString(value);
  }
  return null;
};

const normalizeConflictLevelFromString = (value: string): ConflictMatrixRow["conflictLevel"] | null => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("critical") || /严重|关键/u.test(value)) {
    return "critical";
  }
  if (normalized.includes("high") || normalized.includes("medium-high") || /高|较高|偏高/u.test(value)) {
    return "high";
  }
  if (normalized.includes("medium") || normalized.includes("moderate") || /中|中等/u.test(value)) {
    return "medium";
  }
  if (normalized.includes("low") || /低|较低/u.test(value)) {
    return "low";
  }
  return null;
};

const normalizeConflictLevel = (value: unknown): ConflictMatrixRow["conflictLevel"] | null => {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }
  if (typeof value === "string") {
    return normalizeConflictLevelFromString(value);
  }
  return null;
};

export const takeFallbackArray = (
  values: readonly string[],
  fallback: readonly string[] | undefined,
): string[] => values.length > 0 ? [...values] : [...(fallback ?? [])];

export const normalizeConflictMatrixRows = (value: unknown): DeepResearchFinalReport["conflictMatrix"] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const subQuestionId = takeFirstString(item, ["subQuestionId", "questionId", "id"]);
    const positiveClaimSummary = takeFirstString(item, ["positiveClaimSummary", "positiveSummary", "positive"]);
    const falsificationSummary = takeFirstString(item, ["falsificationSummary", "negativeSummary", "opposingSummary", "falsification"]);
    const conflictLevel = normalizeConflictLevel(item.conflictLevel ?? item.level ?? item.severity);
    const evidenceGap = takeFirstString(item, ["evidenceGap", "gap", "evidenceGaps"]);
    const needsHumanReview = coerceBoolean(item.needsHumanReview);
    if (!subQuestionId || !positiveClaimSummary || !falsificationSummary || !conflictLevel || !evidenceGap || needsHumanReview === null) {
      return [];
    }
    return [{
      subQuestionId,
      positiveClaimSummary,
      falsificationSummary,
      conflictLevel,
      evidenceGap,
      needsHumanReview,
    }];
  });
};

export const buildDefaultLimitations = (): string[] => [
  "Model did not provide explicit limitations.",
];

const extractCandidateJson = (rawText: string): string => {
  const trimmed = normalizeRawText(rawText);
  if (trimmed.startsWith("```")) {
    const withoutFenceStart = trimmed.replace(/^```(?:json)?\s*/u, "");
    return withoutFenceStart.replace(/\s*```$/u, "").trim();
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }
  return trimmed;
};

export const parseJsonObject = (rawText: string): DeepResearchParserResult<unknown> => {
  const normalizedText = normalizeRawText(rawText);
  const rawResponseHash = buildTextHash(normalizedText);
  if (!normalizedText) {
    return buildFailure(normalizedText, rawResponseHash, "empty_ai_response");
  }
  const candidateJson = extractCandidateJson(normalizedText);
  try {
    const parsed = JSON.parse(candidateJson) as unknown;
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      return buildFailure(normalizedText, rawResponseHash, "ai_response_must_be_json_object");
    }
    return {
      parseStatus: "parsed",
      parsed,
      normalizedText,
      rawResponseHash,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid_json";
    return buildFailure(normalizedText, rawResponseHash, `json_parse_failed:${reason}`);
  }
};

export const refineSchemaResult = <T>(input: {
  parsedJson: DeepResearchParserResult<unknown>;
  schema: z.ZodType<T>;
  missingRequiredReason: string;
  partialReviewOnCustomIssue?: boolean;
}): DeepResearchParserResult<T> => {
  if (input.parsedJson.parseStatus !== "parsed") {
    return input.parsedJson;
  }
  const parsed = input.schema.safeParse(input.parsedJson.parsed);
  if (!parsed.success) {
    const hasCustomIssue = parsed.error.issues.some((issue) => issue.code === z.ZodIssueCode.custom);
    return buildFailure(
      input.parsedJson.normalizedText,
      input.parsedJson.rawResponseHash,
      `${input.missingRequiredReason}:${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
      hasCustomIssue && input.partialReviewOnCustomIssue ? "partial_review_required" : "failed",
    );
  }
  return {
    parseStatus: "parsed",
    parsed: parsed.data,
    normalizedText: input.parsedJson.normalizedText,
    rawResponseHash: input.parsedJson.rawResponseHash,
  };
};

type NormalizerResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: string };

export const normalizeWithSchema = <T>(input: {
  parsedJson: DeepResearchParserResult<unknown>;
  schema: z.ZodType<T>;
  normalize: (value: Record<string, unknown>) => NormalizerResult;
  missingRequiredReason: string;
  partialReviewOnCustomIssue?: boolean;
}): DeepResearchParserResult<T> => {
  if (input.parsedJson.parseStatus !== "parsed") {
    return input.parsedJson;
  }
  if (!isRecord(input.parsedJson.parsed)) {
    return buildFailure(
      input.parsedJson.normalizedText,
      input.parsedJson.rawResponseHash,
      `${input.missingRequiredReason}:ai_response_must_be_json_object`,
    );
  }
  const normalized = input.normalize(input.parsedJson.parsed);
  if (!normalized.ok) {
    return buildFailure(
      input.parsedJson.normalizedText,
      input.parsedJson.rawResponseHash,
      `${input.missingRequiredReason}:${normalized.reason}`,
    );
  }
  return refineSchemaResult({
    parsedJson: {
      parseStatus: "parsed",
      parsed: normalized.value,
      normalizedText: input.parsedJson.normalizedText,
      rawResponseHash: input.parsedJson.rawResponseHash,
    },
    schema: input.schema,
    missingRequiredReason: input.missingRequiredReason,
    ...(input.partialReviewOnCustomIssue !== undefined
      ? { partialReviewOnCustomIssue: input.partialReviewOnCustomIssue }
      : {}),
  });
};