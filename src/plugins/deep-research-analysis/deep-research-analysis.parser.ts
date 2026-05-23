import { z } from "zod";

import { DeepResearchFinalReportSchema } from "./deep-research-analysis.result.js";
import { DeepResearchSubQuestionSchema } from "./deep-research-analysis.schema.js";
import {
  buildDefaultLimitations,
  buildFailure,
  buildSentenceFallback,
  normalizeConfidenceValue,
  normalizeConflictMatrixRows,
  normalizeWithSchema,
  parseJsonObject,
  refineSchemaResult,
  takeFallbackArray,
  takeFirstString,
  takeFirstStringArray,
  type DeepResearchParserResult,
  type FinalReportNormalizationFallback,
} from "./deep-research-analysis.parser-support.js";

const DeepResearchConfidenceSchema = z.enum(["low", "medium", "high"]);

const DeepResearchPersistableSubQuestionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  questionText: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  scope: z.string().trim().min(1),
  expectedAnswerShape: z.string().trim().min(1),
  dimension: z.string().trim().min(1).optional(),
  requiredEvidence: z.array(z.string().trim().min(1)).optional(),
  positiveAnalysisFocus: z.string().trim().min(1).optional(),
  falsificationFocus: z.string().trim().min(1).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
}).strict().transform((subQuestion) =>
  DeepResearchSubQuestionSchema.parse({
    id: subQuestion.id,
    title: subQuestion.title,
    questionText: subQuestion.questionText,
    purpose: subQuestion.purpose,
    scope: subQuestion.scope,
    expectedAnswerShape: subQuestion.expectedAnswerShape,
  }));

const DeepResearchDecompositionResponseSchema = z.object({
  mainQuestion: z.string().trim().min(1),
  questionType: z.string().trim().min(1).optional(),
  decompositionStrategy: z.string().trim().min(1).optional(),
  missingInfo: z.array(z.string().trim().min(1)).optional(),
  subQuestions: z.array(DeepResearchPersistableSubQuestionSchema).min(1),
  qualitySelfCheck: z.object({
    coversFacts: z.boolean(),
    coversCausality: z.boolean(),
    coversImpact: z.boolean(),
    coversEvidence: z.boolean(),
    coversFalsification: z.boolean(),
    coversRisks: z.boolean(),
    hasNoDuplicateQuestions: z.boolean(),
    isReadyForPositiveAndFalsification: z.boolean(),
  }).optional(),
}).strict();

const DeepResearchPositiveAnswerSchema = z.object({
  subQuestionId: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  keyClaims: z.array(z.string().trim().min(1)).min(1),
  supportingReasons: z.array(z.string().trim().min(1)).min(1),
  assumptions: z.array(z.string().trim().min(1)),
  evidenceMentions: z.array(z.string().trim().min(1)),
  confidence: DeepResearchConfidenceSchema,
  limitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

const DeepResearchFalsificationAnswerSchema = z.object({
  subQuestionId: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  strongestOpposingArguments: z.array(z.string().trim().min(1)).min(1),
  contradictionPoints: z.array(z.string().trim().min(1)).min(1),
  evidenceMentions: z.array(z.string().trim().min(1)),
  confidence: DeepResearchConfidenceSchema,
  limitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

export type DeepResearchDecompositionResponse = z.infer<typeof DeepResearchDecompositionResponseSchema>;
export type DeepResearchPositiveAnswer = z.infer<typeof DeepResearchPositiveAnswerSchema>;
export type DeepResearchFalsificationAnswer = z.infer<typeof DeepResearchFalsificationAnswerSchema>;

export type {
  DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";

type DeepResearchFinalReport = z.infer<typeof DeepResearchFinalReportSchema>;

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
  if (!executiveConclusion) {
    return { ok: false as const, reason: "missing_executive_conclusion" };
  }
  if (!confidence) {
    return { ok: false as const, reason: "invalid_confidence" };
  }
  const conflictMatrix = normalizeConflictMatrixRows(candidate.conflictMatrix);
  const effectiveConflictMatrix = conflictMatrix.length > 0
    ? conflictMatrix
    : [...(fallback.conflictMatrix ?? [])];
  if (effectiveConflictMatrix.length === 0) {
    return { ok: false as const, reason: "missing_conflict_matrix" };
  }
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
}): DeepResearchParserResult<DeepResearchDecompositionResponse> => {
  const parsed = refineSchemaResult({
    parsedJson: parseJsonObject(input.rawText),
    schema: DeepResearchDecompositionResponseSchema,
    missingRequiredReason: "invalid_decomposition_contract",
    partialReviewOnCustomIssue: true,
  });
  if (parsed.parseStatus !== "parsed") {
    return parsed;
  }
  if (parsed.parsed.subQuestions.length === 0) {
    return buildFailure(parsed.normalizedText, parsed.rawResponseHash, "empty_sub_questions");
  }
  if (parsed.parsed.subQuestions.length > input.maxSubQuestions) {
    return buildFailure(
      parsed.normalizedText,
      parsed.rawResponseHash,
      `sub_questions_exceed_limit:${parsed.parsed.subQuestions.length}`,
      "partial_review_required",
    );
  }
  return parsed;
};

export const parseDeepResearchPositiveResponse = (
  rawText: string,
): DeepResearchParserResult<DeepResearchPositiveAnswer> =>
  normalizeWithSchema({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchPositiveAnswerSchema,
    normalize: buildPositiveCandidate,
    missingRequiredReason: "invalid_positive_analysis_contract",
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

export const parseDeepResearchFinalReportResponse = (
  rawText: string,
  fallback: FinalReportNormalizationFallback = {},
): DeepResearchParserResult<DeepResearchFinalReport> =>
  normalizeWithSchema({
    parsedJson: parseJsonObject(rawText),
    schema: DeepResearchFinalReportSchema,
    normalize: (candidate) => buildFinalReportCandidate(candidate, fallback),
    missingRequiredReason: "invalid_final_report_contract",
  });
