import { z } from "zod";

import { parseDecompositionResponse } from "./deep-research-analysis.decomposition-parser.js";
import type { DeepResearchDecompositionResponse } from "./deep-research-analysis.decomposition-schema.js";
import { DeepResearchFinalReportSchema } from "./deep-research-analysis.result.js";
import {
  buildDefaultLimitations,
  buildSentenceFallback,
  normalizeConfidenceValue,
  normalizeConflictMatrixRows,
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

const DeepResearchPositiveAnswerSchema = z.object({
  subQuestionId: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  keyClaims: z.array(z.string().trim().min(1)).default([]),
  supportingReasons: z.array(z.string().trim().min(1)).default([]),
  assumptions: z.array(z.string().trim().min(1)).default([]),
  evidenceMentions: z.array(z.string().trim().min(1)).default([]),
  confidence: DeepResearchConfidenceSchema,
  limitations: z.array(z.string().trim().min(1)).default([]),
}).strict();

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

const DeepResearchFalsificationAnswerSchema = z.object({
  subQuestionId: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  strongestOpposingArguments: z.array(z.string().trim().min(1)).default([]),
  contradictionPoints: z.array(z.string().trim().min(1)).default([]),
  evidenceMentions: z.array(z.string().trim().min(1)).default([]),
  confidence: DeepResearchConfidenceSchema,
  limitations: z.array(z.string().trim().min(1)).default([]),
}).strict();

export type DeepResearchPositiveAnswer = z.infer<typeof DeepResearchPositiveAnswerSchema>;
export type DeepResearchSubQuestionAnalysisAnswer = z.infer<typeof DeepResearchSubQuestionAnalysisAnswerSchema>;
export type DeepResearchFalsificationAnswer = z.infer<typeof DeepResearchFalsificationAnswerSchema>;

export type {
  DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";

type DeepResearchFinalReport = z.infer<typeof DeepResearchFinalReportSchema>;

const normalizeEvidenceQuality = (value: unknown): z.infer<typeof DeepResearchEvidenceQualitySchema> => {
  if (value === "strong" || value === "moderate" || value === "weak" || value === "mixed" || value === "unknown") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized.includes("strong") || /强/u.test(value)) {
      return "strong";
    }
    if (normalized.includes("moderate") || normalized.includes("medium") || /中/u.test(value)) {
      return "moderate";
    }
    if (normalized.includes("weak") || /弱/u.test(value)) {
      return "weak";
    }
    if (normalized.includes("mixed") || /混合/u.test(value)) {
      return "mixed";
    }
  }
  return "unknown";
};

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

const buildPositiveCandidate = (candidate: Record<string, unknown>) => {
  const subQuestionId = takeFirstString(candidate, ["subQuestionId", "questionId", "id"]);
  const answer = takeFirstString(candidate, ["answer", "analysis", "response", "summary"]);
  const confidence = normalizeConfidenceValue(
    candidate.confidence
    ?? candidate.confidenceScore
    ?? candidate.confidenceLevel,
  );
  if (!subQuestionId) {
    return { ok: false as const, reason: "missing_sub_question_id" };
  }
  if (!answer) {
    return { ok: false as const, reason: "missing_answer" };
  }
  if (!confidence) {
    return { ok: false as const, reason: "invalid_confidence" };
  }
  const answerFallback = buildSentenceFallback(answer);
  const keyClaims = takeFirstStringArray(candidate, ["keyClaims", "claims", "keyPoints"]);
  const supportingReasons = takeFirstStringArray(candidate, ["supportingReasons", "reasons", "support"]);
  return {
    ok: true as const,
    value: {
      subQuestionId,
      answer,
      keyClaims: keyClaims.length > 0 ? keyClaims : answerFallback,
      supportingReasons: supportingReasons.length > 0 ? supportingReasons : answerFallback,
      assumptions: takeFirstStringArray(candidate, ["assumptions", "assumptionList"]),
      evidenceMentions: takeFirstStringArray(candidate, ["evidenceMentions", "evidence", "sources"]),
      confidence,
      limitations: takeFallbackArray(
        takeFirstStringArray(candidate, ["limitations", "caveats", "risks"]),
        buildDefaultLimitations(),
      ),
    },
  };
};

