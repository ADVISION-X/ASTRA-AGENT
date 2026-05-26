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

const extractJsonCandidate = (normalizedText: string): string => {
  const unfenced = normalizedText.startsWith("```")
    ? normalizedText.replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "").trim()
    : normalizedText;
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return unfenced.slice(firstBrace, lastBrace + 1);
  }
  return unfenced;
};

const parseJson = (normalizedText: string): unknown | DecompositionParseFailure => {
  if (!normalizedText) {
    return buildFailure(normalizedText, "empty_ai_response");
  }
  try {
    return JSON.parse(extractJsonCandidate(normalizedText)) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_json";
    return buildFailure(normalizedText, `json_parse_failed:${message}`);
  }
};

const isDecompositionParseFailure = (value: unknown): value is DecompositionParseFailure => {
  if (typeof value !== "object" || value === null || !("parseStatus" in value)) {
    return false;
  }
  return value.parseStatus === "failed" || value.parseStatus === "partial_review_required";
};

const hasForbiddenContractMetadata = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.includes("contractId") || keys.includes("format");
};

const formatSchemaFailureReason = (issues: {
  code: string;
  message: string;
}[]): string => {
  if (issues.some((issue) => issue.code === "unrecognized_keys")) {
    return "invalid_decomposition_contract:unrecognized_keys:schema_extra_fields_not_allowed";
  }
  return `invalid_decomposition_contract:${issues.map((issue) => issue.message).join("; ")}`;
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
  !parsed.planIntegrityCheck.everySubQuestionHasPromptBundle
  || !parsed.planIntegrityCheck.promptBundlesAreQuestionSpecific
  || !parsed.planIntegrityCheck.noGenericUniversalPromptBundle
  || !parsed.planIntegrityCheck.finalPromptBundleIsQuestionSpecific
  || !parsed.planIntegrityCheck.htmlPromptBundleIsQuestionSpecific
  || !parsed.planIntegrityCheck.runtimeWillOnlyAddShellConstraints;

const readPreferredFormatFailure = (
  parsed: DeepResearchDecompositionResponse,
): string | null => {
  for (const subQuestion of parsed.subQuestions) {
    if (subQuestion.promptBundle.outputGuidance.preferredFormat !== "structured_text") {
      return `invalid_decomposition_contract:sub_question_prompt_bundle_preferred_format_must_be_structured_text:${subQuestion.id}`;
    }
  }
  if (parsed.finalAdjudicationPromptBundle.outputGuidance.preferredFormat !== "structured_text") {
    return "invalid_decomposition_contract:final_adjudication_prompt_bundle_preferred_format_must_be_structured_text";
  }
  if (parsed.htmlReportPromptBundle.outputGuidance.preferredFormat !== "html_document") {
    return "invalid_decomposition_contract:html_report_prompt_bundle_preferred_format_must_be_html_document";
  }
  return null;
};

const parseDecompositionContract = (
  raw: unknown,
  normalizedText: string,
): DeepResearchDecompositionResponse | DecompositionParseFailure => {
  if (hasForbiddenContractMetadata(raw)) {
    return buildFailure(
      normalizedText,
      "invalid_decomposition_contract:unrecognized_keys:schema_extra_fields_not_allowed",
    );
  }
  const parsed = DeepResearchDecompositionResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return buildFailure(normalizedText, formatSchemaFailureReason(parsed.error.issues));
  }
  return parsed.data;
};

const readResponseValidationFailure = (input: {
  parsed: DeepResearchDecompositionResponse;
  maxSubQuestions: number;
}): {
  reason: string;
  parseStatus?: Exclude<ParseStatus, "parsed">;
} | null => {
  if (input.parsed.subQuestions.length === 0) {
    return { reason: "empty_sub_questions" };
  }
  if (input.parsed.subQuestions.length > input.maxSubQuestions) {
    return {
      reason: "sub_questions_exceed_limit",
      parseStatus: "partial_review_required",
    };
  }
  if (hasDuplicateQuestionText(input.parsed)) {
    return {
      reason: "duplicate_sub_questions",
      parseStatus: "partial_review_required",
    };
  }
  if (hasQualitySelfCheckFailure(input.parsed)) {
    return {
      reason: "quality_self_check_failed",
      parseStatus: "partial_review_required",
    };
  }
  const preferredFormatFailure = readPreferredFormatFailure(input.parsed);
  return preferredFormatFailure ? { reason: preferredFormatFailure } : null;
};

export const parseDecompositionResponse = (input: {
  rawText: string;
  maxSubQuestions: number;
}): DecompositionParseResult => {
  const normalizedText = normalizeRawText(input.rawText);
  const raw = parseJson(normalizedText);
  if (isDecompositionParseFailure(raw)) {
    return raw;
  }
  const parsed = parseDecompositionContract(raw, normalizedText);
  if (isDecompositionParseFailure(parsed)) {
    return parsed;
  }
  const validationFailure = readResponseValidationFailure({
    parsed,
    maxSubQuestions: input.maxSubQuestions,
  });
  if (validationFailure) {
    return buildFailure(
      normalizedText,
      validationFailure.reason,
      validationFailure.parseStatus,
    );
  }
  return {
    parseStatus: "parsed",
    parsed,
    normalizedText,
    rawResponseHash: buildDeepResearchTextHash(normalizedText),
  };
};
