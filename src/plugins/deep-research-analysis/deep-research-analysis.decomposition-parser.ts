import {
  DeepResearchDecompositionResponseSchema,
  type DeepResearchDecompositionResponse,
} from "./deep-research-analysis.decomposition-schema.js";
import { buildDeepResearchTextHash } from "./deep-research-analysis.prompt-hash.js";

type ParseStatus = "parsed" | "partial_review_required" | "failed";

type DecompositionParseFailure = {
  parseStatus: Exclude<ParseStatus, "parsed">;
  parsed: null;
  normalizedText: string;
  rawResponseHash: string;
  reason: string;
};

type DecompositionParseSuccess = {
  parseStatus: "parsed";
  parsed: DeepResearchDecompositionResponse;
  normalizedText: string;
  rawResponseHash: string;
};

type DecompositionParseResult = DecompositionParseFailure | DecompositionParseSuccess;

const normalizeRawText = (rawText: string): string => rawText.trim();

const buildFailure = (
  normalizedText: string,
  reason: string,
  parseStatus: Exclude<ParseStatus, "parsed"> = "failed",
): DecompositionParseFailure => ({
  parseStatus,
  parsed: null,
  normalizedText,
  rawResponseHash: buildDeepResearchTextHash(normalizedText),
  reason,
});

const candidateJsonFromText = (normalizedText: string): string => {
  if (!normalizedText.startsWith("```")) {
    return normalizedText;
  }
  return normalizedText
    .replace(/^```(?:json)?\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();
};

const parseJson = (normalizedText: string): unknown | DecompositionParseFailure => {
  if (!normalizedText) {
    return buildFailure(normalizedText, "empty_ai_response");
  }
  try {
    return JSON.parse(candidateJsonFromText(normalizedText)) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_json";
    return buildFailure(normalizedText, `json_parse_failed:${message}`);
  }
};

const isDecompositionParseFailure = (value: unknown): value is DecompositionParseFailure => {
  if (typeof value !== "object" || value === null || !('parseStatus' in value)) {
    return false;
  }
  return value.parseStatus === "failed" || value.parseStatus === "partial_review_required";
};

const hasDuplicateQuestionText = (parsed: DeepResearchDecompositionResponse): boolean => {
  const seen = new Set<string>();
  for (const subQuestion of parsed.subQuestions) {
    const normalized = subQuestion.questionText.trim().toLowerCase();
    if (seen.has(normalized)) {
      return true;
    }
    seen.add(normalized);
  }
  return false;
};

const hasQualitySelfCheckFailure = (parsed: DeepResearchDecompositionResponse): boolean =>
  !parsed.qualitySelfCheck.coversFacts
  || !parsed.qualitySelfCheck.coversCausality
  || !parsed.qualitySelfCheck.coversImpact
  || !parsed.qualitySelfCheck.coversEvidence
  || !parsed.qualitySelfCheck.coversFalsification
  || !parsed.qualitySelfCheck.coversRisks
  || !parsed.qualitySelfCheck.hasNoDuplicateQuestions
  || !parsed.qualitySelfCheck.isReadyForPositiveAndFalsification;

export const parseDecompositionResponse = (input: {
  rawText: string;
  maxSubQuestions: number;
}): DecompositionParseResult => {
  const normalizedText = normalizeRawText(input.rawText);
  const raw = parseJson(normalizedText);
  if (isDecompositionParseFailure(raw)) {
    return raw;
  }
  const parsed = DeepResearchDecompositionResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return buildFailure(normalizedText, `invalid_decomposition_contract:${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  if (parsed.data.subQuestions.length === 0) {
    return buildFailure(normalizedText, "empty_sub_questions");
  }
  if (parsed.data.subQuestions.length > input.maxSubQuestions) {
    return buildFailure(normalizedText, "sub_questions_exceed_limit", "partial_review_required");
  }
  if (hasDuplicateQuestionText(parsed.data)) {
    return buildFailure(normalizedText, "duplicate_sub_questions", "partial_review_required");
  }
  if (hasQualitySelfCheckFailure(parsed.data)) {
    return buildFailure(normalizedText, "quality_self_check_failed", "partial_review_required");
  }
  return {
    parseStatus: "parsed",
    parsed: parsed.data,
    normalizedText,
    rawResponseHash: buildDeepResearchTextHash(normalizedText),
  };
};
