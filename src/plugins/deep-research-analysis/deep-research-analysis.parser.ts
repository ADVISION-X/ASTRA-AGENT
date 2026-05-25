import { createHash } from "node:crypto";

import { z } from "zod";

import { parseDecompositionResponse } from "./deep-research-analysis.decomposition-parser.js";
import type { DeepResearchDecompositionResponse } from "./deep-research-analysis.decomposition-schema.js";
import {
  DeepResearchFinalReportSchema,
  DeepResearchSourceNoteSchema,
  type DeepResearchFinalReport,
} from "./deep-research-analysis.result.js";
import {
  buildFailure,
  buildParsedResult,
  isDeepResearchParserSuccess,
  parseJsonObject,
  type DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";

const DeepResearchSubQuestionAnalysisAnswerSchema = z.object({
  summary: z.string().trim().min(1),
  keyPoints: z.array(z.string().trim().min(1)).default([]),
  evidenceMentions: z.array(z.string().trim().min(1)).default([]),
  assumptions: z.array(z.string().trim().min(1)).default([]),
  limitations: z.array(z.string().trim().min(1)).default([]),
  contradictionPoints: z.array(z.string().trim().min(1)).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  structuredPayload: z.record(z.string(), z.unknown()).default({}),
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

const readConfidence = (value: unknown): DeepResearchSubQuestionAnalysisAnswer["confidence"] =>
  value === "low" || value === "medium" || value === "high"
    ? value
    : "medium";

const readStructuredPayload = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

const parseSourceNotes = (value: unknown): DeepResearchFinalReport["sourceNotes"] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => DeepResearchSourceNoteSchema.safeParse(entry))
    .filter((entry): entry is { success: true; data: DeepResearchFinalReport["sourceNotes"][number] } => entry.success)
    .map((entry) => entry.data);
};

const buildSubQuestionAnalysisCandidate = (value: unknown): DeepResearchSubQuestionAnalysisAnswer | null => {
  if (!isRecord(value)) {
    return null;
  }
  const summary = readString(value.summary) ?? readString(value.answerText);
  if (!summary) {
    return null;
  }
  return DeepResearchSubQuestionAnalysisAnswerSchema.parse({
    summary,
    keyPoints: readStringArray(value.keyPoints),
    evidenceMentions: readStringArray(value.evidenceMentions),
    assumptions: readStringArray(value.assumptions),
    limitations: readStringArray(value.limitations),
    contradictionPoints: readStringArray(value.contradictionPoints),
    confidence: readConfidence(value.confidence),
    structuredPayload: isRecord(value.structuredPayload)
      ? value.structuredPayload
      : readStructuredPayload(value),
  });
};

const buildFinalReportCandidate = (value: unknown): DeepResearchFinalReport | null => {
  if (!isRecord(value)) {
    return null;
  }
  const summary = readString(value.summary) ?? readString(value.rawFinalAnswerText);
  if (!summary) {
    return null;
  }
  return DeepResearchFinalReportSchema.parse({
    summary,
    confidence: readConfidence(value.confidence),
    structuredPayload: isRecord(value.structuredPayload)
      ? value.structuredPayload
      : readStructuredPayload(value),
    references: readStringArray(value.references),
    sourceNotes: parseSourceNotes(value.sourceNotes),
  });
};

export const parseDeepResearchDecompositionResponse = (input: {
  rawText: string;
  maxSubQuestions: number;
}): DeepResearchParserResult<DeepResearchDecompositionResponse> => parseDecompositionResponse(input);

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
  if (isDeepResearchParserSuccess(parsedJson)) {
    const candidate = buildSubQuestionAnalysisCandidate(parsedJson.parsed);
    if (candidate) {
      return buildParsedResult({
        parsed: candidate,
        normalizedText,
        rawResponseHash,
        parseStatus: "parsed_json_index",
      });
    }
  }
  return buildParsedResult({
    parsed: DeepResearchSubQuestionAnalysisAnswerSchema.parse({
      summary: normalizedText,
      keyPoints: [],
      evidenceMentions: [],
      assumptions: [],
      limitations: [],
      contradictionPoints: [],
      confidence: "medium",
      structuredPayload: {},
    }),
    normalizedText,
    rawResponseHash,
    parseStatus: "parsed_text_raw_index",
  });
};

export const parseDeepResearchFinalAdjudicationResponse = (
  rawText: string,
): DeepResearchParserResult<DeepResearchFinalReport> => {
  const normalizedText = normalizeRawText(rawText);
  const rawResponseHash = buildRawTextHash(normalizedText);
  if (!normalizedText) {
    return buildFailure(normalizedText, rawResponseHash, "empty_final_adjudication", "failed_empty");
  }
  const parsedJson = parseJsonObject(rawText);
  if (isDeepResearchParserSuccess(parsedJson)) {
    const candidate = buildFinalReportCandidate(parsedJson.parsed);
    if (candidate) {
      return buildParsedResult({
        parsed: candidate,
        normalizedText,
        rawResponseHash,
        parseStatus: "parsed_json_index",
      });
    }
  }
  return buildParsedResult({
    parsed: DeepResearchFinalReportSchema.parse({
      summary: normalizedText,
      confidence: "medium",
      structuredPayload: {},
      references: [],
      sourceNotes: [],
    }),
    normalizedText,
    rawResponseHash,
    parseStatus: "parsed_text_raw_index",
  });
};