const buildAnalysisCandidate = (candidate: Record<string, unknown>) => {
  const subQuestionId = takeFirstString(candidate, ["subQuestionId", "questionId", "id"]);
  const answer = takeFirstString(candidate, ["answer", "analysis", "response", "summary"]);
  const coreFinding = takeFirstString(candidate, ["coreFinding", "finding", "localFinding"]);
  const impactOnFinalAdjudication = takeFirstString(candidate, [
    "impactOnFinalAdjudication",
    "impact",
    "adjudicationImpact",
  ]);
  const confidence = normalizeConfidenceValue(
    candidate.confidence
    ?? candidate.confidenceScore
    ?? candidate.confidenceLevel,
  );
  if (!subQuestionId) {
    return { ok: false as const, reason: "missing_sub_question_id" };
  }
  if (!answer) {
    return { ok: false as const, reason: "missing_answer" };
  }
  if (!coreFinding) {
    return { ok: false as const, reason: "missing_core_finding" };
  }
  if (!impactOnFinalAdjudication) {
    return { ok: false as const, reason: "missing_impact_on_final_adjudication" };
  }
  if (!confidence) {
    return { ok: false as const, reason: "invalid_confidence" };
  }
  const answerFallback = buildSentenceFallback(answer);
  return {
    ok: true as const,
    value: {
      subQuestionId,
      answer,
      coreFinding,
      keyClaims: takeFallbackArray(
        takeFirstStringArray(candidate, ["keyClaims", "claims", "keyPoints"]),
        answerFallback,
      ),
      supportingReasons: takeFallbackArray(
        takeFirstStringArray(candidate, ["supportingReasons", "reasons", "support"]),
        answerFallback,
      ),
      counterConditions: takeFirstStringArray(candidate, ["counterConditions", "counterArguments", "counterpoints"]),
      failureCases: takeFirstStringArray(candidate, ["failureCases", "failureModes"]),
      evidenceMentions: takeFirstStringArray(candidate, ["evidenceMentions", "evidence", "sources"]),
      evidenceQuality: normalizeEvidenceQuality(candidate.evidenceQuality),
      assumptions: takeFirstStringArray(candidate, ["assumptions", "assumptionList"]),
      uncertainties: takeFirstStringArray(candidate, ["uncertainties", "uncertainty", "unknowns"]),
      impactOnFinalAdjudication,
      confidence,
      limitations: takeFallbackArray(
        takeFirstStringArray(candidate, ["limitations", "caveats", "risks"]),
        buildDefaultLimitations(),
      ),
    },
  };
};

const buildFalsificationCandidate = (candidate: Record<string, unknown>) => {
  const subQuestionId = takeFirstString(candidate, ["subQuestionId", "questionId", "id"]);
  const answer = takeFirstString(candidate, ["answer", "analysis", "response", "summary"]);
  const confidence = normalizeConfidenceValue(
    candidate.confidence
    ?? candidate.confidenceScore
    ?? candidate.confidenceLevel,
  );
  if (!subQuestionId) {
    return { ok: false as const, reason: "missing_sub_question_id" };
  }
  if (!answer) {
    return { ok: false as const, reason: "missing_answer" };
  }
  if (!confidence) {
    return { ok: false as const, reason: "invalid_confidence" };
  }
  const answerFallback = buildSentenceFallback(answer);
  const strongestOpposingArguments = takeFirstStringArray(candidate, [
    "strongestOpposingArguments",
    "opposingArguments",
    "counterArguments",
    "keyArguments",
  ]);
  const contradictionPoints = takeFirstStringArray(candidate, [
    "contradictionPoints",
    "contradictions",
    "counterPoints",
  ]);
  return {
    ok: true as const,
    value: {
      subQuestionId,
      answer,
      strongestOpposingArguments:
        strongestOpposingArguments.length > 0 ? strongestOpposingArguments : answerFallback,
      contradictionPoints:
        contradictionPoints.length > 0 ? contradictionPoints : answerFallback,
      evidenceMentions: takeFirstStringArray(candidate, ["evidenceMentions", "evidence", "sources"]),
      confidence,
      limitations: takeFallbackArray(
        takeFirstStringArray(candidate, ["limitations", "caveats", "risks"]),
        buildDefaultLimitations(),
      ),
    },
  };
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
  return buildLegacyFinalReportCandidate(candidate, fallback);
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
    takeFirstStringArray(candidate, ["decisiveReasons", "reasons", "positiveReasons"]),
    fallback.positiveReasons,
  );
  const opposingArguments = takeFallbackArray(
    takeFirstStringArray(candidate, ["weakOrRejectedClaims", "rejectedClaims", "strongestOpposingArguments"]),
    fallback.strongestOpposingArguments,
  );
  const conflictMatrix = normalizeConflictMatrixRows(candidate.conflictMatrix);
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
    executiveConclusion: takeFirstString(candidate, ["executiveConclusion"]) ?? directAnswer,
    positiveReasons: decisiveReasons,
    strongestOpposingArguments: opposingArguments,
    conflictMatrix,
  };
};

