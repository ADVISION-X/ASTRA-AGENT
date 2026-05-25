import {
  buildDefaultLimitations,
  buildSentenceRawIndex,
  normalizeConfidenceValue,
  takeRawIndexArray,
  takeFirstString,
  takeFirstStringArray,
} from "./deep-research-analysis.parser-support.js";

const normalizeEvidenceQuality = (value: unknown) => {
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

export const buildAnalysisCandidate = (candidate: Record<string, unknown>) => {
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
  const answerRawIndex = buildSentenceRawIndex(answer);
  return {
    ok: true as const,
    value: {
      subQuestionId,
      answer,
      coreFinding,
      keyClaims: takeRawIndexArray(
        takeFirstStringArray(candidate, ["keyClaims", "claims", "keyPoints"]),
        answerRawIndex,
      ),
      supportingReasons: takeRawIndexArray(
        takeFirstStringArray(candidate, ["supportingReasons", "reasons", "support"]),
        answerRawIndex,
      ),
      counterConditions: takeFirstStringArray(candidate, ["counterConditions", "counterArguments", "counterpoints"]),
      failureCases: takeFirstStringArray(candidate, ["failureCases", "failureModes"]),
      evidenceMentions: takeFirstStringArray(candidate, ["evidenceMentions", "evidence", "sources"]),
      evidenceQuality: normalizeEvidenceQuality(candidate.evidenceQuality),
      assumptions: takeFirstStringArray(candidate, ["assumptions", "assumptionList"]),
      uncertainties: takeFirstStringArray(candidate, ["uncertainties", "uncertainty", "unknowns"]),
      impactOnFinalAdjudication,
      confidence,
      limitations: takeRawIndexArray(
        takeFirstStringArray(candidate, ["limitations", "caveats", "risks"]),
        buildDefaultLimitations(),
      ),
    },
  };
};
