import { z } from "zod";

import { buildAnalysisCandidate } from "./deep-research-analysis.parser-candidates.js";
import {
  buildDeepResearchSourceNotesFromReferences,
} from "./deep-research-analysis.source-notes.js";
import { parseDecompositionResponse } from "./deep-research-analysis.decomposition-parser.js";
import type { DeepResearchDecompositionResponse } from "./deep-research-analysis.decomposition-schema.js";
import { DeepResearchFinalReportSchema } from "./deep-research-analysis.result.js";
import {
  buildTextFallbackResult,
  buildDefaultLimitations,
  buildSentenceFallback,
  isDeepResearchParserSuccess,
  normalizeConfidenceValue,
  normalizeWithSchema,
  parseJsonObject,
  takeFallbackArray,
  takeFirstString,
  takeFirstStringArray,
  type DeepResearchParserResult,
  type FinalReportNormalizationFallback,
} from "./deep-research-analysis.parser-support.js";

const DeepResearchConfidenceSchema = z.enum(["low", "medium", "high"]);

const DeepResearchEvidenceQualitySchema = z.enum([
  "strong",
  "moderate",
  "weak",
  "mixed",
  "unknown",
]);

const DeepResearchSubQuestionAnalysisAnswerSchema = z.object({
  subQuestionId: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  coreFinding: z.string().trim().min(1),
  keyClaims: z.array(z.string().trim().min(1)).default([]),
  supportingReasons: z.array(z.string().trim().min(1)).default([]),
  counterConditions: z.array(z.string().trim().min(1)).default([]),
  failureCases: z.array(z.string().trim().min(1)).default([]),
  evidenceMentions: z.array(z.string().trim().min(1)).default([]),
  evidenceQuality: DeepResearchEvidenceQualitySchema,
  assumptions: z.array(z.string().trim().min(1)).default([]),
  uncertainties: z.array(z.string().trim().min(1)).default([]),
  impactOnFinalAdjudication: z.string().trim().min(1),
  confidence: DeepResearchConfidenceSchema,
  limitations: z.array(z.string().trim().min(1)).default([]),
}).catchall(z.unknown());

export type DeepResearchSubQuestionAnalysisAnswer = z.infer<typeof DeepResearchSubQuestionAnalysisAnswerSchema>;

export type {
  DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";
export {
  isDeepResearchParserSuccess,
} from "./deep-research-analysis.parser-support.js";

type DeepResearchFinalReport = z.infer<typeof DeepResearchFinalReportSchema>;

const normalizeRankedConclusions = (value: unknown): DeepResearchFinalReport["rankedConclusions"] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return [];
    }
    const record = item as Record<string, unknown>;
    const conclusion = takeFirstString(record, ["conclusion", "answer", "summary"]);
    const whyItMatters = takeFirstString(record, ["whyItMatters", "importance", "reason"]);
    const strengthValue = takeFirstString(record, ["strength"]);
    if (!conclusion || !whyItMatters || !strengthValue) {
      return [];
    }
    const normalizedStrength = ["strong", "moderate", "weak", "conditional"].includes(strengthValue)
      ? strengthValue as DeepResearchFinalReport["rankedConclusions"][number]["strength"]
      : null;
    if (!normalizedStrength) {
      return [];
    }
    const rank = typeof record.rank === "number" && Number.isFinite(record.rank)
      ? Math.max(1, Math.trunc(record.rank))
      : index + 1;
    return [{
      rank,
      conclusion,
      whyItMatters,
      strength: normalizedStrength,
      appliesTo: takeFirstStringArray(record, ["appliesTo", "applicability"]),
      doesNotApplyTo: takeFirstStringArray(record, ["doesNotApplyTo", "nonApplicability"]),
      reverseCondition: takeFirstString(record, ["reverseCondition", "reverseConditions"]) ?? "",
    }];
  });
};

