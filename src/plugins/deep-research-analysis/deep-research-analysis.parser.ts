import { createHash } from "node:crypto";
import { z } from "zod";
import {
    buildFailure,
    buildParsedResult,
    isDeepResearchParserSuccess,
    parseJsonObject,
    type DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";
import {
    SUB_QUESTION_ANSWER_TEXT_BEGIN,
    SUB_QUESTION_ANSWER_TEXT_END,
    SUB_QUESTION_INDEX_JSON_BEGIN,
    SUB_QUESTION_INDEX_JSON_END,
} from "./deep-research-analysis.prompt-bundle-shell.js";
import { buildDeepResearchTextHash } from "./deep-research-analysis.prompts.js";
import {
    DeepResearchDecompositionResponseSchema,
    DeepResearchPhaseSchema,
    type DeepResearchDecompositionResponse,
} from "./deep-research-analysis.schema.js";
export { isDeepResearchParserSuccess } from "./deep-research-analysis.parser-support.js";

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

const buildDecompositionFailure = (
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
    return buildDecompositionFailure(normalizedText, "empty_ai_response");
  }
  try {
    return JSON.parse(extractJsonCandidate(normalizedText)) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_json";
    return buildDecompositionFailure(normalizedText, `json_parse_failed:${message}`);
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
    return buildDecompositionFailure(
      normalizedText,
      "invalid_decomposition_contract:unrecognized_keys:schema_extra_fields_not_allowed",
    );
  }
  const parsed = DeepResearchDecompositionResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return buildDecompositionFailure(normalizedText, formatSchemaFailureReason(parsed.error.issues));
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
    return buildDecompositionFailure(
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

export const DeepResearchSourceNoteSchema = z.object({
  sourceNoteId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  note: z.string().trim().min(1),
  sourceType: z.enum(["analysis_evidence_mention", "final_reference"]),
  subQuestionIds: z.array(z.string().trim().min(1)).default([]),
  url: z.string().trim().min(1).nullable().default(null),
}).strict();

export const DeepResearchFinalAdjudicationRecordSchema = z.object({
  jobId: z.string().trim().min(1),
  interactionId: z.string().trim().min(1),
  promptId: z.string().trim().min(1),
  promptVersion: z.string().trim().min(1),
  rawFinalAnswerText: z.string().trim().min(1),
  rawResponseHash: z.string().trim().min(1),
  preferredFormat: z.enum(["structured_text", "json_object", "markdown"]),
  parsedJsonIndex: z.unknown().nullable(),
  parseStatus: z.enum(["raw_structured_text", "parsed_json_index"]),
  promptBundleSnapshot: z.unknown(),
  createdAt: z.string().datetime(),
}).strict();

export const DeepResearchFinalAdjudicationParseSchema =
  DeepResearchFinalAdjudicationRecordSchema.omit({
    jobId: true,
    interactionId: true,
    promptId: true,
    promptVersion: true,
    promptBundleSnapshot: true,
    createdAt: true,
  });

const DeepResearchResultSchema = z.object({
  jobId: z.string().trim().min(1),
  status: z.literal("success"),
  jobStatus: z.literal("completed"),
  phase: DeepResearchPhaseSchema,
  finalAdjudication: DeepResearchFinalAdjudicationRecordSchema,
  recordHashes: z.record(z.string(), z.string()),
  failureReason: z.string().trim().min(1).nullable().default(null),
  reviewReason: z.string().trim().min(1).nullable().default(null),
}).strict();

const DeepResearchTerminalResultSchema = z.object({
  jobId: z.string().trim().min(1),
  status: z.enum(["failed", "review_required"]),
  jobStatus: z.enum(["failed", "review_required"]),
  phase: DeepResearchPhaseSchema,
  finalAdjudication: DeepResearchFinalAdjudicationRecordSchema.nullable(),
  recordHashes: z.record(z.string(), z.string()),
  failureReason: z.string().trim().min(1).nullable().default(null),
  reviewReason: z.string().trim().min(1).nullable().default(null),
}).strict();

export type DeepResearchFinalAdjudicationParse = z.infer<typeof DeepResearchFinalAdjudicationParseSchema>;
export type DeepResearchFinalAdjudicationRecord = z.infer<typeof DeepResearchFinalAdjudicationRecordSchema>;
export type DeepResearchSourceNote = z.infer<typeof DeepResearchSourceNoteSchema>;
export type DeepResearchResult =
  | z.infer<typeof DeepResearchResultSchema>
  | z.infer<typeof DeepResearchTerminalResultSchema>;

const DeepResearchSubQuestionAnalysisAnswerSchema = z.object({
  answerText: z.string().trim().min(1),
  indexNotes: z.array(z.string().trim().min(1)).default([]),
  formatNotice: z.string().trim().min(1).default("Persist the extracted answer body while preserving the raw response as the sovereign record."),
  parsedJsonIndex: z.unknown().nullable().default(null),
}).strict();

export type DeepResearchSubQuestionAnalysisAnswer = z.infer<typeof DeepResearchSubQuestionAnalysisAnswerSchema>;

export type { DeepResearchParserResult } from "./deep-research-analysis.parser-support.js";

const normalizeAnswerRawText = (rawText: string): string => rawText.trim();

const buildRawTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
    : [];

const extractDelimitedSection = (
  rawText: string,
  beginMarker: string,
  endMarker: string,
): string | null => {
  const beginIndex = rawText.indexOf(beginMarker);
  if (beginIndex < 0) {
    return null;
  }
  const contentStart = beginIndex + beginMarker.length;
  const endIndex = rawText.indexOf(endMarker, contentStart);
  if (endIndex < 0) {
    return null;
  }
  const value = rawText.slice(contentStart, endIndex).trim();
  return value.length > 0 ? value : null;
};

const parseAnalysisIndexJsonBlock = (rawText: string): {
  indexNotes: string[];
  parsedJsonIndex: unknown | null;
} => {
  const indexBlock = extractDelimitedSection(
    rawText,
    SUB_QUESTION_INDEX_JSON_BEGIN,
    SUB_QUESTION_INDEX_JSON_END,
  );
  if (!indexBlock) {
    return {
      indexNotes: [],
      parsedJsonIndex: null,
    };
  }
  try {
    const parsed = JSON.parse(indexBlock) as unknown;
    const indexNotes = isRecord(parsed)
      ? readStringArray(parsed.indexNotes)
      : [];
    return {
      indexNotes,
      parsedJsonIndex: parsed,
    };
  } catch {
    return {
      indexNotes: [],
      parsedJsonIndex: null,
    };
  }
};

const buildDelimitedSubQuestionAnswer = (rawText: string): DeepResearchSubQuestionAnalysisAnswer | null => {
  const answerText = extractDelimitedSection(
    rawText,
    SUB_QUESTION_ANSWER_TEXT_BEGIN,
    SUB_QUESTION_ANSWER_TEXT_END,
  );
  if (!answerText) {
    return null;
  }
  const indexPayload = parseAnalysisIndexJsonBlock(rawText);
  return DeepResearchSubQuestionAnalysisAnswerSchema.parse({
    answerText,
    indexNotes: indexPayload.indexNotes,
    formatNotice: "Delimited answer body preserved separately from the retrieval-only index JSON.",
    parsedJsonIndex: indexPayload.parsedJsonIndex,
  });
};

const isEnvelopeWrappedAnalysisPayload = (candidate: Record<string, unknown>): boolean =>
  readString(candidate["answerText"]) !== null;

export const parseDeepResearchDecompositionResponse = (input: {
  rawText: string;
  maxSubQuestions: number;
}): DeepResearchParserResult<DeepResearchDecompositionResponse> =>
  parseDecompositionResponse(input);

export const parseDeepResearchSubQuestionAnalysisResponse = (
  input: string | { rawText: string; subQuestionId?: string },
): DeepResearchParserResult<DeepResearchSubQuestionAnalysisAnswer> => {
  const rawText = typeof input === "string" ? input : input.rawText;
  const normalizedText = normalizeAnswerRawText(rawText);
  const rawResponseHash = buildRawTextHash(normalizedText);
  if (!normalizedText) {
    return buildFailure(normalizedText, rawResponseHash, "empty_ai_response", "failed_empty");
  }
  const delimitedAnswer = buildDelimitedSubQuestionAnswer(rawText);
  if (delimitedAnswer) {
    return buildParsedResult({
      parsed: delimitedAnswer,
      normalizedText,
      rawResponseHash,
      parseStatus: delimitedAnswer.parsedJsonIndex === null
        ? "parsed_text_raw_index"
        : "parsed_json_index",
    });
  }
  const parsedJson = parseJsonObject(rawText);
  if (isDeepResearchParserSuccess(parsedJson) && isRecord(parsedJson.parsed)) {
    if (isEnvelopeWrappedAnalysisPayload(parsedJson.parsed)) {
      return buildFailure(
        normalizedText,
        rawResponseHash,
        "analysis_response_envelope_forbidden",
      );
    }
    return buildParsedResult({
      parsed: DeepResearchSubQuestionAnalysisAnswerSchema.parse({
        answerText: normalizedText,
        indexNotes: readStringArray(parsedJson.parsed.indexNotes),
        formatNotice: "Raw response preserved as answerText because no delimited answer block was present.",
        parsedJsonIndex: parsedJson.parsed,
      }),
      normalizedText,
      rawResponseHash,
      parseStatus: "parsed_json_index",
    });
  }
  return buildParsedResult({
    parsed: DeepResearchSubQuestionAnalysisAnswerSchema.parse({
      answerText: normalizedText,
      indexNotes: [],
      formatNotice: "Raw response preserved as answerText because no delimited answer block was present.",
      parsedJsonIndex: null,
    }),
    normalizedText,
    rawResponseHash,
    parseStatus: "parsed_text_raw_index",
  });
};

export const parseDeepResearchFinalAdjudicationResponse = (
  rawText: string,
): DeepResearchParserResult<DeepResearchFinalAdjudicationParse> => {
  const normalizedText = normalizeAnswerRawText(rawText);
  const rawResponseHash = buildRawTextHash(normalizedText);
  if (!normalizedText) {
    return buildFailure(normalizedText, rawResponseHash, "empty_final_adjudication", "failed_empty");
  }
  const parsedJson = parseJsonObject(rawText);
  const parsedJsonIndex = isDeepResearchParserSuccess(parsedJson) ? parsedJson.parsed : null;
  const parseStatus = parsedJsonIndex === null ? "raw_structured_text" : "parsed_json_index";
  return buildParsedResult({
    parsed: DeepResearchFinalAdjudicationParseSchema.parse({
      rawFinalAnswerText: rawText,
      rawResponseHash,
      preferredFormat: parsedJsonIndex === null ? "structured_text" : "json_object",
      parsedJsonIndex,
      parseStatus,
    }),
    normalizedText,
    rawResponseHash,
    parseStatus,
  });
};
