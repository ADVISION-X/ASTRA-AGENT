import { createHash } from "node:crypto";

import { z } from "zod";

import { DeepResearchSubQuestionSchema } from "./deep-research-analysis.schema.js";
import { DeepResearchFinalReportSchema } from "./deep-research-analysis.result.js";

const DeepResearchConfidenceSchema = z.enum(["low", "medium", "high"]);

const DeepResearchDecompositionResponseSchema = z.object({
  mainQuestion: z.string().trim().min(1),
  subQuestions: z.array(DeepResearchSubQuestionSchema).min(1),
}).strict();

const DeepResearchPositiveAnswerSchema = z.object({
  subQuestionId: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  keyClaims: z.array(z.string().trim().min(1)).min(1),
  supportingReasons: z.array(z.string().trim().min(1)).min(1),
  assumptions: z.array(z.string().trim().min(1)),
  evidenceMentions: z.array(z.string().trim().min(1)),
  confidence: DeepResearchConfidenceSchema,
  limitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

const DeepResearchFalsificationAnswerSchema = z.object({
  subQuestionId: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  strongestOpposingArguments: z.array(z.string().trim().min(1)).min(1),
  contradictionPoints: z.array(z.string().trim().min(1)).min(1),
  evidenceMentions: z.array(z.string().trim().min(1)),
  confidence: DeepResearchConfidenceSchema,
  limitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

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

export type DeepResearchDecompositionResponse = z.infer<typeof DeepResearchDecompositionResponseSchema>;
export type DeepResearchPositiveAnswer = z.infer<typeof DeepResearchPositiveAnswerSchema>;
export type DeepResearchFalsificationAnswer = z.infer<typeof DeepResearchFalsificationAnswerSchema>;

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const buildFailure = (
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

const parseJsonObject = (rawText: string): DeepResearchParserResult<unknown> => {
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

const refineSchemaResult = <T>(input: {
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

export const parseDeepResearchDecompositionResponse = (input: {
  rawText: string;
  maxSubQuestions: number;
}): DeepResearchParserResult<DeepResearchDecompositionResponse> => {
  const parsed = refineSchemaResult({
    parsedJson: parseJsonObject(input.rawText),
    schema: DeepResearchDecompositionResponseSchema,
    missingRequiredReason: "invalid_decomposition_contract",
    partialReviewOnCustomIssue: true,
  });
  if (parsed.parseStatus !== "parsed") {
    return parsed;
  }
  if (parsed.parsed.subQuestions.length === 0) {
    return buildFailure(parsed.normalizedText, parsed.rawResponseHash, "empty_sub_questions");
  }
  if (parsed.parsed.subQuestions.length > input.maxSubQuestions) {
    return buildFailure(
      parsed.normalizedText,
      parsed.rawResponseHash,
      `sub_questions_exceed_limit:${parsed.parsed.subQuestions.length}`,
      "partial_review_required",
    );
  }
  return parsed;
};

export const parseDeepResearchPositiveResponse = (
  rawText: string,
): DeepResearchParserResult<DeepResearchPositiveAnswer> =>
  refineSchemaResult({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchPositiveAnswerSchema,
    missingRequiredReason: "invalid_positive_analysis_contract",
  });

export const parseDeepResearchFalsificationResponse = (
  rawText: string,
): DeepResearchParserResult<DeepResearchFalsificationAnswer> =>
  refineSchemaResult({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchFalsificationAnswerSchema,
    missingRequiredReason: "invalid_falsification_contract",
  });

export const parseDeepResearchFinalReportResponse = (
  rawText: string,
): DeepResearchParserResult<z.infer<typeof DeepResearchFinalReportSchema>> =>
  refineSchemaResult({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchFinalReportSchema,
    missingRequiredReason: "invalid_final_report_contract",
  });
