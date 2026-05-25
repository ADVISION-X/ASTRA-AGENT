import { createHash } from "node:crypto";

import { z } from "zod";

import { parseDecompositionResponse } from "./deep-research-analysis.decomposition-parser.js";
import type { DeepResearchDecompositionResponse } from "./deep-research-analysis.decomposition-schema.js";
import {
  SUB_QUESTION_ANSWER_TEXT_BEGIN,
  SUB_QUESTION_ANSWER_TEXT_END,
  SUB_QUESTION_INDEX_JSON_BEGIN,
  SUB_QUESTION_INDEX_JSON_END,
} from "./deep-research-analysis.prompt-bundle-shell.js";
import {
  DeepResearchFinalAdjudicationParseSchema,
  type DeepResearchFinalAdjudicationParse,
} from "./deep-research-analysis.result.js";
import {
  buildFailure,
  buildParsedResult,
  isDeepResearchParserSuccess,
  parseJsonObject,
  type DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";

const DeepResearchSubQuestionAnalysisAnswerSchema = z.object({
  answerText: z.string().trim().min(1),
  indexNotes: z.array(z.string().trim().min(1)).default([]),
  formatNotice: z.string().trim().min(1).default("Persist the extracted answer body while preserving the raw response as the sovereign record."),
  parsedJsonIndex: z.unknown().nullable().default(null),
}).strict();

export type DeepResearchSubQuestionAnalysisAnswer = z.infer<typeof DeepResearchSubQuestionAnalysisAnswerSchema>;

export type { DeepResearchParserResult } from "./deep-research-analysis.parser-support.js";
export { isDeepResearchParserSuccess } from "./deep-research-analysis.parser-support.js";

const normalizeRawText = (rawText: string): string => rawText.trim();

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
  const normalizedText = normalizeRawText(rawText);
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
  const normalizedText = normalizeRawText(rawText);
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
