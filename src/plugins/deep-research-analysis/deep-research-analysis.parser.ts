import { z } from "zod";

import {
  buildDeepResearchSourceNotesFromReferences,
} from "./deep-research-analysis.source-notes.js";
import { parseDecompositionResponse } from "./deep-research-analysis.decomposition-parser.js";
import type { DeepResearchDecompositionResponse } from "./deep-research-analysis.decomposition-schema.js";
import { DeepResearchFinalReportSchema } from "./deep-research-analysis.result.js";
import {
  buildTextRawIndexResult,
  buildSentenceRawIndex,
  isDeepResearchParserSuccess,
  normalizeConfidenceValue,
  normalizeWithSchema,
  parseJsonObject,
  takeFirstString,
  takeFirstStringArray,
  type DeepResearchParserResult,
  type FinalReportNormalizationRawIndex,
} from "./deep-research-analysis.parser-support.js";

const DeepResearchConfidenceSchema = z.enum(["low", "medium", "high"]);

const DeepResearchSubQuestionAnalysisAnswerSchema = z.object({
  subQuestionId: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  keyPoints: z.array(z.string().trim().min(1)).default([]),
  evidenceMentions: z.array(z.string().trim().min(1)).default([]),
  assumptions: z.array(z.string().trim().min(1)).default([]),
  contradictionPoints: z.array(z.string().trim().min(1)).default([]),
  limitations: z.array(z.string().trim().min(1)).default([]),
  confidence: DeepResearchConfidenceSchema,
  structuredPayload: z.record(z.string(), z.unknown()),
}).strict();

export type DeepResearchSubQuestionAnalysisAnswer = z.infer<typeof DeepResearchSubQuestionAnalysisAnswerSchema>;

