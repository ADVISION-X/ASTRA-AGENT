import { createHash } from "node:crypto";

import { z } from "zod";

import { parseDecompositionResponse } from "./deep-research-analysis.decomposition-parser.js";
import type { DeepResearchDecompositionResponse } from "./deep-research-analysis.decomposition-schema.js";
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
  formatNotice: z.string().trim().min(1).default("answerText is the complete answer; runtime must preserve raw response."),
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

const buildSubQuestionIndexFromJson = (
  candidate: Record<string, unknown>,
): DeepResearchSubQuestionAnalysisAnswer | null => {
  const answerText = readString(candidate.answerText);
  if (!answerText) {
    return null;
  }
  return DeepResearchSubQuestionAnalysisAnswerSchema.parse({
    answerText,
    indexNotes: readStringArray(candidate.indexNotes),
    formatNotice: readString(candidate.formatNotice)
      ?? "answerText is the complete answer; runtime must preserve raw response.",
    parsedJsonIndex: candidate,
  });
};

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
  const parsedJson = parseJsonObject(rawText);
  if (isDeepResearchParserSuccess(parsedJson) && isRecord(parsedJson.parsed)) {
    const indexed = buildSubQuestionIndexFromJson(parsedJson.parsed);
    if (indexed) {
      return buildParsedResult({
        parsed: indexed,
        normalizedText,
        rawResponseHash,
        parseStatus: "parsed_json_index",
      });
    }
  }
  return buildParsedResult({
    parsed: DeepResearchSubQuestionAnalysisAnswerSchema.parse({
      answerText: normalizedText,
      indexNotes: [],
      formatNotice: "raw response persisted as answerText because no indexing envelope was present.",
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
