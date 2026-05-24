import { DeepResearchBusinessDeckOutlineSchema, type DeepResearchBusinessDeckOutline } from "./deep-research-analysis.deck-schema.js";
import {
  buildFailure,
  parseJsonObject,
  type DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";

const REQUIRED_SLIDE_TYPES = [
  "cover",
  "decision",
  "ranking",
  "logic_map",
  "risk",
  "signal",
  "limitation",
  "reference",
] as const;

const hasAllRequiredSlideTypes = (outline: DeepResearchBusinessDeckOutline): boolean => {
  const slideTypes = new Set(outline.slides.map((slide) => slide.slideType));
  return REQUIRED_SLIDE_TYPES.every((slideType) => slideTypes.has(slideType));
};

const normalizeComparableText = (value: string): string =>
  value.replace(/\s+/gu, " ").trim().toLowerCase();

const buildSlideCorpus = (
  outline: DeepResearchBusinessDeckOutline,
  slideType: DeepResearchBusinessDeckOutline["slides"][number]["slideType"],
): string[] =>
  outline.slides
    .filter((slide) => slide.slideType === slideType)
    .map((slide) => [
      slide.title,
      slide.headline,
      ...slide.bullets,
      slide.visualSuggestion,
      slide.speakerNotes,
      ...slide.evidenceRefs,
      ...slide.mustNotDrop,
    ].join("\n"));

const hasAnyCoverage = (values: readonly string[], corpora: readonly string[]): boolean =>
  values
    .map((value) => normalizeComparableText(value))
    .filter((value) => value.length > 0)
    .some((value) => corpora.some((corpus) => normalizeComparableText(corpus).includes(value)));

const collectOmittedItemTypes = (outline: DeepResearchBusinessDeckOutline): Set<string> =>
  new Set(outline.contentPreservationSummary.omittedItems.map((item) => item.itemType));

const validateVerdictPreservationFlags = (
  outline: DeepResearchBusinessDeckOutline,
): string | null => {
  const check = outline.verdictPreservationCheck;
  if (!check.directAnswerPreserved) return "business_deck_direct_answer_not_preserved";
  if (!check.finalVerdictPreserved) return "business_deck_final_verdict_not_preserved";
  if (!check.confidencePreserved) return "business_deck_confidence_flag_not_preserved";
  if (!check.noNewFactsAdded) return "business_deck_new_facts_added";
  return null;
};

const validateDecisionPreservation = (
  outline: DeepResearchBusinessDeckOutline,
  finalReport: DeepResearchFinalReport,
): string | null => {
  const decisionCorpus = buildSlideCorpus(outline, "decision");
  if (decisionCorpus.length === 0) return "business_deck_missing_decision_slide";
  if (!hasAnyCoverage([
    finalReport.directAnswer,
    finalReport.oneSentenceDecision ?? finalReport.directAnswer,
    finalReport.finalVerdict,
  ], decisionCorpus)) {
    return "business_deck_decision_not_preserved";
  }
  if (!hasAnyCoverage([finalReport.confidence], decisionCorpus)) {
    return "business_deck_confidence_not_preserved";
  }
  return null;
};

const validateRankedConclusionsPreservation = (
  outline: DeepResearchBusinessDeckOutline,
  finalReport: DeepResearchFinalReport,
): string | null => {
  if (finalReport.rankedConclusions.length === 0) return null;
  if (outline.contentPreservationSummary.usedRankedConclusionCount < 1) {
    return "business_deck_ranked_conclusions_count_missing";
  }
  if (collectOmittedItemTypes(outline).has("rankedConclusion")) {
    return "business_deck_ranked_conclusions_omitted";
  }
  if (!hasAnyCoverage(
    finalReport.rankedConclusions.map((item) => item.conclusion),
    buildSlideCorpus(outline, "ranking"),
  )) {
    return "business_deck_ranked_conclusions_not_preserved";
  }
  return null;
};

const validateReverseConditionsPreservation = (
  outline: DeepResearchBusinessDeckOutline,
  finalReport: DeepResearchFinalReport,
): string | null => {
  if (finalReport.reverseConditions.length === 0) return null;
  if (outline.contentPreservationSummary.usedReverseConditionCount < 1) {
    return "business_deck_reverse_conditions_count_missing";
  }
  if (collectOmittedItemTypes(outline).has("reverseCondition")) {
    return "business_deck_reverse_conditions_omitted";
  }
  if (!hasAnyCoverage(finalReport.reverseConditions, buildSlideCorpus(outline, "risk"))) {
    return "business_deck_reverse_conditions_not_preserved";
  }
  return null;
};

const validateEvidenceGapsPreservation = (
  outline: DeepResearchBusinessDeckOutline,
  finalReport: DeepResearchFinalReport,
): string | null => {
  if (finalReport.evidenceGaps.length === 0) return null;
  if (outline.contentPreservationSummary.usedEvidenceGapCount < 1) {
    return "business_deck_evidence_gaps_count_missing";
  }
  if (collectOmittedItemTypes(outline).has("evidenceGap")) {
    return "business_deck_evidence_gaps_omitted";
  }
  if (!hasAnyCoverage(finalReport.evidenceGaps, buildSlideCorpus(outline, "limitation"))) {
    return "business_deck_evidence_gaps_not_preserved";
  }
  return null;
};

const validateLimitationsPreservation = (
  outline: DeepResearchBusinessDeckOutline,
  finalReport: DeepResearchFinalReport,
): string | null => {
  if (finalReport.limitations.length === 0) return null;
  if (collectOmittedItemTypes(outline).has("limitation")) {
    return "business_deck_limitations_omitted";
  }
  if (!hasAnyCoverage(finalReport.limitations, buildSlideCorpus(outline, "limitation"))) {
    return "business_deck_limitations_not_preserved";
  }
  return null;
};

const validateReferencePreservation = (
  outline: DeepResearchBusinessDeckOutline,
  finalReport: DeepResearchFinalReport,
): string | null => {
  if (finalReport.references.length === 0) return null;
  if (outline.contentPreservationSummary.usedReferenceCount < 1) {
    return "business_deck_references_count_missing";
  }
  if (collectOmittedItemTypes(outline).has("reference")) {
    return "business_deck_references_omitted";
  }
  if (!hasAnyCoverage(finalReport.references, buildSlideCorpus(outline, "reference"))) {
    return "business_deck_references_not_preserved";
  }
  return null;
};

export const validateDeepResearchBusinessDeckOutlineAgainstFinalReport = (input: {
  outline: DeepResearchBusinessDeckOutline;
  finalReport: DeepResearchFinalReport;
}): string | null => {
  const missingEvidenceRefs = input.outline.slides.find((slide) =>
    slide.slideType !== "cover"
    && slide.slideType !== "appendix"
    && slide.evidenceRefs.length === 0);
  if (missingEvidenceRefs) {
    return `business_deck_slide_missing_evidence_refs:${missingEvidenceRefs.slideNumber}`;
  }
  return validateVerdictPreservationFlags(input.outline)
    ?? validateDecisionPreservation(input.outline, input.finalReport)
    ?? validateRankedConclusionsPreservation(input.outline, input.finalReport)
    ?? validateReverseConditionsPreservation(input.outline, input.finalReport)
    ?? validateEvidenceGapsPreservation(input.outline, input.finalReport)
    ?? validateLimitationsPreservation(input.outline, input.finalReport)
    ?? validateReferencePreservation(input.outline, input.finalReport);
};

export const parseDeepResearchBusinessDeckOutlineResponse = (
  rawText: string,
): DeepResearchParserResult<DeepResearchBusinessDeckOutline> => {
  const parsedJson = parseJsonObject(rawText);
  if (parsedJson.parseStatus !== "parsed") return parsedJson;
  const parsed = DeepResearchBusinessDeckOutlineSchema.safeParse(parsedJson.parsed);
  if (!parsed.success) {
    return buildFailure(
      parsedJson.normalizedText,
      parsedJson.rawResponseHash,
      `invalid_business_deck_outline:${parsed.error.message}`,
      "partial_review_required",
    );
  }
  if (!hasAllRequiredSlideTypes(parsed.data)) {
    return buildFailure(
      parsedJson.normalizedText,
      parsedJson.rawResponseHash,
      "business_deck_missing_required_slide_types",
      "partial_review_required",
    );
  }
  return {
    parseStatus: parsedJson.parseStatus,
    parsed: parsed.data,
    normalizedText: parsedJson.normalizedText,
    rawResponseHash: parsedJson.rawResponseHash,
  };
};

export const parseDeepResearchBusinessDeckOutlineResponseForFinalReport = (input: {
  rawText: string;
  finalReport: DeepResearchFinalReport;
}): DeepResearchParserResult<DeepResearchBusinessDeckOutline> => {
  const parsed = parseDeepResearchBusinessDeckOutlineResponse(input.rawText);
  if (parsed.parseStatus !== "parsed") return parsed;
  const validationFailure = validateDeepResearchBusinessDeckOutlineAgainstFinalReport({
    outline: parsed.parsed,
    finalReport: input.finalReport,
  });
  if (!validationFailure) return parsed;
  return buildFailure(
    parsed.normalizedText,
    parsed.rawResponseHash,
    validationFailure,
    "partial_review_required",
  );
};