const buildFinalReportCandidate = (
  candidate: Record<string, unknown>,
  fallback: FinalReportNormalizationFallback,
) => {
  const directAnswerReport = buildDirectAnswerFinalReport(candidate, fallback);
  if (directAnswerReport) {
    return {
      ok: true as const,
      value: directAnswerReport,
    };
  }
  return { ok: false as const, reason: "missing_direct_answer_or_final_verdict" };
};

const buildDirectAnswerFinalReport = (
  candidate: Record<string, unknown>,
  fallback: FinalReportNormalizationFallback,
): DeepResearchFinalReport | null => {
  const directAnswer = takeFirstString(candidate, ["directAnswer", "answer"]);
  const finalVerdict = takeFirstString(candidate, ["finalVerdict", "verdict"]);
  const confidence = normalizeConfidenceValue(
    candidate.confidence
    ?? candidate.confidenceScore
    ?? candidate.confidenceLevel,
  );
  if (!directAnswer || !finalVerdict || !confidence) {
    return null;
  }
  const decisiveReasons = takeFallbackArray(
    takeFirstStringArray(candidate, ["decisiveReasons", "reasons"]),
    fallback.decisiveReasons,
  );
  const opposingArguments = takeFallbackArray(
    takeFirstStringArray(candidate, ["weakOrRejectedClaims", "rejectedClaims", "strongestOpposingArguments"]),
    fallback.strongestOpposingArguments,
  );
  return {
    directAnswer,
    finalVerdict,
    oneSentenceDecision: takeFirstString(candidate, ["oneSentenceDecision"]) ?? directAnswer,
    confidence,
    rankedConclusions: normalizeRankedConclusions(candidate.rankedConclusions),
    strongConclusions: takeFirstStringArray(candidate, ["strongConclusions"]),
    conditionalConclusions: takeFirstStringArray(candidate, ["conditionalConclusions"]),
    weakOrRejectedClaims: opposingArguments,
    decisiveReasons,
    evidenceGaps: takeFallbackArray(
      takeFirstStringArray(candidate, ["evidenceGaps", "gaps"]),
      fallback.evidenceGaps,
    ),
    reverseConditions: takeFallbackArray(
      takeFirstStringArray(candidate, ["reverseConditions", "reversalConditions"]),
      fallback.reverseConditions,
    ),
    applicability: takeFirstStringArray(candidate, ["applicability", "appliesTo"]),
    nonApplicability: takeFirstStringArray(candidate, ["nonApplicability", "doesNotApplyTo"]),
    followUpSignals: takeFallbackArray(
      takeFirstStringArray(candidate, ["followUpSignals", "followUps", "watchSignals"]),
      fallback.followUpSignals,
    ),
    multiStageValueAdded: takeFirstStringArray(candidate, ["multiStageValueAdded"]),
    limitations: takeFallbackArray(
      takeFirstStringArray(candidate, ["limitations", "caveats", "risks"]),
      fallback.limitations ?? buildDefaultLimitations(),
    ),
    references: takeFirstStringArray(candidate, ["references", "sourceNotes"]),
    sourceNotes: fallback.sourceNotes?.length
      ? [...fallback.sourceNotes]
      : buildDeepResearchSourceNotesFromReferences(
        takeFirstStringArray(candidate, ["sourceNotes", "references"]),
      ),
    executiveConclusion: takeFirstString(candidate, ["executiveConclusion"]) ?? directAnswer,
    strongestOpposingArguments: opposingArguments,
  };
};

const buildNarrativeLead = (rawText: string): string =>
  buildSentenceFallback(rawText)[0]
  ?? rawText.replace(/\s+/gu, " ").trim().slice(0, 240)
  ?? "Model returned a narrative answer without a structured summary.";