const buildLegacyFinalReportCandidate = (
  candidate: Record<string, unknown>,
  fallback: FinalReportNormalizationFallback,
) => {
  const executiveConclusion = takeFirstString(candidate, [
    "executiveConclusion",
    "conclusion",
    "summary",
    "finalConclusion",
  ]);
  const confidence = normalizeConfidenceValue(
    candidate.confidence
    ?? candidate.confidenceScore
    ?? candidate.confidenceLevel,
  );
  if (!executiveConclusion || !confidence) {
    return { ok: false as const, reason: "missing_direct_answer_or_legacy_conclusion" };
  }
  const conflictMatrix = normalizeConflictMatrixRows(candidate.conflictMatrix);
  const effectiveConflictMatrix = conflictMatrix.length > 0
    ? conflictMatrix
    : [...(fallback.conflictMatrix ?? [])];
  return {
    ok: true as const,
    value: {
      executiveConclusion,
      confidence,
      positiveReasons: takeFallbackArray(
        takeFirstStringArray(candidate, ["positiveReasons", "supportingReasons", "reasons"]),
        fallback.positiveReasons ?? effectiveConflictMatrix.map((row) => row.positiveClaimSummary),
      ),
      strongestOpposingArguments: takeFallbackArray(
        takeFirstStringArray(candidate, ["strongestOpposingArguments", "opposingArguments", "counterArguments"]),
        fallback.strongestOpposingArguments ?? effectiveConflictMatrix.map((row) => row.falsificationSummary),
      ),
      conflictMatrix: effectiveConflictMatrix,
      evidenceGaps: takeFallbackArray(
        takeFirstStringArray(candidate, ["evidenceGaps", "gaps"]),
        fallback.evidenceGaps ?? effectiveConflictMatrix.map((row) => row.evidenceGap),
      ),
      reverseConditions: takeFallbackArray(
        takeFirstStringArray(candidate, ["reverseConditions", "reversalConditions"]),
        fallback.reverseConditions ?? ["Model did not provide explicit reverse conditions."],
      ),
      followUpSignals: takeFallbackArray(
        takeFirstStringArray(candidate, ["followUpSignals", "followUps", "watchSignals"]),
        fallback.followUpSignals ?? ["Model did not provide explicit follow-up signals."],
      ),
      limitations: takeFallbackArray(
        takeFirstStringArray(candidate, ["limitations", "caveats", "risks"]),
        fallback.limitations ?? buildDefaultLimitations(),
      ),
    },
  };
};
export const parseDeepResearchDecompositionResponse = (input: {
  rawText: string;
  maxSubQuestions: number;
}): DeepResearchParserResult<DeepResearchDecompositionResponse> =>
  parseDecompositionResponse(input);

export const parseDeepResearchPositiveResponse = (
  rawText: string,
): DeepResearchParserResult<DeepResearchPositiveAnswer> =>
  normalizeWithSchema({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchPositiveAnswerSchema,
    normalize: buildPositiveCandidate,
    missingRequiredReason: "invalid_positive_analysis_contract",
  });

export const parseDeepResearchSubQuestionAnalysisResponse = (
  rawText: string,
): DeepResearchParserResult<DeepResearchSubQuestionAnalysisAnswer> =>
  normalizeWithSchema({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchSubQuestionAnalysisAnswerSchema,
    normalize: buildAnalysisCandidate,
    missingRequiredReason: "invalid_sub_question_analysis_contract",
  });

export const parseDeepResearchFalsificationResponse = (
  rawText: string,
): DeepResearchParserResult<DeepResearchFalsificationAnswer> =>
  normalizeWithSchema({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchFalsificationAnswerSchema,
    normalize: buildFalsificationCandidate,
    missingRequiredReason: "invalid_falsification_contract",
  });

export const parseDeepResearchFinalAdjudicationResponse = (
  rawText: string,
  fallback: FinalReportNormalizationFallback = {},
): DeepResearchParserResult<DeepResearchFinalReport> =>
  normalizeWithSchema({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchFinalReportSchema,
    normalize: (candidate) => buildFinalReportCandidate(candidate, fallback),
    missingRequiredReason: "invalid_final_adjudication_contract",
  });