export type {
  DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";
export {
  isDeepResearchParserSuccess,
} from "./deep-research-analysis.parser-support.js";

type DeepResearchFinalReport = z.infer<typeof DeepResearchFinalReportSchema>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeKey = (value: string): string => value.toLowerCase();

const pickTopLevelString = (
  candidate: Record<string, unknown>,
  preferredKeys: readonly string[],
): string | null => {
  const preferred = takeFirstString(candidate, preferredKeys);
  if (preferred) {
    return preferred;
  }
  for (const value of Object.values(candidate)) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const pickStringArrayByKeyFragments = (
  candidate: Record<string, unknown>,
  fragments: readonly string[],
): string[] => {
  for (const [key, value] of Object.entries(candidate)) {
    const normalizedKey = normalizeKey(key);
    if (!fragments.some((fragment) => normalizedKey.includes(fragment))) {
      continue;
    }
    if (!Array.isArray(value)) {
      continue;
    }
    const strings = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (strings.length > 0) {
      return strings;
    }
  }
  return [];
};

const pickConfidence = (candidate: Record<string, unknown>): DeepResearchFinalReport["confidence"] | null => {
  const explicitConfidence = candidate.confidence ?? candidate.confidenceLevel ?? candidate.confidenceScore;
  const normalizedExplicitConfidence = normalizeConfidenceValue(explicitConfidence);
  if (normalizedExplicitConfidence) {
    return normalizedExplicitConfidence;
  }
  for (const [key, value] of Object.entries(candidate)) {
    if (!normalizeKey(key).includes("confidence")) {
      continue;
    }
    const normalized = normalizeConfidenceValue(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
};

const buildSubQuestionAnalysisCandidate = (
  candidate: Record<string, unknown>,
): { ok: true; value: DeepResearchSubQuestionAnalysisAnswer } | { ok: false; reason: string } => {
  const subQuestionId = pickTopLevelString(candidate, ["subQuestionId", "questionId", "id"]);
  const summary = pickTopLevelString(candidate, ["summary", "answer", "conclusion", "finding", "analysis"]);
  const confidence = pickConfidence(candidate);
  if (!subQuestionId || !summary || !confidence) {
    return { ok: false, reason: "missing_sub_question_summary_or_confidence" };
  }
  const keyPoints = pickStringArrayByKeyFragments(candidate, ["key", "point", "finding", "takeaway", "reason"]);
  return {
    ok: true,
    value: {
      subQuestionId,
      summary,
      keyPoints: keyPoints.length > 0 ? keyPoints : buildSentenceRawIndex(summary),
      evidenceMentions: pickStringArrayByKeyFragments(candidate, ["evidence", "reference", "source", "citation", "url", "link"]),
      assumptions: pickStringArrayByKeyFragments(candidate, ["assumption", "premise"]),
      contradictionPoints: pickStringArrayByKeyFragments(candidate, ["counter", "contradict", "oppos", "reverse"]),
      limitations: pickStringArrayByKeyFragments(candidate, ["limitation", "risk", "caveat", "gap", "uncertaint"]),
      confidence,
      structuredPayload: candidate,
    },
  };
};

const buildFinalReportCandidate = (
  candidate: Record<string, unknown>,
  rawIndex: FinalReportNormalizationRawIndex,
) => {
  const summary = pickTopLevelString(candidate, ["summary", "conclusion", "decision", "answer", "verdict"]);
  const confidence = pickConfidence(candidate);
  if (summary && confidence) {
    return {
      ok: true as const,
      value: {
        summary,
        confidence,
        structuredPayload: candidate,
        references: pickStringArrayByKeyFragments(candidate, ["reference", "source", "citation", "url", "link"]),
        sourceNotes: rawIndex.sourceNotes ? [...rawIndex.sourceNotes] : [],
      },
    };
  }
  return { ok: false as const, reason: "missing_final_report_summary_or_confidence" };
};

const buildNarrativeLead = (rawText: string): string =>
  buildSentenceRawIndex(rawText)[0]
  ?? rawText.replace(/\s+/gu, " ").trim().slice(0, 240)
  ?? "Model returned a narrative answer without a structured summary.";

const buildSubQuestionAnalysisTextRawIndexValue = (input: {
  rawText: string;
  subQuestionId?: string;
}): DeepResearchSubQuestionAnalysisAnswer => {
  const normalized = input.rawText.replace(/\s+/gu, " ").trim();
  const keyPoints = buildSentenceRawIndex(normalized);
  return {
    subQuestionId: input.subQuestionId ?? "unknown-sub-question",
    summary: buildNarrativeLead(normalized),
    keyPoints,
    evidenceMentions: [],
    assumptions: [],
    contradictionPoints: [],
    limitations: ["Model returned narrative analysis instead of the requested JSON contract."],
    confidence: "medium",
    structuredPayload: {
      summary: buildNarrativeLead(normalized),
      narrative: normalized,
      keyPoints,
    },
  };
};

const buildFinalAdjudicationTextRawIndexValue = (input: {
  rawText: string;
  rawIndex: FinalReportNormalizationRawIndex;
}): DeepResearchFinalReport => {
  const normalized = input.rawText.replace(/\s+/gu, " ").trim();
  const summary = buildNarrativeLead(normalized);
  const references = input.rawIndex.references ? [...input.rawIndex.references] : [];
  return {
    summary,
    confidence: "medium",
    structuredPayload: {
      summary,
      narrative: normalized,
      supportingSignals: buildSentenceRawIndex(normalized),
    },
    references,
    sourceNotes: input.rawIndex.sourceNotes
      ? [...input.rawIndex.sourceNotes]
      : buildDeepResearchSourceNotesFromReferences(references),
  };
};

export const parseDeepResearchDecompositionResponse = (input: {
  rawText: string;
  maxSubQuestions: number;
}): DeepResearchParserResult<DeepResearchDecompositionResponse> =>
  parseDecompositionResponse(input);

export const parseDeepResearchSubQuestionAnalysisResponse = (
  input: string | {
    rawText: string;
    subQuestionId?: string;
  },
): DeepResearchParserResult<DeepResearchSubQuestionAnalysisAnswer> => {
  const rawText = typeof input === "string" ? input : input.rawText;
  const normalized = normalizeWithSchema({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchSubQuestionAnalysisAnswerSchema,
    normalize: buildSubQuestionAnalysisCandidate,
    missingRequiredReason: "invalid_sub_question_analysis_contract",
  });
  if (isDeepResearchParserSuccess(normalized) || !normalized.normalizedText) {
    return normalized;
  }
  return buildTextRawIndexResult({
    rawText,
    schema: DeepResearchSubQuestionAnalysisAnswerSchema,
    value: buildSubQuestionAnalysisTextRawIndexValue({
      rawText,
      ...(typeof input === "string" ? {} : { subQuestionId: input.subQuestionId }),
    }),
    failureReason: "invalid_sub_question_analysis_text_raw_index",
  });
};

export const parseDeepResearchFinalAdjudicationResponse = (
  rawText: string,
  rawIndex: FinalReportNormalizationRawIndex = {},
): DeepResearchParserResult<DeepResearchFinalReport> => {
  const normalized = normalizeWithSchema({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchFinalReportSchema,
    normalize: (candidate) => buildFinalReportCandidate(candidate, rawIndex),
    missingRequiredReason: "invalid_final_adjudication_contract",
  });
  if (isDeepResearchParserSuccess(normalized) || !normalized.normalizedText) {
    return normalized;
  }
  return buildTextRawIndexResult({
    rawText,
    schema: DeepResearchFinalReportSchema,
    value: buildFinalAdjudicationTextRawIndexValue({ rawText, rawIndex }),
    failureReason: "invalid_final_adjudication_text_raw_index",
  });
};