const buildSubQuestionAnalysisTextFallbackValue = (input: {
  rawText: string;
  subQuestionId?: string;
}): DeepResearchSubQuestionAnalysisAnswer => {
  const normalized = input.rawText.replace(/\s+/gu, " ").trim();
  const supportingSentences = buildSentenceFallback(normalized);
  const coreFinding = buildNarrativeLead(normalized);
  return {
    subQuestionId: input.subQuestionId ?? "unknown-sub-question",
    answer: normalized,
    coreFinding,
    keyClaims: supportingSentences,
    supportingReasons: supportingSentences,
    counterConditions: [],
    failureCases: [],
    evidenceMentions: [],
    evidenceQuality: "unknown",
    assumptions: [],
    uncertainties: [],
    impactOnFinalAdjudication: coreFinding,
    confidence: "medium",
    limitations: ["Model returned narrative analysis instead of the requested JSON contract."],
  };
};

const buildFinalAdjudicationTextFallbackValue = (input: {
  rawText: string;
  fallback: FinalReportNormalizationFallback;
}): DeepResearchFinalReport => {
  const normalized = input.rawText.replace(/\s+/gu, " ").trim();
  const lead = buildNarrativeLead(normalized);
  const decisiveReasons = buildSentenceFallback(normalized);
  return {
    directAnswer: lead,
    finalVerdict: lead.slice(0, 160),
    oneSentenceDecision: lead,
    confidence: "medium",
    rankedConclusions: [],
    strongConclusions: decisiveReasons,
    conditionalConclusions: [],
    weakOrRejectedClaims: [...(input.fallback.strongestOpposingArguments ?? [])],
    decisiveReasons,
    evidenceGaps: input.fallback.evidenceGaps?.length
      ? [...input.fallback.evidenceGaps]
      : ["Model returned narrative final adjudication without structured evidence gaps."],
    reverseConditions: input.fallback.reverseConditions?.length
      ? [...input.fallback.reverseConditions]
      : ["Model did not provide explicit reverse conditions."],
    applicability: [],
    nonApplicability: [],
    followUpSignals: input.fallback.followUpSignals?.length
      ? [...input.fallback.followUpSignals]
      : ["Review the raw narrative final adjudication for additional nuance."],
    multiStageValueAdded: [],
    limitations: input.fallback.limitations?.length
      ? [...input.fallback.limitations]
      : ["Model returned narrative final adjudication instead of the requested JSON contract."],
    references: [],
    sourceNotes: input.fallback.sourceNotes ? [...input.fallback.sourceNotes] : [],
    executiveConclusion: lead,
    strongestOpposingArguments: [...(input.fallback.strongestOpposingArguments ?? [])],
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
    normalize: buildAnalysisCandidate,
    missingRequiredReason: "invalid_sub_question_analysis_contract",
  });
  if (isDeepResearchParserSuccess(normalized) || !normalized.normalizedText) {
    return normalized;
  }
  return buildTextFallbackResult({
    rawText,
    schema: DeepResearchSubQuestionAnalysisAnswerSchema,
    value: buildSubQuestionAnalysisTextFallbackValue({
      rawText,
      ...(typeof input === "string" ? {} : { subQuestionId: input.subQuestionId }),
    }),
    failureReason: "invalid_sub_question_analysis_text_fallback",
  });
};

export const parseDeepResearchFinalAdjudicationResponse = (
  rawText: string,
  fallback: FinalReportNormalizationFallback = {},
): DeepResearchParserResult<DeepResearchFinalReport> => {
  const normalized = normalizeWithSchema({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchFinalReportSchema,
    normalize: (candidate) => buildFinalReportCandidate(candidate, fallback),
    missingRequiredReason: "invalid_final_adjudication_contract",
  });
  if (isDeepResearchParserSuccess(normalized) || !normalized.normalizedText) {
    return normalized;
  }
  return buildTextFallbackResult({
    rawText,
    schema: DeepResearchFinalReportSchema,
    value: buildFinalAdjudicationTextFallbackValue({ rawText, fallback }),
    failureReason: "invalid_final_adjudication_text_fallback",
  });
};
