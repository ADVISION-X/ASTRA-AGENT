import { z } from "zod";

import { createDecompositionOutputSchema } from "./deep-research-analysis.decomposition-schema.js";
import { buildDeepResearchTextHash } from "./deep-research-analysis.prompt-hash.js";
import type { DecompositionOutput } from "./deep-research-analysis.prompt-contracts.js";

type DecompositionParseFailure = {
  parseStatus: "partial_review_required" | "failed";
  parsed: null;
  normalizedText: string;
  rawResponseHash: string;
  reason: string;
};

type DecompositionParseSuccess = {
  parseStatus: "parsed";
  parsed: DecompositionOutput;
  normalizedText: string;
  rawResponseHash: string;
};

export type DecompositionParseResult =
  | DecompositionParseFailure
  | DecompositionParseSuccess;

const normalizeRawText = (rawText: string): string => rawText.trim();

const buildFailure = (
  normalizedText: string,
  rawResponseHash: string,
  reason: string,
  parseStatus: DecompositionParseFailure["parseStatus"] = "failed",
): DecompositionParseFailure => ({
  parseStatus,
  parsed: null,
  normalizedText,
  rawResponseHash,
  reason,
});

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

const parseJsonObject = (rawText: string): DecompositionParseResult => {
  const normalizedText = normalizeRawText(rawText);
  const rawResponseHash = buildDeepResearchTextHash(normalizedText);
  if (!normalizedText) {
    return buildFailure(normalizedText, rawResponseHash, "empty_ai_response");
  }
  try {
    const parsedJson: unknown = JSON.parse(extractCandidateJson(normalizedText));
    if (parsedJson === null || Array.isArray(parsedJson) || typeof parsedJson !== "object") {
      return buildFailure(normalizedText, rawResponseHash, "ai_response_must_be_json_object");
    }
    return {
      parseStatus: "parsed",
      parsed: parsedJson as DecompositionOutput,
      normalizedText,
      rawResponseHash,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid_json";
    return buildFailure(normalizedText, rawResponseHash, `json_parse_failed:${reason}`);
  }
};

const hasDuplicateQuestions = (output: DecompositionOutput): boolean => {
  const normalizedQuestions = output.subQuestions.map((item) =>
    item.questionText.trim().toLocaleLowerCase(),
  );
  return new Set(normalizedQuestions).size !== normalizedQuestions.length;
};

const hasQualitySelfCheckFalse = (raw: unknown): boolean => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return false;
  const maybeOutput = raw as { qualitySelfCheck?: Record<string, unknown> };
  const selfCheck = maybeOutput.qualitySelfCheck;
  return Boolean(selfCheck && Object.values(selfCheck).some((value) => value === false));
};

export const parseDecompositionResponse = (input: {
  rawText: string;
  maxSubQuestions: number;
}): DecompositionParseResult => {
  const parsedJson = parseJsonObject(input.rawText);
  if (parsedJson.parseStatus !== "parsed") {
    return parsedJson;
  }

  const schemaResult = createDecompositionOutputSchema(input.maxSubQuestions)
    .safeParse(parsedJson.parsed);
  if (!schemaResult.success) {
    const parseStatus = hasQualitySelfCheckFalse(parsedJson.parsed)
      ? "partial_review_required"
      : "failed";
    const issueText = schemaResult.error.issues.map((issue) => issue.message).join("; ");
    return buildFailure(
      parsedJson.normalizedText,
      parsedJson.rawResponseHash,
      `invalid_decomposition_contract:${issueText}`,
      parseStatus,
    );
  }

  if (schemaResult.data.subQuestions.length === 0) {
    return buildFailure(parsedJson.normalizedText, parsedJson.rawResponseHash, "empty_sub_questions");
  }
  if (hasDuplicateQuestions(schemaResult.data)) {
    return buildFailure(
      parsedJson.normalizedText,
      parsedJson.rawResponseHash,
      "duplicate_sub_questions",
      "partial_review_required",
    );
  }
  return {
    parseStatus: "parsed",
    parsed: schemaResult.data,
    normalizedText: parsedJson.normalizedText,
    rawResponseHash: parsedJson.rawResponseHash,
  };
};

export const parseDecompositionSchemaOnly = (
  value: unknown,
  maxSubQuestions: number,
): z.SafeParseReturnType<unknown, DecompositionOutput> =>
  createDecompositionOutputSchema(maxSubQuestions).safeParse(value);
