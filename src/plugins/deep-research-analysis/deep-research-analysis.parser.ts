import { z } from "zod";

import { buildAnalysisCandidate } from "./deep-research-analysis.parser-candidates.js";
import {
  buildDeepResearchSourceNotesFromReferences,
} from "./deep-research-analysis.source-notes.js";
import { parseDecompositionResponse } from "./deep-research-analysis.decomposition-parser.js";
import type { DeepResearchDecompositionResponse } from "./deep-research-analysis.decomposition-schema.js";
import { DeepResearchFinalReportSchema } from "./deep-research-analysis.result.js";
import {
  buildTextRawIndexResult,
  buildDefaultLimitations,
  buildSentenceRawIndex,
  isDeepResearchParserSuccess,
  normalizeConfidenceValue,
  normalizeWithSchema,
  parseJsonObject,
  takeRawIndexArray,
  takeFirstString,
  takeFirstStringArray,
  type DeepResearchParserResult,
  type FinalReportNormalizationRawIndex,
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
  rawIndex: FinalReportNormalizationRawIndex,
) => {
  const directAnswerReport = buildDirectAnswerFinalReport(candidate, rawIndex);
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
  rawIndex: FinalReportNormalizationRawIndex,
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
  const decisiveReasons = takeRawIndexArray(
    takeFirstStringArray(candidate, ["decisiveReasons", "reasons"]),
    rawIndex.decisiveReasons,
  );
  const opposingArguments = takeRawIndexArray(
    takeFirstStringArray(candidate, ["weakOrRejectedClaims", "rejectedClaims", "strongestOpposingArguments"]),
    rawIndex.strongestOpposingArguments,
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
    evidenceGaps: takeRawIndexArray(
      takeFirstStringArray(candidate, ["evidenceGaps", "gaps"]),
      rawIndex.evidenceGaps,
    ),
    reverseConditions: takeRawIndexArray(
      takeFirstStringArray(candidate, ["reverseConditions", "reversalConditions"]),
      rawIndex.reverseConditions,
    ),
    applicability: takeFirstStringArray(candidate, ["applicability", "appliesTo"]),
    nonApplicability: takeFirstStringArray(candidate, ["nonApplicability", "doesNotApplyTo"]),
    followUpSignals: takeRawIndexArray(
      takeFirstStringArray(candidate, ["followUpSignals", "followUps", "watchSignals"]),
      rawIndex.followUpSignals,
    ),
    multiStageValueAdded: takeFirstStringArray(candidate, ["multiStageValueAdded"]),
    limitations: takeRawIndexArray(
      takeFirstStringArray(candidate, ["limitations", "caveats", "risks"]),
      rawIndex.limitations ?? buildDefaultLimitations(),
    ),
    references: takeFirstStringArray(candidate, ["references", "sourceNotes"]),
    sourceNotes: rawIndex.sourceNotes?.length
      ? [...rawIndex.sourceNotes]
      : buildDeepResearchSourceNotesFromReferences(
        takeFirstStringArray(candidate, ["sourceNotes", "references"]),
      ),
    executiveConclusion: takeFirstString(candidate, ["executiveConclusion"]) ?? directAnswer,
    strongestOpposingArguments: opposingArguments,
  };
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
  const supportingSentences = buildSentenceRawIndex(normalized);
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

const buildFinalAdjudicationTextRawIndexValue = (input: {
  rawText: string;
  rawIndex: FinalReportNormalizationRawIndex;
}): DeepResearchFinalReport => {
  const normalized = input.rawText.replace(/\s+/gu, " ").trim();
  const lead = buildNarrativeLead(normalized);
  const decisiveReasons = buildSentenceRawIndex(normalized);
  return {
    directAnswer: lead,
    finalVerdict: lead.slice(0, 160),
    oneSentenceDecision: lead,
    confidence: "medium",
    rankedConclusions: [],
    strongConclusions: decisiveReasons,
    conditionalConclusions: [],
    weakOrRejectedClaims: [...(input.rawIndex.strongestOpposingArguments ?? [])],
    decisiveReasons,
    evidenceGaps: input.rawIndex.evidenceGaps?.length
      ? [...input.rawIndex.evidenceGaps]
      : ["Model returned narrative final adjudication without structured evidence gaps."],
    reverseConditions: input.rawIndex.reverseConditions?.length
      ? [...input.rawIndex.reverseConditions]
      : ["Model did not provide explicit reverse conditions."],
    applicability: [],
    nonApplicability: [],
    followUpSignals: input.rawIndex.followUpSignals?.length
      ? [...input.rawIndex.followUpSignals]
      : ["Review the raw narrative final adjudication for additional nuance."],
    multiStageValueAdded: [],
    limitations: input.rawIndex.limitations?.length
      ? [...input.rawIndex.limitations]
      : ["Model returned narrative final adjudication instead of the requested JSON contract."],
    references: [],
    sourceNotes: input.rawIndex.sourceNotes ? [...input.rawIndex.sourceNotes] : [],
    executiveConclusion: lead,
    strongestOpposingArguments: [...(input.rawIndex.strongestOpposingArguments ?? [])],
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
